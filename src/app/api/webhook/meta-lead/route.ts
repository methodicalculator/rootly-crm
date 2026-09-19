import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { metaLeadSchema } from "@/lib/webhooks/schemas";
import { logWebhook, getClientIp } from "@/lib/webhooks/validate";
import { insertLead } from "@/lib/webhooks/insert-lead";

// ─── POST: Receive lead from Zapier (clean payload) ─────────────────
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(request);
  const endpoint = "/api/webhook/meta-lead";

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    const res = { success: false, error: "Invalid JSON body" };
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: 400,
      requestBody: null,
      responseBody: res,
      errorMessage: "Invalid JSON body",
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 400 });
  }

  const parsed = metaLeadSchema.safeParse(body);
  if (!parsed.success) {
    const errorMessage = parsed.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    const res = { success: false, error: errorMessage };
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: 400,
      requestBody: body,
      responseBody: res,
      errorMessage,
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 400 });
  }

  const data = parsed.data;
  const metaPageId =
    data.meta_page_id || request.nextUrl.searchParams.get("meta_page_id");

  if (!metaPageId) {
    const res = { success: false, error: "meta_page_id is required (body or query param)" };
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: 400,
      requestBody: body,
      responseBody: res,
      errorMessage: "meta_page_id missing",
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("meta_page_id", metaPageId)
    .single();

  if (orgError || !org) {
    const res = { success: false, error: "Organization not found for this meta_page_id" };
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: 404,
      requestBody: body,
      responseBody: res,
      errorMessage: "Organization not found",
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 404 });
  }

  if (org.status !== "active") {
    const res = { success: false, error: "Organization is not active" };
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: 403,
      requestBody: body,
      responseBody: res,
      errorMessage: "Organization not active",
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 403 });
  }

  const result = await insertLead({
    organizationId: org.id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    note: data.notes,
    serviceInterest: data.service_interest,
  });

  if ("error" in result) {
    const res = { success: false, error: "Failed to create contact" };
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: 500,
      requestBody: body,
      responseBody: res,
      errorMessage: result.error,
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 500 });
  }

  const res = { success: true, contact_id: result.clientId };
  await logWebhook({
    apiKeyId: null,
    endpoint,
    statusCode: 201,
    requestBody: body,
    responseBody: res,
    ipAddress: ip,
    durationMs: Date.now() - startTime,
  });
  return NextResponse.json(res, { status: 201 });
}
