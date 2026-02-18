"use client";

import { useState, useRef, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { SALES_STAGE_CONFIG, LOST_REASON_CONFIG } from "@/lib/constants";
import type { SalesStage, LostReason } from "@/types";

const MOBILE_LABELS: Partial<Record<SalesStage, string>> = {
  appointment_scheduled: "App. Fissato",
  appointment_completed: "Singola Sed.",
  converted: "Percorso Acq.",
};

const REVENUE_STAGES: SalesStage[] = ["appointment_completed", "converted"];

interface SalesPipelineSelectProps {
  clientId: string;
  currentStage: SalesStage;
  currentRevenue?: number | null;
  onStageChange: (newStage: SalesStage) => void;
}

const STAGE_ORDER: SalesStage[] = [
  "new",
  "contacted",
  "appointment_scheduled",
  "appointment_completed",
  "converted",
  "lost",
];

const LOST_REASONS: LostReason[] = [
  "disdetta",
  "non_presentato",
  "non_interessato",
  "contatto_falso",
];

export function SalesPipelineSelect({
  clientId,
  currentStage,
  currentRevenue,
  onStageChange,
}: SalesPipelineSelectProps) {
  const [updating, setUpdating] = useState(false);
  const [showLostReason, setShowLostReason] = useState(false);
  const [revenueValue, setRevenueValue] = useState(
    currentRevenue != null ? String(currentRevenue) : ""
  );
  const [revenueSaved, setRevenueSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(null);

  // Sync if parent prop changes
  useEffect(() => {
    setRevenueValue(currentRevenue != null ? String(currentRevenue) : "");
  }, [currentRevenue]);
  async function updateStage(
    newStage: SalesStage,
    lostReason?: LostReason
  ) {
    setUpdating(true);
    try {
      const supabase = createClient();

      const now = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: Record<string, any> = {
        sales_stage: newStage,
        stage_changed_at: now,
      };

      if (newStage === "contacted") {
        updates.contacted_at = now;
      }
      if (newStage === "appointment_scheduled") {
        updates.appointment_date = now;
      }
      if (newStage === "appointment_completed") {
        updates.appointment_completed_at = now;
      }
      if (newStage === "lost") {
        updates.lost_reason = lostReason ?? null;
      }

      // Azzera revenue per stage senza incasso
      if (!REVENUE_STAGES.includes(newStage)) {
        updates.revenue = null;
      }

      const { error } = await supabase
        .from("clients")
        .update(updates)
        .eq("id", clientId);

      if (error) {
        toast.error("Errore durante l'aggiornamento");
        return;
      }

      const cfg = SALES_STAGE_CONFIG[newStage];
      toast.success(`${cfg.emoji} Stato aggiornato: ${cfg.label}`);
      onStageChange(newStage);
    } finally {
      setUpdating(false);
      setShowLostReason(false);
    }
  }

  function handleStageSelect(value: string) {
    const stage = value as SalesStage;
    if (stage === currentStage) return;

    if (stage === "lost") {
      setShowLostReason(true);
      return;
    }

    setShowLostReason(false);
    updateStage(stage);
  }

  function handleLostReasonSelect(value: string) {
    updateStage("lost", value as LostReason);
  }

  const stageCfg = SALES_STAGE_CONFIG[currentStage];
  const mobileLabel = MOBILE_LABELS[currentStage];

  if (updating) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Aggiornando...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <Select value={currentStage} onValueChange={handleStageSelect}>
        <SelectTrigger size="sm" className="h-7 gap-1.5 text-xs font-medium">
          <SelectValue>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${stageCfg.color}`}>
              <span>{stageCfg.emoji}</span>
              {mobileLabel ? (
                <>
                  <span className="sm:hidden">{mobileLabel}</span>
                  <span className="hidden sm:inline">{stageCfg.label}</span>
                </>
              ) : (
                <span>{stageCfg.label}</span>
              )}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {STAGE_ORDER.map((stage) => {
            const cfg = SALES_STAGE_CONFIG[stage];
            return (
              <SelectItem key={stage} value={stage}>
                <span className="flex items-center gap-2">
                  <span>{cfg.emoji}</span>
                  <span>{cfg.label}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {showLostReason && (
        <Select onValueChange={handleLostReasonSelect}>
          <SelectTrigger size="sm" className="h-7 gap-1.5 text-xs font-medium border-red-200 dark:border-red-800">
            <SelectValue placeholder="Motivo..." />
          </SelectTrigger>
          <SelectContent position="popper" align="start">
            {LOST_REASONS.map((reason) => (
              <SelectItem key={reason} value={reason}>
                {LOST_REASON_CONFIG[reason].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {REVENUE_STAGES.includes(currentStage) && (
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              &euro;
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={revenueValue}
              placeholder="Importo"
              className="h-7 w-[100px] rounded-md border border-border bg-background pl-6 pr-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setRevenueValue(v);
              }}
              onBlur={async () => {
                const parsed = revenueValue ? parseInt(revenueValue, 10) : null;
                if (parsed === currentRevenue) return;
                const supabase = createClient();
                const { error } = await supabase
                  .from("clients")
                  .update({ revenue: parsed })
                  .eq("id", clientId);
                if (error) {
                  toast.error("Errore salvataggio compenso");
                  return;
                }
                setRevenueSaved(true);
                if (savedTimer.current) clearTimeout(savedTimer.current);
                savedTimer.current = setTimeout(() => setRevenueSaved(false), 2000);
              }}
            />
          </div>
          {revenueSaved && (
            <Check className="h-3.5 w-3.5 text-green-500" />
          )}
        </div>
      )}

    </div>
  );
}
