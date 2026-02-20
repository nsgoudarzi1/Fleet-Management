import Handlebars from "handlebars";
import { chromium } from "playwright";

const basePrintCss = `
  @page { size: letter; margin: 0.45in; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.35; }
  h1, h2, h3 { margin: 0 0 10px 0; }
  .section { margin-bottom: 14px; break-inside: avoid; }
  .field-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 5px; }
  .field-label { color: #334155; font-weight: 600; }
  .field-value { color: #0f172a; }
  .signature-anchor { display: inline-block; border-bottom: 1px dashed #64748b; min-width: 220px; margin-top: 8px; padding-top: 14px; }
  .notice { border: 1px solid #d1d5db; background: #f8fafc; border-radius: 6px; padding: 8px; margin-top: 12px; font-size: 10px; color: #334155; }
`;

export function asHtmlDocument(content: string, title: string) {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <style>${basePrintCss}</style>
  </head>
  <body>${content}</body>
</html>`;
}

export function sanitizeHtmlForRendering(input: string) {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

export function renderTemplateHtml(templateSource: string, context: Record<string, unknown>) {
  const template = Handlebars.compile(templateSource, {
    noEscape: true,
    strict: false,
  });
  return template(context);
}

export async function renderHtmlToPdfBuffer(input: {
  title: string;
  htmlContent: string;
}) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setContent(asHtmlDocument(sanitizeHtmlForRendering(input.htmlContent), input.title), {
      waitUntil: "networkidle",
    });
    await page.emulateMedia({ media: "print" });
    return await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.45in",
        right: "0.45in",
        bottom: "0.45in",
        left: "0.45in",
      },
    });
  } finally {
    await page.close();
    await browser.close();
  }
}
