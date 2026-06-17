import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  date_start: string;
  date_stop: string;
}

interface MetaInsightsResponse {
  data: MetaInsightRow[];
  paging?: {
    cursors?: { before: string; after: string };
    next?: string;
  };
  error?: { message: string; type: string; code: number };
}

export async function POST(request: NextRequest) {
  // 1. Auth — verify session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  // 2. Parse body
  const body = await request.json();
  const { organization_id, date_from, date_to, known_dates } = body as {
    organization_id: string;
    date_from: string;
    date_to: string;
    known_dates: string[];
  };

  if (!organization_id || !date_from || !date_to) {
    return NextResponse.json(
      { error: "organization_id, date_from and date_to are required" },
      { status: 400 }
    );
  }

  // 3. Auth — verify user belongs to org or is admin/super_admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profilo non trovato" }, { status: 403 });
  }

  const isAdminRole =
    profile.role === "admin" || profile.role === "super_admin";
  const isStaff = profile.role === "staff";
  const ownsOrg = profile.organization_id === organization_id;

  if (!isAdminRole && !ownsOrg) {
    // Check staff_organizations for staff users
    if (isStaff) {
      const { data: staffOrg } = await supabase
        .from("staff_organizations")
        .select("id")
        .eq("user_id", user.id)
        .eq("organization_id", organization_id)
        .single();

      if (!staffOrg) {
        return NextResponse.json(
          { error: "Non autorizzato" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Non autorizzato" },
        { status: 403 }
      );
    }
  }

  // 4. Check META_SYSTEM_USER_TOKEN
  const metaToken = process.env.META_SYSTEM_USER_TOKEN;
  if (!metaToken) {
    return NextResponse.json({ fetched: false, reason: "not_configured" });
  }

  // 5. Fetch org to get meta_ad_account_id (use admin client to bypass RLS)
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("meta_ad_account_id")
    .eq("id", organization_id)
    .single();

  if (!org?.meta_ad_account_id) {
    return NextResponse.json({ fetched: false, reason: "no_ad_account" });
  }

  // 6. 37-month limit
  const thirtySevenMonthsAgo = new Date();
  thirtySevenMonthsAgo.setMonth(thirtySevenMonthsAgo.getMonth() - 37);
  const limitDate = thirtySevenMonthsAgo.toISOString().split("T")[0];

  if (date_from < limitDate) {
    return NextResponse.json({ fetched: false, reason: "too_old" });
  }

  // 7. Compute missing dates
  const knownSet = new Set(known_dates ?? []);
  const missingDates: string[] = [];
  const current = new Date(date_from + "T00:00:00");
  const end = new Date(date_to + "T00:00:00");

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    if (!knownSet.has(dateStr)) {
      missingDates.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  if (missingDates.length === 0) {
    return NextResponse.json({ fetched: false, reason: "all_present" });
  }

  // 8. Fetch from Meta Insights API with time_increment=1
  const missingSet = new Set(missingDates);
  const allRows: MetaInsightRow[] = [];

  let url: string | null =
    `${META_GRAPH_URL}/${org.meta_ad_account_id}/insights` +
    `?fields=spend,impressions,clicks,ctr,cpm,cpc,campaign_id,campaign_name` +
    `&level=campaign` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since: date_from, until: date_to }))}` +
    `&time_increment=1` +
    `&limit=500` +
    `&access_token=${metaToken}`;

  try {
    while (url) {
      const resp = await fetch(url);
      const json: MetaInsightsResponse = await resp.json();

      if (json.error) {
        console.error("[backfill-metrics] Meta API error:", json.error);
        return NextResponse.json(
          { error: `Meta API error: ${json.error.message}` },
          { status: 502 }
        );
      }

      allRows.push(...(json.data ?? []));
      url = json.paging?.next ?? null;
    }
  } catch (err) {
    console.error("[backfill-metrics] Meta fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch from Meta API" },
      { status: 502 }
    );
  }

  // 9. Filter to only missing dates, resolve campaigns, upsert metrics
  const newMetrics: Array<{
    id?: string;
    campaign_id: string;
    date: string;
    impressions: number;
    clicks: number;
    spend: number;
    leads: number;
    cpc: number | null;
    cpa: number | null;
    ctr: number | null;
    cpm: number | null;
  }> = [];

  for (const row of allRows) {
    // Only process rows for missing dates
    if (!missingSet.has(row.date_start)) continue;

    try {
      // Resolve or create campaign (same logic as fetch-meta-metrics)
      let campaignId: string;

      const { data: existingCampaign } = await admin
        .from("campaigns")
        .select("id")
        .eq("meta_campaign_id", row.campaign_id)
        .eq("organization_id", organization_id)
        .single();

      if (existingCampaign) {
        campaignId = existingCampaign.id;
      } else {
        const { data: newCampaign, error: createError } = await admin
          .from("campaigns")
          .insert({
            organization_id,
            meta_campaign_id: row.campaign_id,
            nome_campagna: row.campaign_name || "Campagna Meta",
            status: "attiva",
          })
          .select("id")
          .single();

        if (createError || !newCampaign) {
          console.error(
            `[backfill-metrics] Failed to create campaign ${row.campaign_id}:`,
            createError?.message
          );
          continue;
        }
        campaignId = newCampaign.id;
      }

      // Upsert metrics
      const metricRow = {
        campaign_id: campaignId,
        date: row.date_start,
        impressions: parseInt(row.impressions) || 0,
        clicks: parseInt(row.clicks) || 0,
        spend: parseFloat(row.spend) || 0,
        leads: 0,
        cpc: parseFloat(row.cpc) || null,
        ctr: parseFloat(row.ctr) || null,
        cpm: parseFloat(row.cpm) || null,
        cpa: null,
      };

      const { data: upserted, error: upsertError } = await admin
        .from("campaign_metrics")
        .upsert(metricRow, { onConflict: "campaign_id,date" })
        .select()
        .single();

      if (upsertError) {
        console.error(
          `[backfill-metrics] Failed to upsert metrics for campaign ${row.campaign_id}, date ${row.date_start}:`,
          upsertError.message
        );
        continue;
      }

      if (upserted) {
        newMetrics.push(upserted);
      }
    } catch (rowErr) {
      console.error(
        `[backfill-metrics] Error processing row for campaign ${row.campaign_id}:`,
        rowErr
      );
    }
  }

  return NextResponse.json({
    fetched: true,
    metrics_saved: newMetrics.length,
    new_metrics: newMetrics,
  });
}
