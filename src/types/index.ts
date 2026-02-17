// ============================================
// Organization types
// ============================================

export type OrganizationType =
  | "agency"
  | "fisioterapia"
  | "osteopatia"
  | "olistico"
  | "estetica"
  | "altro";

export type OrganizationStatus = "pending" | "active" | "suspended" | "cancelled";

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  partita_iva: string | null;
  status: OrganizationStatus;
  approved_at: string | null;
  approved_by: string | null;
  monthly_budget: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  meta_business_id: string | null;
  meta_ad_account_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// User profile types
// ============================================

export type UserRole = "owner" | "staff" | "admin";
export type AccessLevel = "super_admin" | "admin" | "manager" | "owner";

export interface UserProfile {
  id: string;
  organization_id: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  access_level: AccessLevel;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Joined profile with organization data
export interface UserProfileWithOrg extends UserProfile {
  organizations: Pick<Organization, "id" | "name" | "type" | "status"> | null;
}

// ============================================
// User organization access (manager assignments)
// ============================================

export interface UserOrganizationAccess {
  id: string;
  user_id: string;
  organization_id: string;
  created_at: string;
}

// ============================================
// Client types
// ============================================

export type ClientStatus = "attivo" | "inattivo" | "da_ricontattare";
export type ClientSource = "meta_ads" | "google_ads" | "referral" | "organic" | "other";
export type SalesStage =
  | "new"
  | "contacted"
  | "responded"
  | "appointment_scheduled"
  | "appointment_completed"
  | "converted"
  | "lost";
export type LostReason = "disdetta" | "non_presentato" | "non_interessato" | "contatto_falso";

export interface Client {
  id: string;
  organization_id: string | null;
  nome: string;
  cognome: string;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  birth_date: string | null;
  service_interest: string | null;
  source: ClientSource | null;
  first_contact_date: string | null;
  last_contact_date: string | null;
  status: ClientStatus;
  tags: string[] | null;
  note: string | null;
  contacted_at: string | null;
  sales_stage: SalesStage;
  appointment_date: string | null;
  appointment_completed_at: string | null;
  conversion_amount: number | null;
  lost_reason: LostReason | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Campaign types
// ============================================

export type CampaignStatus = "attiva" | "in_pausa" | "completata";

export interface Campaign {
  id: string;
  organization_id: string | null;
  nome_campagna: string;
  meta_campaign_id: string | null;
  budget_mensile: number | null;
  data_inizio: string | null;
  data_fine: string | null;
  status: CampaignStatus;
  target_audience: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Campaign metrics types
// ============================================

export interface CampaignMetrics {
  id: string;
  campaign_id: string;
  date: string;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
  cpc: number | null;
  cpa: number | null;
  ctr: number | null;
  cpm: number | null;
  created_at: string;
}

// ============================================
// Communication types
// ============================================

export type CommunicationType = "call" | "email" | "meeting" | "nota";

export interface Communication {
  id: string;
  organization_id: string | null;
  client_id: string;
  tipo: CommunicationType;
  contenuto: string;
  data_comunicazione: string;
  created_by: string | null;
  created_at: string;
}

// ============================================
// Notification types
// ============================================

export type NotificationType =
  | "scadenza_contratto"
  | "budget_alert"
  | "performance_alert"
  | "nuovo_studio"
  | "approvazione"
  | "nuovo_cliente";

export interface Notification {
  id: string;
  organization_id: string | null;
  user_id: string;
  tipo: NotificationType;
  messaggio: string;
  read: boolean;
  created_at: string;
}

// ============================================
// Calendar event types
// ============================================

export interface CalendarEvent {
  id: string;
  organization_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string | null;
  client_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Appointment types
// ============================================

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no_show";

export interface Appointment {
  id: string;
  organization_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Invoice types
// ============================================

export type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  payment_date: string | null;
  payment_method: string | null;
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Admin activity log types
// ============================================

export type AdminActionType = "impersonate" | "approve_org" | "suspend_org" | "reject_org";

export interface AdminActivityLog {
  id: string;
  admin_user_id: string;
  action_type: AdminActionType;
  target_organization_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ============================================
// API Key types
// ============================================

export interface ApiKey {
  id: string;
  organization_id: string;
  key: string;
  key_prefix: string;
  label: string;
  scopes: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// Webhook log types
// ============================================

export interface WebhookLog {
  id: string;
  api_key_id: string | null;
  endpoint: string;
  status_code: number;
  request_body: Record<string, unknown> | null;
  response_body: Record<string, unknown> | null;
  error_message: string | null;
  ip_address: string | null;
  duration_ms: number | null;
  created_at: string;
}
