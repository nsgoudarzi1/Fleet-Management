import { createHmac } from "node:crypto";
import { getAppConfig } from "@/lib/config";
import { AppError } from "@/lib/services/guard";
import type { ESignProvider, ProviderEvent, Recipient } from "@/lib/esign/provider";

type DropboxSignResponse = {
  signature_request?: {
    signature_request_id?: string;
    is_complete?: boolean;
    is_declined?: boolean;
    is_canceled?: boolean;
    signatures?: Array<{
      signer_email_address?: string;
      signer_name?: string;
      status_code?: string;
      order?: number;
    }>;
  };
  error?: {
    error_msg?: string;
  };
};

function mapDropboxStatuses(input: DropboxSignResponse["signature_request"]) {
  if (!input) return "ERROR" as const;
  if (input.is_canceled) return "VOIDED" as const;
  if (input.is_declined) return "DECLINED" as const;
  if (input.is_complete) return "COMPLETED" as const;
  const signatures = input.signatures ?? [];
  const signedCount = signatures.filter((item) => item.status_code === "signed").length;
  if (signedCount > 0) return "PARTIALLY_SIGNED" as const;
  return "SENT" as const;
}

function mapWebhookEventStatus(eventType: string) {
  switch (eventType) {
    case "signature_request_viewed":
      return "VIEWED" as const;
    case "signature_request_signed":
      return "PARTIALLY_SIGNED" as const;
    case "signature_request_all_signed":
      return "COMPLETED" as const;
    case "signature_request_declined":
      return "DECLINED" as const;
    case "signature_request_canceled":
      return "VOIDED" as const;
    case "signature_request_sent":
      return "SENT" as const;
    default:
      return "ERROR" as const;
  }
}

export class DropboxSignProvider implements ESignProvider {
  readonly name = "dropboxsign" as const;
  private readonly appConfig = getAppConfig();
  private readonly apiKey = this.appConfig.ESIGN_DROPBOXSIGN_API_KEY ?? "";
  private readonly baseUrl = this.appConfig.ESIGN_DROPBOXSIGN_BASE_URL ?? "https://api.hellosign.com/v3";

  private authHeaders() {
    if (!this.apiKey) throw new AppError("Dropbox Sign API key is not configured.", 500);
    return {
      Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
    };
  }

  private async readJson(response: Response) {
    return (await response.json().catch(() => ({}))) as DropboxSignResponse;
  }

  async createEnvelope(input: {
    orgId: string;
    dealId: string;
    documents: Array<{ name: string; buffer?: Buffer }>;
    recipients: Recipient[];
  }) {
    const form = new FormData();
    form.set("title", `Deal ${input.dealId} Documents`);
    form.set("subject", `Deal packet for ${input.dealId}`);
    form.set("message", "Please review and sign.");
    form.set("test_mode", this.appConfig.ESIGN_DROPBOXSIGN_TEST_MODE === "false" ? "0" : "1");
    form.set("use_text_tags", "1");

    input.recipients
      .slice()
      .sort((a, b) => a.order - b.order)
      .forEach((recipient, index) => {
        form.set(`signers[${index}][name]`, recipient.name);
        form.set(`signers[${index}][email_address]`, recipient.email);
        form.set(`signers[${index}][order]`, String(recipient.order));
      });

    input.documents.forEach((document, index) => {
      if (!document.buffer) {
        throw new AppError(`Document buffer missing for ${document.name}.`, 400);
      }
      const blob = new Blob([Uint8Array.from(document.buffer)], { type: "application/pdf" });
      form.set(`files[${index}]`, blob, document.name);
    });

    const response = await fetch(`${this.baseUrl}/signature_request/send`, {
      method: "POST",
      headers: this.authHeaders(),
      body: form,
    });
    const json = await this.readJson(response);
    if (!response.ok || !json.signature_request?.signature_request_id) {
      throw new AppError(json.error?.error_msg ?? "Unable to create Dropbox Sign envelope.", 400);
    }
    const providerEnvelopeId = json.signature_request.signature_request_id;
    return {
      envelopeId: providerEnvelopeId,
      providerEnvelopeId,
      status: mapDropboxStatuses(json.signature_request),
    };
  }

  async getEnvelope(input: { envelopeId: string; providerEnvelopeId: string }) {
    const response = await fetch(`${this.baseUrl}/signature_request/${input.providerEnvelopeId}`, {
      method: "GET",
      headers: this.authHeaders(),
    });
    const json = await this.readJson(response);
    if (!response.ok || !json.signature_request) {
      throw new AppError(json.error?.error_msg ?? "Unable to retrieve Dropbox Sign envelope.", 400);
    }

    const status = mapDropboxStatuses(json.signature_request);
    const recipients =
      json.signature_request.signatures?.map((signature) => ({
        role: "buyer" as const,
        name: signature.signer_name ?? "Signer",
        email: signature.signer_email_address ?? "",
        order: signature.order ?? 1,
      })) ?? [];

    if (status !== "COMPLETED") {
      return { status, recipients };
    }

    const fileResponse = await fetch(
      `${this.baseUrl}/signature_request/files/${input.providerEnvelopeId}?file_type=pdf`,
      {
        method: "GET",
        headers: this.authHeaders(),
      },
    );
    if (!fileResponse.ok) {
      return { status, recipients };
    }
    const signedPdfBuffer = Buffer.from(await fileResponse.arrayBuffer());
    return { status, recipients, signedPdfBuffer };
  }

  async voidEnvelope(input: { envelopeId: string; providerEnvelopeId: string; reason: string }) {
    const form = new URLSearchParams();
    form.set("reason", input.reason);
    const response = await fetch(`${this.baseUrl}/signature_request/cancel/${input.providerEnvelopeId}`, {
      method: "POST",
      headers: {
        ...this.authHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!response.ok) {
      const json = await this.readJson(response);
      throw new AppError(json.error?.error_msg ?? "Unable to void Dropbox Sign envelope.", 400);
    }
  }

  async verifyWebhook(request: Request) {
    const formData = await request.formData().catch(() => null);
    const jsonPayload = formData?.get("json");
    if (typeof jsonPayload !== "string") {
      return { ok: false };
    }
    const parsed = JSON.parse(jsonPayload) as {
      event?: {
        event_type?: string;
        event_time?: string;
        event_hash?: string;
      };
      signature_request?: {
        signature_request_id?: string;
      };
    };
    const eventType = parsed.event?.event_type ?? "";
    const eventTime = parsed.event?.event_time ?? "";
    const expected = createHmac("sha256", this.apiKey).update(`${eventTime}${eventType}`).digest("hex");
    if (!eventType || !eventTime || expected !== parsed.event?.event_hash) {
      return { ok: false };
    }
    const providerEnvelopeId = parsed.signature_request?.signature_request_id;
    if (!providerEnvelopeId) {
      return { ok: false };
    }
    const providerEventId = `${providerEnvelopeId}:${eventType}:${eventTime}`;
    const event: ProviderEvent = {
      provider: "dropboxsign",
      eventType,
      status: mapWebhookEventStatus(eventType),
      providerEnvelopeId,
      providerEventId,
      idempotencyKey: `dropboxsign:${providerEventId}`,
      payload: parsed,
    };
    return { ok: true, event };
  }
}
