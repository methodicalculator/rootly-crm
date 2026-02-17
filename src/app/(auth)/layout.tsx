export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Horizon One</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRM per professionisti delle terapie manuali
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
