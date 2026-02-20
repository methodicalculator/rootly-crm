import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { makeMetricsSchema } from "@/lib/webhooks/schemas";
import { logWebhook, getClientIp } from "@/lib/webhooks/validate";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(request);
  const endpoint = "/api/webhooks/make/metrics";
  let rawBody: unknown;

  // Merge query params + JSON body (meta_page_id may come as query param)
  const queryParams = Object.fromEntries(request.nextUrl.searchParams.entries());

  try {
    rawBody = await request.json();
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

  const merged = { ...(typeof rawBody === "object" && rawBody !== null ? rawBody : {}), ...queryParams };

  // Validate payload
  const parsed = makeMetricsSchema.safeParse(merged);
  if (!parsed.success) {
    const errorMessage = parsed.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    const res = { success: false, error: errorMessage };
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: 400,
      requestBody: merged,
      responseBody: res,
      errorMessage,
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 400 });
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  // Resolve organization by meta_page_id
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("meta_page_id", data.meta_page_id)
    .single();

  if (orgError || !org) {
    const res = { success: false, error: "Organization not found for this meta_page_id" };
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: 404,
      requestBody: merged,
      responseBody: res,
      errorMessage: "Organization not found for this meta_page_id",
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
      requestBody: merged,
      responseBody: res,
      errorMessage: "Organization is not active",
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 403 });
  }

  const organizationId = org.id;

  // Resolve campaign from meta_campaign_id + organization_id (auto-create if missing)
  let campaignId: string;

  if (data.meta_campaign_id) {
    // meta_campaign_id provided: look up by meta_campaign_id + org, create if not found
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
          nome_campagna: "Campagna Meta",
          status: "attiva",
        })
        .select("id")
        .single();

      if (createError || !newCampaign) {
        const res = { success: false, error: "Failed to create campaign" };
        await logWebhook({
          apiKeyId: null,
          endpoint,
          statusCode: 500,
          requestBody: merged,
          responseBody: res,
          errorMessage: createError?.message ?? "Unknown error",
          ipAddress: ip,
          durationMs: Date.now() - startTime,
        });
        return NextResponse.json(res, { status: 500 });
      }

      campaignId = newCampaign.id;
    }
  } else {
    // No meta_campaign_id: find active campaigns for this org
    const { data: activeCampaigns } = await supabase
      .from("campaigns")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "attiva");

    if (activeCampaigns && activeCampaigns.length === 1) {
      campaignId = activeCampaigns[0].id;
    } else {
      // 0 or >1 active campaigns: create a new one
      const { data: newCampaign, error: createError } = await supabase
        .from("campaigns")
        .insert({
          organization_id: organizationId,
          meta_campaign_id: null,
          nome_campagna: "Campagna Meta",
          status: "attiva",
        })
        .select("id")
        .single();

      if (createError || !newCampaign) {
        const res = { success: false, error: "Failed to create campaign" };
        await logWebhook({
          apiKeyId: null,
          endpoint,
          statusCode: 500,
          requestBody: merged,
          responseBody: res,
          errorMessage: createError?.message ?? "Unknown error",
          ipAddress: ip,
          durationMs: Date.now() - startTime,
        });
        return NextResponse.json(res, { status: 500 });
      }

      campaignId = newCampaign.id;
    }
  }

  // Upsert campaign metrics (idempotent on campaign_id + date)
  const { data: metric, error: upsertError } = await supabase
    .from("campaign_metrics")
    .upsert(
      {
        campaign_id: campaignId,
        date: data.date,
        impressions: data.impressions,
        clicks: data.clicks,
        spend: data.budget_spent,
        leads: 0,
        cpc: data.cpc ?? null,
        cpa: null,
        ctr: data.ctr ?? null,
        cpm: data.cpm ?? null,
      },
      { onConflict: "campaign_id,date" }
    )
    .select("id")
    .single();

  if (upsertError) {
    const res = { success: false, error: "Failed to upsert metrics" };
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: 500,
      requestBody: merged,
      responseBody: res,
      errorMessage: upsertError.message,
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json(res, { status: 500 });
  }

  const res = { success: true, data: { metrics_saved: true, metric_id: metric.id } };
  await logWebhook({
    apiKeyId: null,
    endpoint,
    statusCode: 200,
    requestBody: merged,
    responseBody: res,
    ipAddress: ip,
    durationMs: Date.now() - startTime,
  });
  return NextResponse.json(res, { status: 200 });
}
