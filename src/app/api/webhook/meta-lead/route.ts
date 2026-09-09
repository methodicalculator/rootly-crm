import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { metaLeadSchema } from "@/lib/webhooks/schemas";
import { logWebhook, getClientIp } from "@/lib/webhooks/validate";
import { insertLead } from "@/lib/webhooks/insert-lead";

// ─── GET: Meta webhook verification handshake ───────────────────────
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN
  ) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// ─── POST: Receive lead events ──────────────────────────────────────
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(request);
  const endpoint = "/api/webhook/meta-lead";

  // Read raw body (needed for HMAC verification)
  const rawBody = await request.text();
  let body: unknown;

  try {
    body = JSON.parse(rawBody);
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

  // Determine payload type: Meta real webhook (has entry[].changes) vs clean fallback
  const isMetaRealPayload =
    body != null &&
    typeof body === "object" &&
    "entry" in body &&
    Array.isArray((body as Record<string, unknown>).entry);

  // ─── Meta real webhook flow ─────────────────────────────────────
  if (isMetaRealPayload) {
    // Verify HMAC signature
    const signature = request.headers.get("x-hub-signature-256");
    const appSecret = process.env.META_APP_SECRET;

    if (!appSecret) {
      console.error("[meta-lead] META_APP_SECRET not configured");
      await logWebhook({
        apiKeyId: null,
        endpoint,
        statusCode: 500,
        requestBody: body,
        responseBody: { success: false, error: "Server misconfiguration" },
        errorMessage: "META_APP_SECRET not configured",
        ipAddress: ip,
        durationMs: Date.now() - startTime,
      });
      // Return 200 to Meta to prevent retries
      return NextResponse.json({ success: false }, { status: 200 });
    }

    if (!signature) {
      const res = { success: false, error: "Missing signature" };
      await logWebhook({
        apiKeyId: null,
        endpoint,
        statusCode: 401,
        requestBody: body,
        responseBody: res,
        errorMessage: "Missing x-hub-signature-256 header",
        ipAddress: ip,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(res, { status: 401 });
    }

    const expectedSignature =
      "sha256=" +
      createHmac("sha256", appSecret).update(rawBody).digest("hex");

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      const res = { success: false, error: "Invalid signature" };
      await logWebhook({
        apiKeyId: null,
        endpoint,
        statusCode: 401,
        requestBody: body,
        responseBody: res,
        errorMessage: "HMAC signature mismatch",
        ipAddress: ip,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(res, { status: 401 });
    }

    // Process each entry/change
    const entries = (body as { entry: MetaEntry[] }).entry;

    for (const entry of entries) {
      const pageId = entry.id;
      const changes = entry.changes ?? [];

      for (const change of changes) {
        if (change.field !== "leadgen") continue;

        const leadgenId = change.value?.leadgen_id;
        if (!leadgenId) continue;

        try {
          await processMetaLead(pageId, leadgenId, endpoint, ip, startTime, body);
        } catch (err) {
          console.error("[meta-lead] Error processing lead:", leadgenId, err);
        }
      }
    }

    // Always respond 200 to Meta
    await logWebhook({
      apiKeyId: null,
      endpoint,
      statusCode: 200,
      requestBody: body,
      responseBody: { success: true },
      ipAddress: ip,
      durationMs: Date.now() - startTime,
    });
    return NextResponse.json({ success: true }, { status: 200 });
  }

  // ─── Fallback: clean payload flow ───────────────────────────────
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

// ─── Types ──────────────────────────────────────────────────────────

interface MetaEntry {
  id: string; // page_id
  changes?: MetaChange[];
}

interface MetaChange {
  field: string;
  value: {
    leadgen_id?: string;
    [key: string]: unknown;
  };
}

interface MetaFieldData {
  name: string;
  values: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────

const FULL_NAME_KEYS = new Set(["full_name", "nome_completo", "nome_e_cognome"]);
const EMAIL_KEYS = new Set(["email"]);
const PHONE_KEYS = new Set(["phone_number", "telefono", "phone"]);

function normalizeFieldData(fieldData: MetaFieldData[]): {
  fullName: string;
  email: string | null;
  phone: string | null;
  note: string | null;
} {
  let fullName = "";
  let email: string | null = null;
  let phone: string | null = null;
  const extraFields: string[] = [];

  for (const field of fieldData) {
    const key = field.name.toLowerCase();
    const value = field.values?.[0] ?? "";

    if (FULL_NAME_KEYS.has(key)) {
      fullName = value;
    } else if (EMAIL_KEYS.has(key)) {
      email = value || null;
    } else if (PHONE_KEYS.has(key)) {
      phone = value || null;
    } else {
      if (value) {
        extraFields.push(`${field.name}: ${value}`);
      }
    }
  }

  return {
    fullName: fullName || "Sconosciuto",
    email,
    phone,
    note: extraFields.length > 0 ? extraFields.join("\n") : null,
  };
}

async function processMetaLead(
  pageId: string,
  leadgenId: string,
  endpoint: string,
  ip: string | null,
  startTime: number,
  originalBody: unknown
) {
  const supabase = createAdminClient();

  // Resolve organization by meta_page_id
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, status, meta_page_access_token")
    .eq("meta_page_id", pageId)
    .single();

  if (orgError || !org) {
    console.error("[meta-lead] Organization not found for page_id:", pageId);
    return;
  }

  if (org.status !== "active") {
    console.error("[meta-lead] Organization not active for page_id:", pageId);
    return;
  }

  if (!org.meta_page_access_token) {
    console.error("[meta-lead] meta_page_access_token not set for org:", org.id);
    return;
  }

  // Fetch lead data from Graph API
  const graphUrl = `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${encodeURIComponent(org.meta_page_access_token)}`;
  const graphResponse = await fetch(graphUrl);

  if (!graphResponse.ok) {
    const errText = await graphResponse.text();
    console.error("[meta-lead] Graph API error:", graphResponse.status, errText);
    return;
  }

  const leadData = (await graphResponse.json()) as {
    field_data?: MetaFieldData[];
  };

  if (!leadData.field_data || !Array.isArray(leadData.field_data)) {
    console.error("[meta-lead] No field_data in Graph API response for lead:", leadgenId);
    return;
  }

  // Normalize fields
  const normalized = normalizeFieldData(leadData.field_data);

  // Insert lead
  const result = await insertLead({
    organizationId: org.id,
    fullName: normalized.fullName,
    email: normalized.email,
    phone: normalized.phone,
    note: normalized.note,
  });

  if ("error" in result) {
    console.error("[meta-lead] Insert error for lead:", leadgenId, result.error);
  }
}
