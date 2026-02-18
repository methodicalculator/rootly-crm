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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import { clientFormSchema, type ClientFormValues } from "@/lib/validations";
import { createClientRecord } from "@/lib/supabase/queries";

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
  const [tagInput, setTagInput] = useState("");

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
      service_interest: undefined,
      source: undefined,
      note: "",
      status: "attivo",
      tags: [],
    },
  });

  const tags = form.watch("tags") ?? [];

  function addTag(value: string) {
    const trimmed = value.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    form.setValue("tags", [...tags, trimmed]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    form.setValue(
      "tags",
      tags.filter((t) => t !== tag)
    );
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

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
        source: values.source || null,
        status: values.status,
        note: values.note || null,
        tags: values.tags && values.tags.length > 0 ? values.tags : null,
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
    setTagInput("");
    onOpenChange(false);
    onSuccess();
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      form.reset();
      setTagInput("");
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
              <Label htmlFor="telefono">Telefono</Label>
              <Input id="telefono" {...form.register("telefono")} />
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
              <Label htmlFor="citta">Città</Label>
              <Input id="citta" {...form.register("citta")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cap">CAP</Label>
              <Input id="cap" {...form.register("cap")} maxLength={5} />
            </div>
          </div>

          {/* Servizio di interesse / Fonte */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Servizio di Interesse</Label>
              <Select
                value={form.watch("service_interest") ?? ""}
                onValueChange={(val) => form.setValue("service_interest", val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fisioterapia">Fisioterapia</SelectItem>
                  <SelectItem value="Osteopatia">Osteopatia</SelectItem>
                  <SelectItem value="Massoterapia">Massoterapia</SelectItem>
                  <SelectItem value="Riflessologia">Riflessologia</SelectItem>
                  <SelectItem value="Altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fonte Lead</Label>
              <Select
                value={form.watch("source") ?? ""}
                onValueChange={(val) =>
                  form.setValue("source", val as ClientFormValues["source"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta_ads">Meta Ads</SelectItem>
                  <SelectItem value="google_ads">Google Ads</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="organic">Organico</SelectItem>
                  <SelectItem value="other">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea id="note" {...form.register("note")} rows={3} />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-full hover:bg-muted"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => addTag(tagInput)}
                placeholder={tags.length === 0 ? "es. lombalgia, urgente..." : ""}
                className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Premi Invio o virgola per aggiungere un tag
            </p>
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
