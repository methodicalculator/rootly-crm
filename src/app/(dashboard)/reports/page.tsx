import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  FileText,
  TrendingUp,
  Users,
  Download,
} from "lucide-react";

const reportTemplates = [
  {
    icon: TrendingUp,
    title: "Performance Campagne",
    description:
      "Report dettagliato su impressions, click, lead e CPA per tutte le campagne attive.",
  },
  {
    icon: Users,
    title: "Panoramica Clienti",
    description:
      "Stato dei contratti, scadenze imminenti e riepilogo collaborazioni attive.",
  },
  {
    icon: BarChart3,
    title: "ROI Mensile",
    description:
      "Analisi del ritorno sull&apos;investimento per cliente e per campagna.",
  },
  {
    icon: FileText,
    title: "Report Personalizzato",
    description:
      "Crea un report custom selezionando metriche, periodo e clienti specifici.",
  },
];

export default function ReportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Report</h1>
          <p className="text-muted-foreground">
            Genera report dettagliati sulle performance delle campagne.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/80">
          <Download className="mr-2 h-4 w-4" />
          Esporta Dati
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reportTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <Card
              key={template.title}
              className="cursor-pointer bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    {template.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="-mt-2">
                <p className="text-sm text-muted-foreground">{template.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 text-primary hover:bg-primary/10"
                >
                  Genera Report
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
