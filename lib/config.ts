import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(10).optional(),
  DIRECT_URL: z.string().min(10).optional(),
  DEPLOY_TARGET: z.enum(["vercel", "cloudflare"]).default("vercel"),
  PDF_MODE: z.enum(["playwright", "external", "none"]).optional(),
  PDF_EXTERNAL_PROVIDER: z.enum(["pdfshift"]).default("pdfshift"),
  PDF_EXTERNAL_ENDPOINT: z.string().url().default("https://api.pdfshift.io/v3/convert/pdf"),
  PDF_EXTERNAL_API_KEY: z.string().min(10).optional(),
  STORAGE_MODE: z.enum(["s3", "r2", "supabase", "local"]).optional(),
  IMPORT_STORAGE_MODE: z.enum(["s3", "r2", "supabase", "local"]).optional(),
  STORAGE_DOWNLOAD_MODE: z.enum(["auto", "signed", "proxy"]).default("auto"),
  NEXTAUTH_SECRET: z.string().min(16).optional(),
  AUTH_SECRET: z.string().min(16).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().url().optional().or(z.literal("")),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  ESIGN_PROVIDER: z.enum(["stub", "dropboxsign"]).default("stub"),
  ESIGN_STUB_AUTO_COMPLETE: z.string().optional(),
  ESIGN_DROPBOXSIGN_BASE_URL: z.string().url().optional(),
  ESIGN_DROPBOXSIGN_API_KEY: z.string().optional(),
  ESIGN_DROPBOXSIGN_TEST_MODE: z.string().optional(),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_DOC_GEN_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_TEMPLATE_PREVIEW_MAX: z.coerce.number().int().positive().default(20),
  REQUEST_MAX_BYTES_TEMPLATES: z.coerce.number().int().positive().default(1024 * 1024),
  REQUEST_MAX_BYTES_PREVIEW: z.coerce.number().int().positive().default(512 * 1024),
  GENERATION_MAX_DOCS_PER_REQUEST: z.coerce.number().int().positive().default(10),
  WORKER_SECRET: z.string().min(16).optional(),
  SLA_LEAD_RESPONSE_MINUTES: z.coerce.number().int().positive().default(15),
  SLA_TASK_OVERDUE_GRACE_MINUTES: z.coerce.number().int().nonnegative().default(0),
});

export type AppConfig = ReturnType<typeof getAppConfig>;

let cachedConfig: ReturnType<typeof buildConfig> | null = null;

function buildConfig() {
  const raw = envSchema.parse(process.env);
  const isProd = raw.NODE_ENV === "production";
  const pdfMode = raw.PDF_MODE ?? (isProd ? "external" : "playwright");
  const storageMode = raw.STORAGE_MODE ?? (isProd ? "r2" : "local");
  const importStorageMode = raw.IMPORT_STORAGE_MODE ?? storageMode;
  const authSecret = raw.NEXTAUTH_SECRET ?? raw.AUTH_SECRET;
  const errors: string[] = [];

  if (isProd) {
    if (!raw.DATABASE_URL) errors.push("DATABASE_URL is required in production.");
    if (!raw.DIRECT_URL) errors.push("DIRECT_URL is required in production for migrations.");
    if (!authSecret) errors.push("NEXTAUTH_SECRET or AUTH_SECRET is required in production.");
    if (!raw.NEXTAUTH_URL) errors.push("NEXTAUTH_URL is required in production.");
  }
  if (pdfMode === "external" && !raw.PDF_EXTERNAL_API_KEY) {
    errors.push("PDF_EXTERNAL_API_KEY is required when PDF_MODE=external.");
  }
  if ((storageMode === "s3" || storageMode === "r2") && (!raw.S3_BUCKET || !raw.S3_REGION || !raw.S3_ACCESS_KEY_ID || !raw.S3_SECRET_ACCESS_KEY)) {
    errors.push("S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required for s3/r2 storage.");
  }
  if (storageMode === "supabase" && (!raw.SUPABASE_URL || !raw.SUPABASE_SERVICE_ROLE_KEY || !raw.SUPABASE_STORAGE_BUCKET)) {
    errors.push("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET are required for supabase storage.");
  }
  if (errors.length && isProd) {
    throw new Error(`Invalid production configuration:\n- ${errors.join("\n- ")}`);
  }

  return {
    ...raw,
    isProd,
    pdfMode,
    storageMode,
    importStorageMode,
    authSecret,
    configWarnings: errors,
  };
}

export function getAppConfig() {
  if (!cachedConfig) {
    cachedConfig = buildConfig();
  }
  return cachedConfig;
}
