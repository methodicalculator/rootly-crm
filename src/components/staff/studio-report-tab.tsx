"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface StudioReportTabProps {
  organizationId: string;
}

export function StudioReportTab({ organizationId: _organizationId }: StudioReportTabProps) {
  return (
    <Card className="bg-card shadow-sm">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">
          Report disponibili a breve
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          La sezione report con funzionalità di download sarà disponibile prossimamente.
        </p>
      </CardContent>
    </Card>
  );
}
