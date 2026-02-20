import { z } from "zod";

// Zapier Lead payload — data from Meta Lead Ads
export const zapierLeadSchema = z.object({
  ad_account_id: z.string().min(1, "ad_account_id is required"),
  nome: z.string().min(1, "nome is required"),
  cognome: z.string().min(1, "cognome is required"),
  email: z.string().email().optional().or(z.literal("")),
  telefono: z.string().optional(),
  service_interest: z.string().optional(),
  note: z.string().optional(),
});

export type ZapierLeadPayload = z.infer<typeof zapierLeadSchema>;

// Make.com Metrics payload — daily campaign performance data
// Uses z.coerce.number() because Make.com may send numeric values as strings
export const makeMetricsSchema = z.object({
  meta_page_id: z.string().min(1, "meta_page_id is required"),
  meta_campaign_id: z.string().min(1, "meta_campaign_id is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  budget_spent: z.coerce.number().min(0),
  impressions: z.coerce.number().int().min(0),
  cpm: z.coerce.number().min(0).optional(),
  clicks: z.coerce.number().int().min(0),
  ctr: z.coerce.number().min(0).optional(),
  cpc: z.coerce.number().min(0).optional(),
});

export type MakeMetricsPayload = z.infer<typeof makeMetricsSchema>;

// Meta Lead via Page ID — routed by meta_page_id on organizations
// meta_page_id is optional here because it can come from query params instead
export const metaLeadSchema = z.object({
  meta_page_id: z.string().optional(),
  full_name: z.string().min(1, "full_name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export type MetaLeadPayload = z.infer<typeof metaLeadSchema>;
