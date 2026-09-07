"use client";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/stores/auth-store";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <ContentContainer>
      <PageHeader
        title={`Welcome${user ? `, ${user.firstName}` : ""}`}
        description="This is your dashboard - extend it with your own workspace content."
      />
    </ContentContainer>
  );
}
