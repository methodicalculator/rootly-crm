import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ValidatedKey {
  apiKeyId: string;
  organizationId: string;
}

interface ValidationError {
  status: number;
  message: string;
}

type ValidationResult =
  | { ok: true; data: ValidatedKey }
  | { ok: false; error: ValidationError };

// Validate X-API-Key header, check scopes, resolve organization from ad_account_id
export async function validateApiKey(
  request: NextRequest,
  adAccountId: string
): Promise<ValidationResult> {
  const apiKey = request.headers.get("X-API-Key")?.trim();

  if (!apiKey) {
    return { ok: false, error: { status: 401, message: "Missing X-API-Key header" } };
  }

  const supabase = createAdminClient();

  // Lookup API key by direct match
  const { data: keyRow, error: keyError } = await supabase
    .from("api_keys")
    .select("id, organization_id, scopes, is_active, expires_at")
    .eq("key", apiKey)
    .eq("is_active", true)
    .single();

  if (keyError || !keyRow) {
    return { ok: false, error: { status: 401, message: "Invalid API key" } };
  }

  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return { ok: false, error: { status: 401, message: "API key has expired" } };
  }

  const scopes = keyRow.scopes as string[];
  if (!scopes.includes("webhooks:write")) {
    return { ok: false, error: { status: 403, message: "Insufficient scope: webhooks:write required" } };
  }

  // Resolve organization from ad_account_id
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("meta_ad_account_id", adAccountId)
    .single();

  if (orgError || !org) {
    return { ok: false, error: { status: 404, message: "Organization not found for this ad_account_id" } };
  }

  if (org.status !== "active") {
    return { ok: false, error: { status: 403, message: "Organization is not active" } };
  }

  // Verify the API key belongs to the resolved organization
  if (keyRow.organization_id !== org.id) {
    return { ok: false, error: { status: 403, message: "API key does not belong to this organization" } };
  }

  // Update last_used_at (fire-and-forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then();

  return { ok: true, data: { apiKeyId: keyRow.id, organizationId: org.id } };
}

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
