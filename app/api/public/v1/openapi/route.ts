import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "FleetFlow Public API",
    version: "1.0.0",
    description: "Org-scoped API key protected endpoints for dealer data integrations.",
  },
  servers: [{ url: "/api/public/v1" }],
  security: [{ ApiKeyAuth: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
      },
    },
  },
  paths: {
    "/vehicles": { get: { summary: "List vehicles" } },
    "/customers": { get: { summary: "List customers" } },
    "/deals": { get: { summary: "List deals" } },
    "/repair-orders": { get: { summary: "List repair orders" } },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
