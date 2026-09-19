'use client';

import { useState } from "react";
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
import { TreatmentInputField } from "@/components/clients/treatment-input-field";

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

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      telefono: "",
      indirizzo: "",
      citta: "",
      cap: "",
      birth_date: "",
      service_interest: "",
      note: "",
      status: "attivo",
    },
  });

  async function onSubmit(values: ClientFormValues) {
    setSubmitting(true);
    const { error } = await createClientRecord(
      {
        nome: values.nome,
        cognome: values.cognome,
        email: values.email || null,
        telefono: values.telefono || null,
        indirizzo: values.indirizzo || null,
        citta: values.citta || null,
        cap: values.cap || null,
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

          {/* Indirizzo */}
          <div className="space-y-2">
            <Label htmlFor="indirizzo">Indirizzo</Label>
            <Input id="indirizzo" {...form.register("indirizzo")} />
          </div>

          {/* Città / CAP */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="citta">Citt&agrave;</Label>
              <Input id="citta" {...form.register("citta")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cap">CAP</Label>
              <Input id="cap" {...form.register("cap")} maxLength={5} />
            </div>
          </div>

          {/* Trattamento Richiesto */}
          <TreatmentInputField
            value={treatmentInput}
            onChange={(val) => {
              setTreatmentInput(val);
              form.setValue("service_interest", val);
            }}
            organizationId={organizationId}
            active={open}
          />

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
