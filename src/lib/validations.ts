import { z } from "zod";

export const clientFormSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  email: z.string().min(1, "L'email è obbligatoria").email("Email non valida"),
  telefono: z.string().optional(),
  indirizzo: z.string().optional(),
  citta: z.string().optional(),
  cap: z.string().optional(),
  birth_date: z.string().optional(),
  service_interest: z.string().optional(),
  source: z.enum(["meta_ads", "google_ads", "referral", "organic", "other"]).optional(),
  status: z.enum(["attivo", "inattivo", "da_ricontattare"]),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const organizationFormSchema = z.object({
  name: z.string().min(1, "Il nome è obbligatorio"),
  email: z.string().min(1, "L'email è obbligatoria").email("Email non valida"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  type: z.enum([
    "fisioterapia",
    "osteopatia",
    "olistico",
    "estetica",
    "altro",
  ]),
  meta_page_id: z.string().optional(),
  meta_ad_account_id: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+$/.test(v), "Solo numeri"),
  monthly_budget: z.string().optional(),
  contract_start_date: z.string().optional(),
  contract_end_date: z.string().optional(),
  status: z.enum(["active", "pending", "suspended", "cancelled"]),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

export const campaignFormSchema = z.object({
  nome_campagna: z.string().min(1, "Il nome della campagna è obbligatorio"),
  budget_mensile: z.string().optional(),
  data_inizio: z.string().optional(),
  data_fine: z.string().optional(),
  status: z.enum(["attiva", "in_pausa", "completata"]),
});

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
