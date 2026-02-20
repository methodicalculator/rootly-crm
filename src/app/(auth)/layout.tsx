export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center">
          <img
            src="/logo_horizon.png"
            alt="Horizon One"
            className="h-20 w-auto object-contain"
          />
          <p className="mt-1 text-sm text-muted-foreground">
            CRM per professionisti delle terapie manuali
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
