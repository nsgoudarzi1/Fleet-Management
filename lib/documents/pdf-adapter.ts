import { getAppConfig } from "@/lib/config";
import { asHtmlDocument, renderHtmlToPdfBuffer, sanitizeHtmlForRendering } from "@/lib/documents/pdf";

export type DocumentRenderResult = {
  buffer: Buffer;
  contentType: "application/pdf" | "text/html; charset=utf-8";
  extension: "pdf" | "html";
  mode: "playwright" | "external" | "none";
};

function encodeBasic(username: string, password = "") {
  return Buffer.from(`${username}:${password}`).toString("base64");
}

async function renderWithPdfShift(html: string, title: string) {
  const config = getAppConfig();
  if (!config.PDF_EXTERNAL_API_KEY) {
    throw new Error("PDF external adapter is not configured.");
  }
  const response = await fetch(config.PDF_EXTERNAL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${encodeBasic(config.PDF_EXTERNAL_API_KEY)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: asHtmlDocument(html, title),
      use_print: true,
      sandbox: false,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`External PDF provider failed (${response.status}): ${text.slice(0, 180)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function renderDocumentArtifact(input: { title: string; htmlContent: string }): Promise<DocumentRenderResult> {
  const config = getAppConfig();
  const sanitizedHtml = sanitizeHtmlForRendering(input.htmlContent);

  if (config.pdfMode === "none") {
    return {
      buffer: Buffer.from(asHtmlDocument(sanitizedHtml, input.title), "utf8"),
      contentType: "text/html; charset=utf-8",
      extension: "html",
      mode: "none",
    };
  }

  if (config.pdfMode === "external") {
    const buffer = await renderWithPdfShift(sanitizedHtml, input.title);
    return {
      buffer,
      contentType: "application/pdf",
      extension: "pdf",
      mode: "external",
    };
  }

  const buffer = await renderHtmlToPdfBuffer({
    title: input.title,
    htmlContent: sanitizedHtml,
  });
  return {
    buffer,
    contentType: "application/pdf",
    extension: "pdf",
    mode: "playwright",
  };
}

export function getPdfAdapterHealth() {
  const config = getAppConfig();
  if (config.pdfMode === "external" && !config.PDF_EXTERNAL_API_KEY) {
    return { ok: false, mode: config.pdfMode, message: "Missing PDF_EXTERNAL_API_KEY." };
  }
  return { ok: true, mode: config.pdfMode, message: "PDF adapter ready." };
}
