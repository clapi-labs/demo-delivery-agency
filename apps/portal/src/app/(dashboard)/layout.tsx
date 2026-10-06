import { AppShell } from "@/components/AppShell";
import { TripsProvider } from "@/components/TripsProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TripsProvider>
      <AppShell>{children}</AppShell>
    </TripsProvider>
  );
}
