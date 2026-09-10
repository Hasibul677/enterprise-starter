"use client";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/stores/auth-store";
import { AdminDashboardView } from "@/components/dashboard/admin-dashboard-view";

export default function AdminHomePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <ContentContainer className="max-w-[1400px]">
      <PageHeader
        title={`Welcome${user ? `, ${user.firstName}` : ""}`}
        description="An overview of users, growth, and system activity within your access scope."
      />
      <AdminDashboardView />
    </ContentContainer>
  );
}
