"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { campaignFormSchema, type CampaignFormValues } from "@/lib/validations";
import { createCampaignRecord } from "@/lib/supabase/queries";

interface CampaignFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess: () => void;
}

export function CampaignFormDialog({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
}: CampaignFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      nome_campagna: "",
      budget_mensile: "",
      data_inizio: "",
      data_fine: "",
      status: "attiva",
    },
  });

  async function onSubmit(values: CampaignFormValues) {
    setSubmitting(true);
    const { error } = await createCampaignRecord(
      {
        nome_campagna: values.nome_campagna,
        budget_mensile:
          values.budget_mensile && values.budget_mensile !== ""
            ? Number(values.budget_mensile)
            : null,
        data_inizio: values.data_inizio || null,
        data_fine: values.data_fine || null,
        status: values.status,
      },
      organizationId
    );
    setSubmitting(false);

    if (!error) {
      form.reset();
      onOpenChange(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuova Campagna</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome_campagna">Nome Campagna *</Label>
            <Input
              id="nome_campagna"
              {...form.register("nome_campagna")}
              placeholder="es. Lead Gen Fisioterapia Milano"
            />
            {form.formState.errors.nome_campagna && (
              <p className="text-xs text-red-500">
                {form.formState.errors.nome_campagna.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget_mensile">Budget Mensile (&euro;)</Label>
            <Input
              id="budget_mensile"
              type="number"
              step="0.01"
              min="0"
              {...form.register("budget_mensile")}
              placeholder="es. 500.00"
            />
            {form.formState.errors.budget_mensile && (
              <p className="text-xs text-red-500">
                {form.formState.errors.budget_mensile.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_inizio">Data Inizio</Label>
              <Input
                id="data_inizio"
                type="date"
                {...form.register("data_inizio")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_fine">Data Fine</Label>
              <Input
                id="data_fine"
                type="date"
                {...form.register("data_fine")}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/80"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva Campagna
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
