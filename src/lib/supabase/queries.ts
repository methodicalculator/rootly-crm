import { createClient } from "./client";
import type { AccessLevel } from "@/types";

/**
 * Helper generico per query filtrate per organization.
 *
 * - Se effectiveOrgId è presente, filtra per organization_id
 * - Se admin/super_admin senza impersonate (effectiveOrgId === null):
 *   non applica filtro → vede tutto
 * - Se manager senza impersonate: filtra per orgIds assegnati
 */
function getOrgFilteredQuery(
  tableName: string,
  effectiveOrgId: string | null,
  isAdmin: boolean,
  managerOrgIds?: string[],
  staffOrgIds?: string[]
) {
  const supabase = createClient();
  let query = supabase.from(tableName).select("*");

  if (effectiveOrgId) {
    // Impersonate attivo O utente studio → filtra per singola org
    query = query.eq("organization_id", effectiveOrgId);
  } else if (!isAdmin && staffOrgIds && staffOrgIds.length > 0) {
    // Staff → filtra per org assegnate
    query = query.in("organization_id", staffOrgIds);
  } else if (!isAdmin && managerOrgIds && managerOrgIds.length > 0) {
    // Manager senza impersonate → filtra per org assegnate
    query = query.in("organization_id", managerOrgIds);
  } else if (!isAdmin) {
    // Utente studio senza effectiveOrgId (fallback sicuro) → nessun dato
    query = query.eq("organization_id", "00000000-0000-0000-0000-000000000000");
  }
  // Admin/super_admin senza impersonate (effectiveOrgId === null): vede tutto

  return query;
}

// ============================================
// Query specifiche
// ============================================

export async function getClients(
  effectiveOrgId: string | null,
  isAdmin: boolean,
  managerOrgIds?: string[],
  staffOrgIds?: string[]
) {
  return getOrgFilteredQuery("clients", effectiveOrgId, isAdmin, managerOrgIds, staffOrgIds).order(
    "created_at",
    { ascending: false }
  );
}

export async function getCampaigns(
  effectiveOrgId: string | null,
  isAdmin: boolean,
  managerOrgIds?: string[],
  staffOrgIds?: string[]
) {
  return getOrgFilteredQuery("campaigns", effectiveOrgId, isAdmin, managerOrgIds, staffOrgIds).order(
    "created_at",
    { ascending: false }
  );
}

export async function getAppointmentsWithClients(
  effectiveOrgId: string | null,
  isAdmin: boolean,
  managerOrgIds?: string[],
  staffOrgIds?: string[]
) {
  const supabase = createClient();
  let query = supabase
    .from("appointments")
    .select("*, clients(nome, cognome)")
    .neq("status", "cancelled")
    .order("start_time", { ascending: true });

  if (effectiveOrgId) {
    query = query.eq("organization_id", effectiveOrgId);
  } else if (!isAdmin && staffOrgIds && staffOrgIds.length > 0) {
    query = query.in("organization_id", staffOrgIds);
  } else if (!isAdmin && managerOrgIds && managerOrgIds.length > 0) {
    query = query.in("organization_id", managerOrgIds);
  } else if (!isAdmin) {
    query = query.eq("organization_id", "00000000-0000-0000-0000-000000000000");
  }

  return query;
}

// ============================================
// Mutations
// ============================================

export async function createClientRecord(
  data: {
    nome: string;
    cognome: string;
    email?: string | null;
    telefono?: string | null;
    indirizzo?: string | null;
    citta?: string | null;
    cap?: string | null;
    birth_date?: string | null;
    service_interest?: string | null;
    source?: string | null;
    status?: string;
    note?: string | null;
    tags?: string[] | null;
  },
  organizationId: string
) {
  const supabase = createClient();
  return supabase.from("clients").insert({
    ...data,
    organization_id: organizationId,
  });
}

export async function createAppointmentRecord(
  data: {
    client_id: string;
    title: string;
    start_time: string;
    end_time: string;
    notes?: string | null;
  },
  organizationId: string
) {
  const supabase = createClient();
  return supabase.from("appointments").insert({
    ...data,
    organization_id: organizationId,
    status: "scheduled",
  });
}

export async function createCampaignRecord(
  data: {
    nome_campagna: string;
    budget_mensile?: number | null;
    data_inizio?: string | null;
    data_fine?: string | null;
    status?: string;
  },
  organizationId: string
) {
  const supabase = createClient();
  return supabase.from("campaigns").insert({
    ...data,
    organization_id: organizationId,
  });
}

// ============================================
// Organization queries (access-level aware)
// ============================================

/**
 * Carica gli org_id assegnati a un manager dalla tabella user_organization_access.
 * Ritorna array vuoto se non è manager o non ha assegnamenti.
 */
export async function getManagerOrgIds(userId: string): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("user_organization_access")
    .select("organization_id")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.organization_id);
}

/**
 * Carica gli org_id assegnati a uno staff dalla tabella staff_organizations.
 * Ritorna array vuoto se non ha assegnamenti.
 */
export async function getStaffOrgIds(userId: string): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("staff_organizations")
    .select("organization_id")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.organization_id);
}

/**
 * Recupera organizations in base al livello di accesso:
 * - super_admin / admin → tutte
 * - manager → solo quelle assegnate in user_organization_access
 * - staff → solo quelle assegnate in staff_organizations
 * - owner → solo la propria
 */
export async function getOrganizations(opts: {
  accessLevel: AccessLevel | null;
  userId: string;
  organizationId: string | null;
  status?: string;
}) {
  const supabase = createClient();
  const { accessLevel, userId, organizationId, status } = opts;

  let query = supabase
    .from("organizations")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  if (accessLevel === "super_admin" || accessLevel === "admin") {
    // Vede tutte le organizations
    return query;
  }

  if (accessLevel === "manager") {
    // Vede solo le organizations assegnate
    const orgIds = await getManagerOrgIds(userId);
    if (orgIds.length === 0) {
      return query.eq("id", "00000000-0000-0000-0000-000000000000"); // nessun risultato
    }
    return query.in("id", orgIds);
  }

  if (accessLevel === "staff") {
    // Vede solo le organizations assegnate in staff_organizations
    const orgIds = await getStaffOrgIds(userId);
    if (orgIds.length === 0) {
      return query.eq("id", "00000000-0000-0000-0000-000000000000"); // nessun risultato
    }
    return query.in("id", orgIds);
  }

  // Owner → solo la propria
  if (organizationId) {
    return query.eq("id", organizationId);
  }

  // Fallback sicuro
  return query.eq("id", "00000000-0000-0000-0000-000000000000");
}

