import type {
  ClientStatus,
  ClientSource,
  SalesStage,
  LostReason,
  CampaignStatus,
  CommunicationType,
  OrganizationType,
  OrganizationStatus,
  AppointmentStatus,
  InvoiceStatus,
} from "@/types";

// ============================================
// Client config
// ============================================

export const CLIENT_STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; color: string }
> = {
  attivo: { label: "Attivo", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  inattivo: { label: "Inattivo", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300" },
  da_ricontattare: { label: "Da Ricontattare", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
};

export const CLIENT_SOURCE_CONFIG: Record<
  ClientSource,
  { label: string; color: string }
> = {
  meta_ads: { label: "Meta Ads", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  google_ads: { label: "Google Ads", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  referral: { label: "Referral", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  organic: { label: "Organico", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  other: { label: "Altro", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300" },
};

// ============================================
// Sales pipeline config
// ============================================

export const SALES_STAGE_CONFIG: Record<
  SalesStage,
  { label: string; emoji: string; color: string }
> = {
  new: { label: "Nuovo Lead", emoji: "🆕", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300" },
  contacted: { label: "Non Risponde", emoji: "🔕", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  responded: { label: "Ha Risposto", emoji: "💬", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  appointment_scheduled: { label: "Appuntamento Fissato", emoji: "📅", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  appointment_completed: { label: "Singola Seduta", emoji: "💆", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  converted: { label: "Percorso Acquistato", emoji: "💰", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  lost: { label: "Perso", emoji: "❌", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

export const LOST_REASON_CONFIG: Record<
  LostReason,
  { label: string }
> = {
  disdetta: { label: "Disdetta" },
  non_presentato: { label: "Non Presentato" },
  non_interessato: { label: "Non Interessato" },
  contatto_falso: { label: "Contatto Falso" },
};

// ============================================
// Campaign config
// ============================================

export const CAMPAIGN_STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; color: string }
> = {
  attiva: { label: "Attiva", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  in_pausa: { label: "In Pausa", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  completata: { label: "Completata", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300" },
};

// ============================================
// Communication config
// ============================================

export const COMMUNICATION_TYPE_CONFIG: Record<
  CommunicationType,
  { label: string; color: string }
> = {
  call: { label: "Chiamata", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  email: { label: "Email", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  meeting: { label: "Meeting", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  nota: { label: "Nota", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300" },
};

// ============================================
// Organization config
// ============================================

export const ORGANIZATION_TYPE_CONFIG: Record<
  OrganizationType,
  { label: string; color: string }
> = {
  agency: { label: "Agenzia", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  fisioterapia: { label: "Fisioterapista", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  osteopatia: { label: "Osteopata", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  olistico: { label: "Olistico", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
  estetica: { label: "Estetica", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  altro: { label: "Altro", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300" },
};

export const ORGANIZATION_STATUS_CONFIG: Record<
  OrganizationStatus,
  { label: string; color: string }
> = {
  pending: { label: "In Attesa", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  active: { label: "Attivo", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  suspended: { label: "Sospeso", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  cancelled: { label: "Cancellato", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300" },
};

// ============================================
// Appointment config
// ============================================

export const APPOINTMENT_STATUS_CONFIG: Record<
  AppointmentStatus,
  { label: string; color: string }
> = {
  scheduled: { label: "Confermato", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  completed: { label: "Completato", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  cancelled: { label: "Annullato", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  no_show: { label: "Non presentato", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300" },
};

// ============================================
// Invoice config
// ============================================

export const INVOICE_STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; color: string }
> = {
  pending: { label: "In Attesa", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  paid: { label: "Pagata", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  overdue: { label: "Scaduta", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  cancelled: { label: "Annullata", color: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300" },
};

// ============================================
// Navigation
// ============================================

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" as const },
  { href: "/clients", label: "Lead", icon: "Users" as const },
  { href: "/analytics", label: "Analisi Lead", icon: "TrendingUp" as const },
  { href: "/campaigns", label: "Campagne Marketing", icon: "Megaphone" as const },
  { href: "/calendar", label: "Calendario", icon: "Calendar" as const },
  { href: "/reports", label: "Report", icon: "BarChart3" as const },
] as const;

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard Aggregata", icon: "LayoutDashboard" as const },
  { href: "/admin/studi", label: "Gestione Studi", icon: "Building2" as const },
  { href: "/admin/approvazioni", label: "Approvazioni", icon: "ClipboardCheck" as const },
] as const;
