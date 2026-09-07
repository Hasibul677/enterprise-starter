"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ContentContainer } from "@/components/layout/content-container";
import { PageHeader } from "@/components/layout/page-header";
import { Loading } from "@/components/feedback/loading";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/components/permission/permission-guard";
import { apiClient } from "@/lib/api-client/api-client";
import { formatDate } from "@/lib/date/dayjs";

type UserDetail = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: { _id: string; name: string }[];
};

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-success-soft text-success",
  WARNING: "bg-warning-soft text-warning",
  BLOCKED: "bg-danger-soft text-danger",
  DISABLED: "bg-line text-ink-soft",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-3 last:border-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export default function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    apiClient
      .get<{ user: UserDetail }>(`/api/users/${id}`)
      .then(({ user }) => setUser(user))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load user."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <ContentContainer><Loading /></ContentContainer>;
  if (error || !user) return <ContentContainer><ErrorState message={error ?? "User not found."} /></ContentContainer>;

  return (
    <ContentContainer>
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={user.email}
        actions={
          <PermissionGuard resource="users" action="edit">
            <Link href={`/users/${user._id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
          </PermissionGuard>
        }
      />
      <div className="max-w-lg rounded-lg border border-line bg-surface p-4">
        <Row label="Status" value={<span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[user.status]}`}>{user.status}</span>} />
        <Row label="Email verified" value={user.emailVerified ? "Yes" : "No"} />
        <Row label="Roles" value={user.roles.map((r) => r.name).join(", ") || "None"} />
        <Row label="Last login" value={user.lastLoginAt ? formatDate(user.lastLoginAt, "MMM D, YYYY HH:mm") : "Never"} />
        <Row label="Joined" value={formatDate(user.createdAt, "MMM D, YYYY")} />
      </div>
      <div className="mt-4">
        <Button variant="secondary" onClick={() => router.push("/admin/users")}>Back to users</Button>
      </div>
    </ContentContainer>
  );
}
