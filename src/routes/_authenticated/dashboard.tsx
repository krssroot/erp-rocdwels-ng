import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { ROLE_LABELS } from "@/lib/roles";
import { fmtNGN } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";
import { useList } from "@/lib/data";
import { FolderKanban, ClipboardList, FileSpreadsheet, ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: Dashboard,
});

function Dashboard() {
  const { user, primaryRole } = useSession();
  const projects = useList<any>("projects");
  const reqs = useList<any>("requisitions");
  const sheets = useList<any>("cost_sheets");
  const pos = useList<any>("purchase_orders");

  const totalContract = (projects.data ?? []).reduce((a, p) => a + Number(p.contract_value ?? 0), 0);
  const pendingReqs = (reqs.data ?? []).filter((r) => r.status === "Pending Approval").length;
  const activeProjects = (projects.data ?? []).filter((p) => p.status === "Active").length;

  return (
    <div>
      <PageHeader
        title={`Welcome${user?.email ? ", " + user.email.split("@")[0] : ""}`}
        description={primaryRole ? `Role: ${ROLE_LABELS[primaryRole]}` : "Waiting for role assignment from an admin"}
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FolderKanban} label="Active Projects" value={String(activeProjects)} />
        <Stat icon={FileSpreadsheet} label="Cost Sheets" value={String((sheets.data ?? []).length)} />
        <Stat icon={ClipboardList} label="Pending Requisitions" value={String(pendingReqs)} />
        <Stat icon={ShoppingCart} label="Total Contract Value" value={fmtNGN(totalContract)} />
      </div>

      <div className="grid gap-4 mt-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recent projects</CardTitle></CardHeader>
          <CardContent>
            {(projects.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              <ul className="divide-y">
                {(projects.data ?? []).slice(0, 5).map((p) => (
                  <li key={p.id} className="py-2 flex justify-between text-sm">
                    <span className="truncate">{p.name}</span>
                    <span className="text-muted-foreground">{fmtNGN(p.contract_value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent purchase orders</CardTitle></CardHeader>
          <CardContent>
            {(pos.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
            ) : (
              <ul className="divide-y">
                {(pos.data ?? []).slice(0, 5).map((p) => (
                  <li key={p.id} className="py-2 flex justify-between text-sm">
                    <span>{p.number}</span>
                    <span className="text-muted-foreground">{fmtNGN(p.total_amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary grid place-items-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
