import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { zapierLeadSchema } from "@/lib/webhooks/schemas";
import { validateApiKey, logWebhook, getClientIp } from "@/lib/webhooks/validate";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(request);
  const endpoint = "/api/webhooks/zapier/lead";
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

  // Validate payload
  const parsed = zapierLeadSchema.safeParse(body);
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

  // Validate API key and resolve organization
  const validation = await validateApiKey(request, data.ad_account_id);
  if (!validation.ok) {
    const res = { success: false, error: validation.error.message };
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: validation.error.status,
      requestBody: body,
      responseBody: res,
      errorMessage: validation.error.message,
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: validation.error.status });
  }

  const { apiKeyId, organizationId } = validation.data;
  const supabase = createAdminClient();

  // Insert client
  const { data: client, error: insertError } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      nome: data.nome,
      cognome: data.cognome,
      email: data.email || null,
      telefono: data.telefono || null,
      service_interest: data.service_interest || null,
      note: data.note || null,
      source: "meta_ads",
      status: "attivo",
      first_contact_date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .single();

  if (insertError) {
    const res = { success: false, error: "Failed to create client" };
    await logWebhook({
      apiKeyId,
      endpoint,
      statusCode: 500,
      requestBody: body,
      responseBody: res,
      errorMessage: insertError.message,
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 500 });
  }

  const res = { success: true, data: { client_id: client.id } };
  await logWebhook({
    apiKeyId,
    endpoint,
    statusCode: 201,
    requestBody: body,
    responseBody: res,
    ipAddress: ip,
    durationMs: Date.now() - startTime,
  });
  return NextResponse.json(res, { status: 201 });
}
