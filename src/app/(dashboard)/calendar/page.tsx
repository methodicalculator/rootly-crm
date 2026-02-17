import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";

const eventLegend = [
  { color: "bg-[#EF4444]", label: "Scadenze contratto" },
  { color: "bg-[#F89627]", label: "Check-in clienti" },
  { color: "bg-[#F59E0B]", label: "Deadline campagne" },
  { color: "bg-[#10B981]", label: "Call / Meeting" },
];

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Calendario
          </h1>
          <p className="text-muted-foreground">
            Visualizza e gestisci i tuoi appuntamenti e scadenze.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/80">
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Evento
        </Button>
      </div>

      <Card className="bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Calendar className="h-5 w-5 text-primary" />
              Calendario
            </CardTitle>
            <div className="flex items-center gap-4">
              {eventLegend.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className={`inline-block h-3 w-3 rounded-full ${item.color}`} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Calendario in arrivo
            </h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
              Il calendario interattivo sara&apos; disponibile nella prossima fase.
              Potrai gestire check-in, scadenze e appuntamenti con i clienti.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
