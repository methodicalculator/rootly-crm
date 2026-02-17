"use client";

import { AlertTriangle, X } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

export function ImpersonateBanner() {
  const { impersonatingOrgId, organization, stopImpersonate } =
    useOrganization();

  if (!impersonatingOrgId) return null;

  return (
    <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800 px-4 py-2 lg:px-6">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          MODALITA SUPPORTO: Stai visualizzando come{" "}
          <strong>{organization?.name ?? "Studio"}</strong>
        </span>
      </div>
      <button
        onClick={stopImpersonate}
        className="flex items-center gap-1 rounded-md bg-amber-200 dark:bg-amber-800 px-3 py-1 text-xs font-medium text-amber-900 dark:text-amber-100 transition-colors hover:bg-amber-300 dark:hover:bg-amber-700"
      >
        <X className="h-3 w-3" />
        Esci
      </button>
    </div>
  );
}
