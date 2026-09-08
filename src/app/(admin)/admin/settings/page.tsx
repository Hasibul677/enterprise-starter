import { ResourceStubView } from "@/components/layout/resource-stub-view";

export default function SettingsPage() {
  return (
    <ResourceStubView
      title="System Settings"
      description="Global configuration for the Super Admin / Admin area."
      endpoint="/api/settings"
    />
  );
}
