import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeMetricsSchema } from "@/lib/webhooks/schemas";
import { validateApiKey, logWebhook, getClientIp } from "@/lib/webhooks/validate";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(request);
  const endpoint = "/api/webhooks/make/metrics";
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
  const parsed = makeMetricsSchema.safeParse(body);
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

  // Resolve campaign from meta_campaign_id + organization_id (auto-create if missing)
  let campaignId: string;

  const { data: existingCampaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("meta_campaign_id", data.meta_campaign_id)
    .eq("organization_id", organizationId)
    .single();

  if (existingCampaign) {
    campaignId = existingCampaign.id;
  } else {
    const { data: newCampaign, error: createError } = await supabase
      .from("campaigns")
      .insert({
        organization_id: organizationId,
        meta_campaign_id: data.meta_campaign_id,
        nome_campagna: data.campaign_name || `Campaign ${data.meta_campaign_id}`,
        status: "attiva",
      })
      .select("id")
      .single();

    if (createError || !newCampaign) {
      const res = { success: false, error: "Failed to create campaign" };
      await logWebhook({
        apiKeyId,
        endpoint,
        statusCode: 500,
        requestBody: body,
        responseBody: res,
        errorMessage: createError?.message ?? "Unknown error",
        ipAddress: ip,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(res, { status: 500 });
    }

    campaignId = newCampaign.id;
  }

  // Upsert campaign metrics (idempotent on campaign_id + date)
  console.log('========== INSERTING METRICS ==========')
  console.log('Campaign ID:', campaignId)
  console.log('Metrics data:', {
    campaign_id: campaignId,
    date: data.date,
    impressions: data.impressions,
    clicks: data.clicks,
    spend: data.spend,
    leads: data.leads,
    cpc: data.cpc ?? null,
    cpa: data.cpa ?? null,
    ctr: data.ctr ?? null,
    cpm: data.cpm ?? null,
  })

  const { data: metric, error: upsertError } = await supabase
    .from("campaign_metrics")
    .upsert(
      {
        campaign_id: campaignId,
        date: data.date,
        impressions: data.impressions,
        clicks: data.clicks,
        spend: data.spend,
        leads: data.leads,
        cpc: data.cpc ?? null,
        cpa: data.cpa ?? null,
        ctr: data.ctr ?? null,
        cpm: data.cpm ?? null,
      },
      { onConflict: "campaign_id,date" }
    )
    .select("id")
    .single();

  console.log('Insert result:', metric)
  console.log('Insert error:', upsertError)

  if (upsertError) {
    console.error('FAILED TO INSERT METRICS:', upsertError)
    const res = { success: false, error: "Failed to upsert metrics" };
    await logWebhook({
      apiKeyId,
      endpoint,
      statusCode: 500,
      requestBody: body,
      responseBody: res,
      errorMessage: upsertError.message,
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 500 });
  }

  console.log('========== METRICS SAVED ==========')

  const res = { success: true, data: { metrics_saved: true, metric_id: metric.id } };
  await logWebhook({
    apiKeyId,
    endpoint,
    statusCode: 200,
    requestBody: body,
    responseBody: res,
    ipAddress: ip,
    durationMs: Date.now() - startTime,
  });
  return NextResponse.json(res, { status: 200 });
}
