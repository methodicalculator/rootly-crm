"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { SALES_STAGE_CONFIG, LOST_REASON_CONFIG } from "@/lib/constants";
import type { SalesStage, LostReason } from "@/types";

interface SalesPipelineSelectProps {
  clientId: string;
  currentStage: SalesStage;
  onStageChange: (newStage: SalesStage) => void;
}

const STAGE_ORDER: SalesStage[] = [
  "new",
  "contacted",
  "responded",
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
  onStageChange,
}: SalesPipelineSelectProps) {
  const [updating, setUpdating] = useState(false);
  const [showLostReason, setShowLostReason] = useState(false);

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

  if (updating) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Aggiornando...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={currentStage} onValueChange={handleStageSelect}>
        <SelectTrigger size="sm" className="h-7 gap-1.5 text-xs font-medium">
          <SelectValue>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${stageCfg.color}`}>
              <span>{stageCfg.emoji}</span>
              <span>{stageCfg.label}</span>
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
    </div>
  );
}
