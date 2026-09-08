"use client";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/stores/auth-store";

export default function NormalAdminHomePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <ContentContainer>
      <PageHeader
        title={`Welcome${user ? `, ${user.firstName}` : ""}`}
        description="Normal Admin / Moderator console - a separate scope from Super Admin / Admin."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Moderators", href: "/normal-admin/users" },
          { label: "Comments", href: "/normal-admin/comments" },
          { label: "Reports", href: "/normal-admin/reports" },
        ].map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="rounded-lg border border-line bg-surface p-4 text-sm font-medium text-ink hover:border-accent"
          >
            {card.label}
          </a>
        ))}
      </div>
    </ContentContainer>
  );
}
