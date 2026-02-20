import type { SalesStage } from "@/types";

/**
 * Lead: contatti ancora in fase di acquisizione.
 * Include "responded" perché ha risposto ma non è ancora cliente.
 */
export const LEAD_STAGES: SalesStage[] = [
  "new",
  "contacted",
  "responded",
  "appointment_scheduled",
  "lost",
];

/**
 * Clienti: hanno completato almeno una seduta o acquistato un percorso.
 */
export const CLIENT_STAGES: SalesStage[] = [
  "appointment_completed",
  "converted",
];

/**
 * "In lavorazione": lead che hanno risposto o fissato appuntamento
 * ma non hanno ancora completato la prima seduta.
 */
export const IN_LAVORAZIONE_STAGES: SalesStage[] = [
  "contacted",
  "responded",
  "appointment_scheduled",
];

/**
 * Stage che prevedono un campo revenue (incasso).
 */
export const REVENUE_STAGES: SalesStage[] = [
  "appointment_completed",
  "converted",
];

/**
 * Ordine delle fasi nella pipeline visuale.
 */
export const STAGE_ORDER: SalesStage[] = [
  "new",
  "contacted",
  "appointment_scheduled",
  "appointment_completed",
  "converted",
  "lost",
];

/**
 * Helper: restituisce true se lo stage appartiene ai clienti.
 */
export function isClientStage(stage: SalesStage): boolean {
  return CLIENT_STAGES.includes(stage);
}

/**
 * Helper: restituisce true se lo stage appartiene ai lead.
 */
export function isLeadStage(stage: SalesStage): boolean {
  return LEAD_STAGES.includes(stage);
}
