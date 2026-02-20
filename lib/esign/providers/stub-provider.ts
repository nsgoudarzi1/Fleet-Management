import { randomUUID } from "node:crypto";
import type { DocumentEnvelopeStatus } from "@prisma/client";
import { getAppConfig } from "@/lib/config";
import type { ESignProvider, ProviderEvent, Recipient } from "@/lib/esign/provider";

type StubEnvelopeState = {
  status: DocumentEnvelopeStatus;
  recipients: Recipient[];
};

const stubStore = new Map<string, StubEnvelopeState>();

function autoCompleteEnabled() {
  return getAppConfig().ESIGN_STUB_AUTO_COMPLETE !== "false";
}

export class StubESignProvider implements ESignProvider {
  readonly name = "stub" as const;

  async createEnvelope(input: {
    orgId: string;
    dealId: string;
    recipients: Recipient[];
  }) {
    const providerEnvelopeId = `stub-${input.dealId}-${randomUUID()}`;
    const status: DocumentEnvelopeStatus = autoCompleteEnabled() ? "COMPLETED" : "SENT";
    stubStore.set(providerEnvelopeId, { status, recipients: input.recipients });
    return {
      envelopeId: providerEnvelopeId,
      providerEnvelopeId,
      status,
    };
  }

  async getEnvelope(input: { envelopeId: string; providerEnvelopeId: string }) {
    const state = stubStore.get(input.providerEnvelopeId);
    return {
      status: state?.status ?? "SENT",
      recipients: state?.recipients ?? [],
    };
  }

  async voidEnvelope(input: { providerEnvelopeId: string }) {
    const state = stubStore.get(input.providerEnvelopeId);
    if (state) {
      state.status = "VOIDED";
      stubStore.set(input.providerEnvelopeId, state);
    }
  }

  async verifyWebhook(request: Request) {
    const body = (await request.json().catch(() => null)) as
      | {
          providerEnvelopeId?: string;
          eventType?: string;
          status?: DocumentEnvelopeStatus;
          eventId?: string;
        }
      | null;
    if (!body?.providerEnvelopeId || !body.eventType || !body.status) {
      return { ok: false };
    }
    const event: ProviderEvent = {
      provider: "stub",
      eventType: body.eventType,
      status: body.status,
      providerEnvelopeId: body.providerEnvelopeId,
      providerEventId: body.eventId ?? randomUUID(),
      idempotencyKey: `stub:${body.eventId ?? randomUUID()}`,
      payload: body,
    };
    return { ok: true, event };
  }
}
