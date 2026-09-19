'use client';

import { useState, useEffect, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { clientFormSchema, type ClientFormValues } from "@/lib/validations";
import { createClientRecord } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess: () => void;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
}: ClientFormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [treatmentInput, setTreatmentInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const treatmentInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      telefono: "",
      birth_date: "",
      service_interest: "",
      note: "",
      status: "attivo",
    },
  });

  // Fetch distinct service_interest values used by this organization
  useEffect(() => {
    if (!open) return;
    async function fetchSuggestions() {
      const supabase = createClient();
      const { data } = await supabase
        .from("clients")
        .select("service_interest")
        .eq("organization_id", organizationId)
        .not("service_interest", "is", null);

      if (!data) return;

      const unique = new Set<string>();
      for (const row of data) {
        if (row.service_interest) unique.add(row.service_interest);
      }
      setSuggestions(Array.from(unique).sort((a, b) => a.localeCompare(b)));
    }
    fetchSuggestions();
  }, [open, organizationId]);

  const filteredSuggestions = treatmentInput.trim()
    ? suggestions.filter((s) =>
        s.toLowerCase().includes(treatmentInput.trim().toLowerCase())
      )
    : [];

  function selectTreatment(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    form.setValue("service_interest", trimmed);
    setTreatmentInput(trimmed);
    setShowSuggestions(false);
  }

  async function onSubmit(values: ClientFormValues) {
    setSubmitting(true);
    const { error } = await createClientRecord(
      {
        nome: values.nome,
        cognome: values.cognome,
        email: values.email || null,
        telefono: values.telefono || null,
        birth_date: values.birth_date || null,
        service_interest: values.service_interest || null,
        status: values.status,
        note: values.note || null,
      },
      organizationId
    );
    setSubmitting(false);

    if (error) {
      toast.error("Errore nella creazione del cliente", {
        description: error.message,
      });
      return;
    }

    toast.success("Lead creato!");
    form.reset();
    setTreatmentInput("");
    onOpenChange(false);
    onSuccess();
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      form.reset();
      setTreatmentInput("");
      setShowSuggestions(false);
    }
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuovo Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome / Cognome */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" {...form.register("nome")} />
              {form.formState.errors.nome && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.nome.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cognome">Cognome *</Label>
              <Input id="cognome" {...form.register("cognome")} />
              {form.formState.errors.cognome && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.cognome.message}
                </p>
              )}
            </div>
          </div>

          {/* Email / Telefono */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Telefono *</Label>
              <Input id="telefono" {...form.register("telefono")} />
              {form.formState.errors.telefono && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.telefono.message}
                </p>
              )}
            </div>
          </div>

          {/* Data di nascita */}
          <div className="space-y-2">
            <Label htmlFor="birth_date">Data di Nascita</Label>
            <Input
              id="birth_date"
              type="date"
              {...form.register("birth_date")}
            />
          </div>

          {/* Trattamento Richiesto */}
          <div className="space-y-2">
            <Label>Trattamento Richiesto</Label>
            <div className="relative">
              <Input
                ref={treatmentInputRef}
                value={treatmentInput}
                onChange={(e) => {
                  setTreatmentInput(e.target.value);
                  form.setValue("service_interest", e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                placeholder="es. lombalgia, massaggio rilassante..."
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {filteredSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectTreatment(suggestion);
                        treatmentInputRef.current?.focus();
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Digita il trattamento richiesto. I valori già usati compariranno come suggerimenti.
            </p>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" {...form.register("note")} rows={3} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/80"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
