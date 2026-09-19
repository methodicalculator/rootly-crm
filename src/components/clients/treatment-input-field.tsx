'use client';

import { useEffect, useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface TreatmentInputFieldProps {
  value: string;
  onChange: (value: string) => void;
  organizationId: string;
  /** Whether to fetch suggestions (e.g. only when a dialog is open) */
  active?: boolean;
  /** Label size variant */
  labelClassName?: string;
}

export function TreatmentInputField({
  value,
  onChange,
  organizationId,
  active = true,
  labelClassName = "text-xs",
}: TreatmentInputFieldProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!active) return;
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
  }, [active, organizationId]);

  const filteredSuggestions = value.trim()
    ? suggestions.filter((s) =>
        s.toLowerCase().includes(value.trim().toLowerCase())
      )
    : [];

  function selectSuggestion(selected: string) {
    const trimmed = selected.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setShowSuggestions(false);
  }

  return (
    <div className="space-y-1.5">
      <Label className={labelClassName}>Trattamento Richiesto</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
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
                  selectSuggestion(suggestion);
                  inputRef.current?.focus();
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
  );
}
