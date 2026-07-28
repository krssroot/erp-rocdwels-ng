import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNGN, ROLE_LABELS } from "@/lib/roles";
import { useSession } from "@/hooks/use-session";
import { FolderKanban, FileSpreadsheet, ClipboardList, CheckCircle2 } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: AdminDashboard,
});

const PURPLE = "hsl(272 72% 47%)";
const STATUS_COLORS: Record<string, string> = {
  Active: "hsl(272 72% 47%)",
  Completed: "hsl(142 71% 45%)",
  "On Hold": "hsl(38 92% 50%)",
  Handover: "hsl(217 91% 60%)",
};

function num(v: any) { return Number(v ?? 0); }
function monthKey(d: Date) { return d.toLocaleString("en-US", { month: "short", year: "2-digit" }); }

function AdminDashboard() {
  const { user, primaryRole } = useSession();

  const { data: projects = [] } = useQuery({
    queryKey: ["dash_projects"],
    queryFn: async () => (await supabase.from("projects").select("*").is("deleted_at", null)).data ?? [],
  });
  const { data: sheets = [] } = useQuery({
    queryKey: ["dash_sheets"],
    queryFn: async () => (await supabase.from("cost_sheets").select("id,project_id,status,created_at,sheet_date").is("deleted_at", null)).data ?? [],
  });
  const { data: matLines = [] } = useQuery({
    queryKey: ["dash_mat"],
    queryFn: async () => (await supabase.from("cost_sheet_materials").select("cost_sheet_id,actual_purchased_cost,line_date,created_at").is("deleted_at", null)).data ?? [],
  });
  const { data: labLines = [] } = useQuery({
    queryKey: ["dash_lab"],
    queryFn: async () => (await supabase.from("cost_sheet_labour").select("cost_sheet_id,actual_cost,line_date,created_at").is("deleted_at", null)).data ?? [],
  });
  const { data: ovhLines = [] } = useQuery({
    queryKey: ["dash_ovh"],
    queryFn: async () => (await supabase.from("cost_sheet_overhead").select("cost_sheet_id,actual_amount,line_date,created_at").is("deleted_at", null)).data ?? [],
  });
  const { data: reqs = [] } = useQuery({
    queryKey: ["dash_reqs"],
    queryFn: async () => (await supabase.from("requisitions").select("id,number,project_id,status,total_amount,created_at").is("deleted_at", null)).data ?? [],
  });
  const { data: pos = [] } = useQuery({
    queryKey: ["dash_pos"],
    queryFn: async () => (await supabase.from("purchase_orders").select("id,supplier_id,total_amount,status").is("deleted_at", null)).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["dash_suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("id,name").is("deleted_at", null)).data ?? [],
  });
  const { data: costCodes = [] } = useQuery({
    queryKey: ["dash_codes"],
    queryFn: async () => (await supabase.from("cost_codes").select("project_id,budgeted_amount").is("deleted_at", null)).data ?? [],
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["dash_activity"],
    queryFn: async () => (await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(10)).data ?? [],
  });

  // Summary
  const totalContract = projects.reduce((a: number, p: any) => a + num(p.contract_value), 0);
  const totalSpent =
    matLines.reduce((a: number, l: any) => a + num(l.actual_purchased_cost), 0) +
    labLines.reduce((a: number, l: any) => a + num(l.actual_cost), 0) +
    ovhLines.reduce((a: number, l: any) => a + num(l.actual_amount), 0);
  const activeProjects = projects.filter((p: any) => p.status === "Active").length;
  const pendingApprovals =
    sheets.filter((s: any) => ["Draft", "Confirmed", "Budget Validated"].includes(s.status)).length +
    reqs.filter((r: any) => r.status === "Pending Approval").length;

  // Monthly expenditure (last 6 months)
  const months: { key: string; date: Date }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), date: d });
  }
  const bySheetMonth = new Map<string, string>();
  sheets.forEach((s: any) => {
    const d = new Date(s.sheet_date ?? s.created_at);
    bySheetMonth.set(s.id, monthKey(new Date(d.getFullYear(), d.getMonth(), 1)));
  });
  const monthlyMap: Record<string, number> = Object.fromEntries(months.map((m) => [m.key, 0]));
  const addLine = (sheetId: string, amount: number) => {
    const k = bySheetMonth.get(sheetId);
    if (k && k in monthlyMap) monthlyMap[k] += amount;
  };
  matLines.forEach((l: any) => addLine(l.cost_sheet_id, num(l.actual_purchased_cost)));
  labLines.forEach((l: any) => addLine(l.cost_sheet_id, num(l.actual_cost)));
  ovhLines.forEach((l: any) => addLine(l.cost_sheet_id, num(l.actual_amount)));
  const monthlyData = months.map((m) => ({ month: m.key, spend: Math.round(monthlyMap[m.key]) }));

  // Budget vs actual per project
  const budgetByProject = new Map<string, number>();
  costCodes.forEach((c: any) => budgetByProject.set(c.project_id, (budgetByProject.get(c.project_id) ?? 0) + num(c.budgeted_amount)));
  const sheetToProject = new Map<string, string>();
  sheets.forEach((s: any) => sheetToProject.set(s.id, s.project_id));
  const actualByProject = new Map<string, number>();
  const addProjLine = (sheetId: string, amount: number) => {
    const p = sheetToProject.get(sheetId); if (!p) return;
    actualByProject.set(p, (actualByProject.get(p) ?? 0) + amount);
  };
  matLines.forEach((l: any) => addProjLine(l.cost_sheet_id, num(l.actual_purchased_cost)));
  labLines.forEach((l: any) => addProjLine(l.cost_sheet_id, num(l.actual_cost)));
  ovhLines.forEach((l: any) => addProjLine(l.cost_sheet_id, num(l.actual_amount)));

  const bvaData = projects.map((p: any) => ({
    name: p.name?.slice(0, 20) ?? "—",
    budget: Math.round(budgetByProject.get(p.id) ?? num(p.contract_value)),
    actual: Math.round(actualByProject.get(p.id) ?? 0),
  })).slice(0, 8);

  // Project status pie
  const statuses = ["Active", "Completed", "On Hold", "Handover"];
  const pieData = statuses.map((s) => ({ name: s, value: projects.filter((p: any) => p.status === s).length })).filter((d) => d.value > 0);

  // Project health
  const health = projects.map((p: any) => {
    const b = budgetByProject.get(p.id) ?? num(p.contract_value);
    const a = actualByProject.get(p.id) ?? 0;
    const pct = b > 0 ? (a / b) * 100 : 0;
    const color = pct > 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500";
    return { id: p.id, name: p.name, pct, color, b, a };
  });

  // Top suppliers by PO spend
  const supplierName = new Map<string, string>(suppliers.map((s: any) => [s.id, s.name]));
  const supplierSpend = new Map<string, number>();
  pos.forEach((p: any) => {
    if (!p.supplier_id) return;
    supplierSpend.set(p.supplier_id, (supplierSpend.get(p.supplier_id) ?? 0) + num(p.total_amount));
  });
  const topSuppliers = Array.from(supplierSpend.entries())
    .map(([id, spend]) => ({ id, name: supplierName.get(id) ?? "Unknown", spend }))
    .sort((a, b) => b.spend - a.spend).slice(0, 5);

  // Pending queues
  const pendingSheets = sheets.filter((s: any) => ["Draft", "Confirmed", "Budget Validated"].includes(s.status)).slice(0, 5);
  const pendingReqs = reqs.filter((r: any) => r.status === "Pending Approval").slice(0, 5);
  const projectName = (id?: string) => projects.find((p: any) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome${user?.email ? ", " + user.email.split("@")[0] : ""}`}
        description={primaryRole ? `Role: ${ROLE_LABELS[primaryRole]}` : "Real-time overview across all modules"}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FolderKanban} label="Total Contract Value" value={fmtNGN(totalContract)} />
        <Stat icon={FileSpreadsheet} label="Total Amount Spent" value={fmtNGN(totalSpent)} />
        <Stat icon={CheckCircle2} label="Active Projects" value={String(activeProjects)} />
        <Stat icon={ClipboardList} label="Pending Approvals" value={String(pendingApprovals)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Monthly Expenditure — Last 6 months</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip formatter={(v: any) => fmtNGN(v)} />
                <Bar dataKey="spend" fill={PURPLE} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Project Status</CardTitle></CardHeader>
          <CardContent className="h-72">
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {pieData.map((d) => <Cell key={d.name} fill={STATUS_COLORS[d.name] ?? PURPLE} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Budget vs Actual by Project</CardTitle></CardHeader>
        <CardContent className="h-80">
          {bvaData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bvaData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`} />
                <YAxis type="category" dataKey="name" width={140} />
                <Tooltip formatter={(v: any) => fmtNGN(v)} />
                <Legend />
                <Bar dataKey="budget" fill="hsl(272 60% 75%)" name="Budget" />
                <Bar dataKey="actual" fill={PURPLE} name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Project Health</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {health.length === 0 ? <p className="text-sm text-muted-foreground">No projects.</p> :
              health.map((h) => (
                <Link key={h.id} to="/projects/$id" params={{ id: h.id }} className="flex items-center justify-between gap-3 py-2 px-2 rounded hover:bg-muted">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-3 w-3 rounded-full ${h.color}`} />
                    <span className="text-sm truncate">{h.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{h.pct.toFixed(0)}% used</span>
                </Link>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top 5 Suppliers by Spend</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {topSuppliers.length === 0 ? <p className="text-sm text-muted-foreground py-2">No supplier spend yet.</p> :
              topSuppliers.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2">
                  <span className="text-sm truncate">{s.name}</span>
                  <span className="text-sm font-semibold">{fmtNGN(s.spend)}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pending Cost Sheets</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {pendingSheets.length === 0 ? <p className="text-sm text-muted-foreground py-2">No pending cost sheets.</p> :
              pendingSheets.map((s: any) => (
                <Link key={s.id} to="/cost-sheets/$id" params={{ id: s.id }} className="flex items-center justify-between py-2 hover:text-primary">
                  <span className="text-sm">{projectName(s.project_id)}</span>
                  <span className="text-xs text-muted-foreground">{s.status}</span>
                </Link>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pending Requisitions</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {pendingReqs.length === 0 ? <p className="text-sm text-muted-foreground py-2">No pending requisitions.</p> :
              pendingReqs.map((r: any) => (
                <Link key={r.id} to="/requisitions" className="flex items-center justify-between py-2 hover:text-primary">
                  <span className="text-sm">{r.number} · {projectName(r.project_id)}</span>
                  <span className="text-xs text-muted-foreground">{fmtNGN(r.total_amount)}</span>
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No activity logged yet.</p>
          ) : activity.map((a: any) => (
            <div key={a.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{a.actor_email ?? "System"}</span>{" "}
                <span className="text-muted-foreground">{a.action}</span>{" "}
                {a.entity_label && <span>· {a.entity_label}</span>}
                {a.entity_type && <span className="text-muted-foreground"> ({a.entity_type})</span>}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{new Date(a.created_at).toLocaleString("en-NG")}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-xl font-bold mt-1 truncate">{value}</p>
          </div>
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
