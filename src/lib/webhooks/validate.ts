import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Log webhook request to webhook_logs table
export async function logWebhook(params: {
  apiKeyId: string | null;
  endpoint: string;
  statusCode: number;
  requestBody: unknown;
  responseBody: unknown;
  errorMessage?: string;
  ipAddress: string | null;
  durationMs: number;
}) {
  const supabase = createAdminClient();

  await supabase.from("webhook_logs").insert({
    api_key_id: params.apiKeyId,
    endpoint: params.endpoint,
    status_code: params.statusCode,
    request_body: params.requestBody as Record<string, unknown>,
    response_body: params.responseBody as Record<string, unknown>,
    error_message: params.errorMessage ?? null,
    ip_address: params.ipAddress,
    duration_ms: params.durationMs,
  });
}

// Extract client IP from request headers
export function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}
