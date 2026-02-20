import type { DocumentEnvelopeStatus } from "@prisma/client";
import { getAppConfig } from "@/lib/config";
import { DropboxSignProvider } from "@/lib/esign/providers/dropboxsign-provider";
import { StubESignProvider } from "@/lib/esign/providers/stub-provider";
import { AppError } from "@/lib/services/guard";

export type RecipientRole = "buyer" | "co_buyer" | "seller" | "dealer";

export type Recipient = {
  role: RecipientRole;
  name: string;
  email: string;
  order: number;
};

export type EnvelopeFieldAnchor = {
  anchor: string;
  recipientRole: RecipientRole;
  recipientIndex?: number;
};

export type EnvelopeDocument = {
  id: string;
  name: string;
  fileKey: string;
  sha256: string;
  buffer?: Buffer;
};

export type ProviderEvent = {
  provider: "stub" | "dropboxsign";
  eventType: string;
  status: DocumentEnvelopeStatus;
  providerEnvelopeId: string;
  providerEventId?: string;
  idempotencyKey?: string;
  payload: unknown;
};

export interface ESignProvider {
  readonly name: "stub" | "dropboxsign";
  createEnvelope(input: {
    orgId: string;
    dealId: string;
    documents: EnvelopeDocument[];
    recipients: Recipient[];
    fields?: EnvelopeFieldAnchor[];
    requestId?: string;
  }): Promise<{ envelopeId: string; providerEnvelopeId: string; status: DocumentEnvelopeStatus }>;
  getEnvelope(input: {
    envelopeId: string;
    providerEnvelopeId: string;
  }): Promise<{
    status: DocumentEnvelopeStatus;
    recipients: Recipient[];
    signedFileKeys?: string[];
    signedPdfBuffer?: Buffer;
  }>;
  voidEnvelope(input: {
    envelopeId: string;
    providerEnvelopeId: string;
    reason: string;
  }): Promise<void>;
  verifyWebhook(request: Request): Promise<{ ok: boolean; event?: ProviderEvent }>;
}

export function getESignProvider(providerName = getAppConfig().ESIGN_PROVIDER): ESignProvider {
  if (providerName === "dropboxsign") {
    return new DropboxSignProvider();
  }
  if (providerName === "stub") {
    return new StubESignProvider();
  }
  throw new AppError(`Unsupported e-sign provider: ${providerName}`, 400);
}
