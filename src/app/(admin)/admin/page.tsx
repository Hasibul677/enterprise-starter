"use client";

import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { useAuthStore } from "@/stores/auth-store";

export default function AdminHomePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <ContentContainer>
      <PageHeader
        title={`Welcome${user ? `, ${user.firstName}` : ""}`}
        description="Super Admin console - manage users, roles, and menus."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Users", href: "/admin/users" },
          { label: "Roles", href: "/admin/roles" },
          { label: "Menus", href: "/admin/menus" },
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
