import { FileBarChart } from "lucide-react";

export default function ReportPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <FileBarChart className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-foreground">
        I Report saranno presto disponibili
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Questa sezione è in fase di sviluppo.
      </p>
    </div>
  );
}
