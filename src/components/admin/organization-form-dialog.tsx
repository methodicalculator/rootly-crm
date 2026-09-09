"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Eye, EyeOff } from "lucide-react";
import {
  organizationFormSchema,
  type OrganizationFormValues,
} from "@/lib/validations";
import { createClient } from "@/lib/supabase/client";
import { ORGANIZATION_TYPE_CONFIG } from "@/lib/constants";
import type { Organization, OrganizationType } from "@/types";

interface OrganizationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (createdOrgId?: string) => void;
  editingOrg?: Organization | null;
  prefillData?: Partial<OrganizationFormValues> | null;
}

const ORG_TYPES = (
  Object.keys(ORGANIZATION_TYPE_CONFIG) as OrganizationType[]
).filter((t) => t !== "agency");

const EMPTY_FORM: OrganizationFormValues = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  type: "fisioterapia",
  meta_page_id: "",
  meta_ad_account_id: "",
  meta_page_access_token: "",
  monthly_budget: "",
  contract_start_date: "",
  contract_end_date: "",
  status: "active",
};

export function OrganizationFormDialog({
  open,
  onOpenChange,
  onSuccess,
  editingOrg,
  prefillData,
}: OrganizationFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const isEditing = !!editingOrg;

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (open && editingOrg) {
      form.reset({
        name: editingOrg.owner_name || editingOrg.name,
        email: editingOrg.email ?? "",
        phone: editingOrg.phone ?? "",
        address: editingOrg.address ?? "",
        city: editingOrg.city ?? "",
        province: editingOrg.province ?? "",
        type: (editingOrg.type === "agency" ? "altro" : editingOrg.type) as OrganizationFormValues["type"],
        meta_page_id: editingOrg.meta_page_id ?? "",
        meta_ad_account_id: editingOrg.meta_ad_account_id ?? "",
        meta_page_access_token: editingOrg.meta_page_access_token ?? "",
        monthly_budget: editingOrg.monthly_budget
          ? String(editingOrg.monthly_budget)
          : "",
        contract_start_date: editingOrg.contract_start_date ?? "",
        contract_end_date: editingOrg.contract_end_date ?? "",
        status: editingOrg.status as OrganizationFormValues["status"],
      });
    } else if (open && prefillData) {
      form.reset({ ...EMPTY_FORM, ...prefillData });
    } else if (open) {
      form.reset(EMPTY_FORM);
    }
  }, [open, editingOrg, prefillData, form]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      form.reset(EMPTY_FORM);
    }
    onOpenChange(nextOpen);
  }

  async function onSubmit(values: OrganizationFormValues) {
    setSubmitting(true);
    try {
      const supabase = createClient();

      const payload = {
        name: values.name,
        owner_name: values.name,
        email: values.email,
        phone: values.phone || null,
        address: values.address || null,
        city: values.city || null,
        province: values.province || null,
        type: values.type,
        meta_page_id: values.meta_page_id || null,
        meta_ad_account_id: values.meta_ad_account_id || null,
        meta_page_access_token: values.meta_page_access_token || null,
        monthly_budget: values.monthly_budget
          ? parseFloat(values.monthly_budget)
          : null,
        contract_start_date: values.contract_start_date || null,
        contract_end_date: values.contract_end_date || null,
        status: values.status,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("organizations")
          .update(payload)
          .eq("id", editingOrg.id);

        if (error) {
          toast.error("Errore durante l'aggiornamento");
          return;
        }
        toast.success("Studio aggiornato con successo!");
        handleOpenChange(false);
        onSuccess();
      } else {
        const { data: created, error } = await supabase
          .from("organizations")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          toast.error("Errore durante la creazione");
          return;
        }
        if (!prefillData) {
          toast.success("Studio creato con successo!");
        }
        handleOpenChange(false);
        onSuccess(created?.id);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifica Studio" : "Nuovo Studio"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome + Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="es: Dr. Marco Rossi, Studio FisioVita"
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nome del professionista o dello studio
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipologia *</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) =>
                  form.setValue("type", v as OrganizationFormValues["type"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ORGANIZATION_TYPE_CONFIG[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Email + Telefono */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefono</Label>
              <Input id="phone" {...form.register("phone")} />
            </div>
          </div>

          {/* Indirizzo */}
          <div className="space-y-1.5">
            <Label htmlFor="address">Indirizzo</Label>
            <Input id="address" {...form.register("address")} />
          </div>

          {/* Città + Provincia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">Città</Label>
              <Input id="city" {...form.register("city")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="province">Provincia</Label>
              <Input
                id="province"
                maxLength={2}
                className="uppercase"
                {...form.register("province")}
              />
            </div>
          </div>

          {/* Meta Integration */}
          <div className="space-y-1.5">
            <Label htmlFor="meta_page_id">Facebook Page ID</Label>
            <Input
              id="meta_page_id"
              placeholder="es: 123456789012345"
              {...form.register("meta_page_id")}
            />
            <p className="text-xs text-muted-foreground">
              Necessario per il routing automatico con Zapier e Make
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meta_page_access_token">Page Access Token</Label>
            <div className="relative">
              <Input
                id="meta_page_access_token"
                type={showToken ? "text" : "password"}
                placeholder="Token di accesso della pagina"
                {...form.register("meta_page_access_token")}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Token di lunga durata per la pagina Facebook
            </p>
          </div>

          {/* Budget + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthly_budget">Budget Mensile (&euro;)</Label>
              <Input
                id="monthly_budget"
                type="number"
                step="0.01"
                min="0"
                {...form.register("monthly_budget")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(v) =>
                  form.setValue(
                    "status",
                    v as OrganizationFormValues["status"],
                    { shouldValidate: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Attivo</SelectItem>
                  <SelectItem value="pending">In Attesa</SelectItem>
                  <SelectItem value="suspended">Sospeso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date contratto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contract_start_date">Inizio Contratto</Label>
              <Input
                id="contract_start_date"
                type="date"
                {...form.register("contract_start_date")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contract_end_date">Fine Contratto</Label>
              <Input
                id="contract_end_date"
                type="date"
                {...form.register("contract_end_date")}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Salva Modifiche" : "Crea Studio"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
