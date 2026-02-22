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
import { StudioReportTab } from "@/components/staff/studio-report-tab";

export default function StaffStudioPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.organizationId as string;
  const { staffOrgIds, role, loading: orgLoading } = useOrganization();

  const isPrivileged = role === "admin" || role === "super_admin";

  const [orgName, setOrgName] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (orgLoading) return;

    // Access control: admin/super_admin can view any org; staff only assigned orgs
    if (isPrivileged) {
      setAuthorized(true);
    } else if (staffOrgIds.includes(organizationId)) {
      setAuthorized(true);
    } else {
      router.replace("/staff/studi");
      return;
    }

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
  }, [organizationId, staffOrgIds, orgLoading, router, isPrivileged]);

  if (orgLoading || authorized === null) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const backHref = isPrivileged ? "/admin/studi" : "/staff/studi";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={backHref}
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
        <TabsList className="w-full overflow-x-auto scrollbar-hide">
          <TabsTrigger value="dashboard" className="min-w-[100px]">Dashboard</TabsTrigger>
          <TabsTrigger value="analytics" className="min-w-[110px]">Analisi Lead</TabsTrigger>
          <TabsTrigger value="campaigns" className="min-w-[160px]">Campagne Marketing</TabsTrigger>
          <TabsTrigger value="report" className="min-w-[80px]">Report</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <StudioDashboardTab organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <StudioAnalyticsTab organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-6">
          <StudioCampaignsTab organizationId={organizationId} />
        </TabsContent>

        <TabsContent value="report" className="mt-6">
          <StudioReportTab organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
