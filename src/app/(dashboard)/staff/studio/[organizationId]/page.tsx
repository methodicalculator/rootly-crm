"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/contexts/OrganizationContext";
import { createClient } from "@/lib/supabase/client";
import { StudioDashboardTab } from "@/components/staff/studio-dashboard-tab";
import { StudioCampaignsTab } from "@/components/staff/studio-campaigns-tab";
import { StudioAnalyticsTab } from "@/components/staff/studio-analytics-tab";

export default function StaffStudioPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.organizationId as string;
  const { staffOrgIds, loading: orgLoading } = useOrganization();

  const [orgName, setOrgName] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (orgLoading) return;

    // Access control: staff can only see assigned orgs
    if (!staffOrgIds.includes(organizationId)) {
      router.replace("/staff/studi");
      return;
    }

    setAuthorized(true);

    // Fetch org name
    async function fetchOrgName() {
      const supabase = createClient();
      const { data } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .single();
      setOrgName(data?.name ?? null);
    }

    fetchOrgName();
  }, [organizationId, staffOrgIds, orgLoading, router]);

  if (orgLoading || authorized === null) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/staff/studi"
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna a Gestione Studi
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {orgName ?? "Studio"}
        </h1>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="campaigns">Campagne Marketing</TabsTrigger>
          <TabsTrigger value="analytics">Analisi Lead</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <StudioDashboardTab organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <StudioCampaignsTab organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <StudioAnalyticsTab organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
