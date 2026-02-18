"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AccessLevel, Organization } from "@/types";

const LS_KEY = "horizon_impersonating_org_id";

type OrganizationSummary = Pick<Organization, "id" | "name" | "type" | "status">;

interface OrganizationContextType {
  organizationId: string | null;
  organization: OrganizationSummary | null;
  userId: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  accessLevel: AccessLevel | null;
  canImpersonate: boolean;
  loading: boolean;
  impersonatingOrgId: string | null;
  /** Org IDs assegnati al manager (vuoto per altri ruoli) */
  managerOrgIds: string[];
  startImpersonate: (orgId: string) => Promise<void>;
  stopImpersonate: () => void;
  /** organization_id effettivo da usare nelle query (impersonate se attivo, altrimenti proprio) */
  effectiveOrgId: string | null;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizationId: null,
  organization: null,
  userId: null,
  isAdmin: false,
  isSuperAdmin: false,
  accessLevel: null,
  canImpersonate: false,
  loading: true,
  impersonatingOrgId: null,
  managerOrgIds: [],
  startImpersonate: async () => {},
  stopImpersonate: () => {},
  effectiveOrgId: null,
});

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [accessLevel, setAccessLevel] = useState<AccessLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatingOrgId, setImpersonatingOrgId] = useState<string | null>(null);
  const [managerOrgIds, setManagerOrgIds] = useState<string[]>([]);

  const canImpersonate = isSuperAdmin;

  // effectiveOrgId: per admin/super_admin non in impersonate → null (vede tutto),
  // per admin in impersonate → orgId dello studio, per utente studio → la propria org
  const effectiveOrgId = isAdmin || isSuperAdmin ? impersonatingOrgId : organizationId;

  useEffect(() => {
    const loadUserOrganization = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);

        const { data: profile, error: profileError } = await supabase
          .from("user_profiles")
          .select("organization_id, is_admin, is_super_admin, access_level, organizations(id, name, type, status)")
          .eq("id", user.id)
          .single();

        // DEBUG — remove after fixing
        console.log("[ORG CONTEXT DEBUG]", {
          userId: user.id,
          userEmail: user.email,
          profile: profile ? {
            organization_id: profile.organization_id,
            is_admin: profile.is_admin,
            is_super_admin: profile.is_super_admin,
            access_level: profile.access_level,
          } : null,
          profileError: profileError?.message ?? null,
        });

        if (profile) {
          setOrganizationId(profile.organization_id);
          const superAdmin = profile.is_super_admin ?? false;
          const admin = superAdmin || (profile.is_admin ?? false);
          const level = (profile.access_level as AccessLevel) ?? null;
          setIsSuperAdmin(superAdmin);
          setIsAdmin(admin);
          setAccessLevel(level);

          const org = profile.organizations as unknown as OrganizationSummary | null;
          setOrganization(org);

          // Carica org assegnate per manager
          if (level === "manager") {
            const { data: accessRows } = await supabase
              .from("user_organization_access")
              .select("organization_id")
              .eq("user_id", user.id);
            setManagerOrgIds((accessRows ?? []).map((r) => r.organization_id));
          }

          // Ripristina impersonation da localStorage (solo super admin)
          if (superAdmin) {
            const storedOrgId = localStorage.getItem(LS_KEY);
            if (storedOrgId) {
              setImpersonatingOrgId(storedOrgId);
              const { data: impOrg } = await supabase
                .from("organizations")
                .select("id, name, type, status")
                .eq("id", storedOrgId)
                .single();
              if (impOrg) {
                setOrganization(impOrg as OrganizationSummary);
              } else {
                localStorage.removeItem(LS_KEY);
                setImpersonatingOrgId(null);
              }
            }
          }
        }
      }

      setLoading(false);
    };

    loadUserOrganization();
  }, []);

  const startImpersonate = useCallback(
    async (orgId: string) => {
      if (!canImpersonate) return;

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from("admin_activity_log").insert({
          admin_user_id: user.id,
          action_type: "impersonate",
          target_organization_id: orgId,
          details: { started_at: new Date().toISOString() },
        });
      }

      setImpersonatingOrgId(orgId);
      localStorage.setItem(LS_KEY, orgId);

      const { data: impOrg } = await supabase
        .from("organizations")
        .select("id, name, type, status")
        .eq("id", orgId)
        .single();

      if (impOrg) {
        setOrganization(impOrg as OrganizationSummary);
      }

      router.push("/dashboard");
    },
    [canImpersonate, router]
  );

  const stopImpersonate = useCallback(() => {
    setImpersonatingOrgId(null);
    localStorage.removeItem(LS_KEY);

    if (organizationId) {
      const supabase = createClient();
      supabase
        .from("organizations")
        .select("id, name, type, status")
        .eq("id", organizationId)
        .single()
        .then(({ data }) => {
          if (data) setOrganization(data as OrganizationSummary);
        });
    }

    router.push("/admin");
  }, [organizationId, router]);

  return (
    <OrganizationContext.Provider
      value={{
        organizationId,
        organization,
        userId,
        isAdmin,
        isSuperAdmin,
        accessLevel,
        canImpersonate,
        loading,
        impersonatingOrgId,
        managerOrgIds,
        startImpersonate,
        stopImpersonate,
        effectiveOrgId,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => useContext(OrganizationContext);
