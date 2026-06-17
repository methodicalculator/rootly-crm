import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const META_API_VERSION = "v21.0";
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface MetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpm: string;
  cpc: string;
}

interface MetaInsightsResponse {
  data: MetaInsightRow[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
  };
  error?: { message: string; type: string; code: number };
}

interface OrgResult {
  org_id: string;
  org_name: string;
  ad_account_id: string;
  campaigns_processed: number;
  metrics_upserted: number;
  error?: string;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Auth: verify CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metaToken = process.env.META_SYSTEM_USER_TOKEN;
  if (!metaToken) {
    return NextResponse.json(
      { error: "META_SYSTEM_USER_TOKEN not configured" },
      { status: 500 }
    );
  }

  const supabase = createAdminClient();

  // Determine date (default: yesterday)
  const dateParam = req.nextUrl.searchParams.get("date");
  let targetDate: string;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    targetDate = dateParam;
  } else {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    targetDate = yesterday.toISOString().split("T")[0];
  }

  // Determine target organizations
  const adAccountParam = req.nextUrl.searchParams.get("ad_account_id");
  let orgs: { id: string; name: string; meta_ad_account_id: string }[];

  if (adAccountParam) {
    // Test mode: single account
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, meta_ad_account_id")
      .eq("meta_ad_account_id", adAccountParam)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: `Organization not found for ad_account_id: ${adAccountParam}` },
        { status: 404 }
      );
    }
    orgs = [data];
  } else {
    // All active organizations with a meta_ad_account_id
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, meta_ad_account_id")
      .not("meta_ad_account_id", "is", null)
      .eq("status", "active");

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch organizations: ${error.message}` },
        { status: 500 }
      );
    }
    orgs = data ?? [];
  }

  const results: OrgResult[] = [];
  let totalMetricsUpserted = 0;
  let totalErrors = 0;

  for (const org of orgs) {
    const orgResult: OrgResult = {
      org_id: org.id,
      org_name: org.name,
      ad_account_id: org.meta_ad_account_id,
      campaigns_processed: 0,
      metrics_upserted: 0,
    };

    try {
      // Fetch all insight rows with cursor-based pagination
      const allRows: MetaInsightRow[] = [];
      let url: string | null =
        `${META_GRAPH_URL}/${org.meta_ad_account_id}/insights` +
        `?fields=spend,impressions,clicks,ctr,cpm,cpc,campaign_id,campaign_name` +
        `&level=campaign` +
        `&time_range=${encodeURIComponent(JSON.stringify({ since: targetDate, until: targetDate }))}` +
        `&limit=100` +
        `&access_token=${metaToken}`;

      while (url) {
        const resp = await fetch(url);
        const json: MetaInsightsResponse = await resp.json();

        if (json.error) {
          throw new Error(`Meta API error: ${json.error.message} (code ${json.error.code})`);
        }

        allRows.push(...(json.data ?? []));
        url = json.paging?.next ?? null;
      }

      // Process each campaign row
      for (const row of allRows) {
        try {
          // Resolve or create campaign
          let campaignId: string;

          const { data: existingCampaign } = await supabase
            .from("campaigns")
            .select("id")
            .eq("meta_campaign_id", row.campaign_id)
            .eq("organization_id", org.id)
            .single();

          if (existingCampaign) {
            campaignId = existingCampaign.id;
          } else {
            const { data: newCampaign, error: createError } = await supabase
              .from("campaigns")
              .insert({
                organization_id: org.id,
                meta_campaign_id: row.campaign_id,
                nome_campagna: row.campaign_name || "Campagna Meta",
                status: "attiva",
              })
              .select("id")
              .single();

            if (createError || !newCampaign) {
              console.error(
                `Failed to create campaign ${row.campaign_id} for org ${org.id}:`,
                createError?.message
              );
              continue;
            }
            campaignId = newCampaign.id;
          }

          // Upsert metrics
          const { error: upsertError } = await supabase
            .from("campaign_metrics")
            .upsert(
              {
                campaign_id: campaignId,
                date: targetDate,
                impressions: parseInt(row.impressions) || 0,
                clicks: parseInt(row.clicks) || 0,
                spend: parseFloat(row.spend) || 0,
                leads: 0,
                cpc: parseFloat(row.cpc) || null,
                ctr: parseFloat(row.ctr) || null,
                cpm: parseFloat(row.cpm) || null,
                cpa: null,
              },
              { onConflict: "campaign_id,date" }
            );

          if (upsertError) {
            console.error(
              `Failed to upsert metrics for campaign ${row.campaign_id}, date ${targetDate}:`,
              upsertError.message
            );
            continue;
          }

          orgResult.campaigns_processed++;
          orgResult.metrics_upserted++;
          totalMetricsUpserted++;
        } catch (rowErr) {
          console.error(
            `Error processing campaign ${row.campaign_id} for org ${org.id}:`,
            rowErr
          );
        }
      }
    } catch (orgErr) {
      orgResult.error =
        orgErr instanceof Error ? orgErr.message : "Unknown error";
      totalErrors++;
    }

    results.push(orgResult);
  }

  return NextResponse.json({
    ok: true,
    date: targetDate,
    organizations_processed: orgs.length,
    total_metrics_upserted: totalMetricsUpserted,
    total_errors: totalErrors,
    results,
    duration_ms: Date.now() - startTime,
  });
}
