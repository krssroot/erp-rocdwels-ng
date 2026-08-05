import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtNGN, ROLE_LABELS } from "@/lib/roles";
import { useSession } from "@/hooks/use-session";
import { exportActivityLogPdf } from "@/lib/pdf-exports";
import { FolderKanban, FileSpreadsheet, ClipboardList, CheckCircle2, FileDown } from "lucide-react";
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
function iso(d: Date) { return d.toISOString().slice(0, 10); }
function monthsAgo(n: number) { const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(1); return d; }

function AdminDashboard() {
  const { user, primaryRole } = useSession();
  const navigate = useNavigate();

  const [from, setFrom] = useState(() => iso(monthsAgo(5)));
  const [to, setTo] = useState(() => iso(new Date()));
  const [logLimit, setLogLimit] = useState("25");

  const fromTs = useMemo(() => new Date(from + "T00:00:00").getTime(), [from]);
  const toTs = useMemo(() => new Date(to + "T23:59:59").getTime(), [to]);
  const inRange = (v?: string | null) => {
    if (!v) return false;
    const t = new Date(v).getTime();
    return t >= fromTs && t <= toTs;
  };
  const rangeLabel = `${from} → ${to}`;

  function applyPreset(p: string) {
    const now = new Date();
    if (p === "30d") { const d = new Date(); d.setDate(d.getDate() - 30); setFrom(iso(d)); }
    else if (p === "3m") setFrom(iso(monthsAgo(2)));
    else if (p === "6m") setFrom(iso(monthsAgo(5)));
    else if (p === "12m") setFrom(iso(monthsAgo(11)));
    else if (p === "ytd") setFrom(iso(new Date(now.getFullYear(), 0, 1)));
    setTo(iso(now));
  }

  const { data: projects = [] } = useQuery({
    queryKey: ["dash_projects"],
    queryFn: async () => (await supabase.from("projects").select("*").is("deleted_at", null)).data ?? [],
  });
  const { data: allSheets = [] } = useQuery({
    queryKey: ["dash_sheets"],
    queryFn: async () => (await supabase.from("cost_sheets").select("id,project_id,status,created_at,sheet_date,number,title").is("deleted_at", null)).data ?? [],
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
  const { data: allReqs = [] } = useQuery({
    queryKey: ["dash_reqs"],
    queryFn: async () => (await supabase.from("requisitions").select("id,number,project_id,status,total_amount,created_at").is("deleted_at", null)).data ?? [],
  });
  const { data: allPos = [] } = useQuery({
    queryKey: ["dash_pos"],
    queryFn: async () => (await supabase.from("purchase_orders").select("id,supplier_id,total_amount,status,created_at").is("deleted_at", null)).data ?? [],
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
    queryKey: ["dash_activity", from, to, logLimit],
    queryFn: async () => (await supabase
      .from("activity_logs").select("*")
      .gte("created_at", new Date(fromTs).toISOString())
      .lte("created_at", new Date(toTs).toISOString())
      .order("created_at", { ascending: false })
      .limit(Number(logLimit))).data ?? [],
  });

  // Range filtering
  const sheets = allSheets.filter((s: any) => inRange(s.sheet_date ?? s.created_at));
  const sheetIds = new Set(sheets.map((s: any) => s.id));
  const reqs = allReqs.filter((r: any) => inRange(r.created_at));
  const pos = allPos.filter((p: any) => inRange(p.created_at));
  const mats = matLines.filter((l: any) => sheetIds.has(l.cost_sheet_id));
  const labs = labLines.filter((l: any) => sheetIds.has(l.cost_sheet_id));
  const ovhs = ovhLines.filter((l: any) => sheetIds.has(l.cost_sheet_id));

  // Expenditure = PAID requisitions only
  const paidReqs = reqs.filter((r: any) => r.status === "Paid");

  // Summary
  const totalContract = projects.reduce((a: number, p: any) => a + num(p.contract_value), 0);
  const totalSpent = paidReqs.reduce((a: number, r: any) => a + num(r.total_amount), 0);
  const activeProjects = projects.filter((p: any) => p.status === "Active").length;
  const pendingSheetsAll = sheets.filter((s: any) => ["Draft", "Submitted for Vetting", "Vetted"].includes(s.status));
  const pendingReqsAll = reqs.filter((r: any) =>
    ["Pending Vetting", "Pending PO", "MD Approval", "Payment Schedule", "Payment Confirmed"].includes(r.status),
  );
  const pendingApprovals = pendingSheetsAll.length + pendingReqsAll.length;

  // Monthly expenditure across the selected range (max 12 buckets)
  const months: { key: string; date: Date }[] = [];
  {
    const start = new Date(new Date(fromTs).getFullYear(), new Date(fromTs).getMonth(), 1);
    const end = new Date(new Date(toTs).getFullYear(), new Date(toTs).getMonth(), 1);
    const cur = new Date(start);
    while (cur <= end && months.length < 24) {
      months.push({ key: monthKey(new Date(cur)), date: new Date(cur) });
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  const monthlyMap: Record<string, number> = Object.fromEntries(months.map((m) => [m.key, 0]));
  paidReqs.forEach((r: any) => {
    const d = new Date(r.created_at);
    const k = monthKey(new Date(d.getFullYear(), d.getMonth(), 1));
    if (k in monthlyMap) monthlyMap[k] += num(r.total_amount);
  });
  const monthlyData = months.map((m) => ({
    month: m.key,
    spend: Math.round(monthlyMap[m.key]),
    from: iso(m.date),
    to: iso(new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0)),
  }));

  // Budget vs actual (paid expenditure) per project
  const budgetByProject = new Map<string, number>();
  costCodes.forEach((c: any) => budgetByProject.set(c.project_id, (budgetByProject.get(c.project_id) ?? 0) + num(c.budgeted_amount)));
  const actualByProject = new Map<string, number>();
  paidReqs.forEach((r: any) => {
    if (!r.project_id) return;
    actualByProject.set(r.project_id, (actualByProject.get(r.project_id) ?? 0) + num(r.total_amount));
  });

  const bvaData = projects.map((p: any) => ({
    id: p.id,
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

  const pendingSheets = pendingSheetsAll.slice(0, 5);
  const pendingReqs = pendingReqsAll.slice(0, 5);
  const projectName = (id?: string) => projects.find((p: any) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome${user?.email ? ", " + user.email.split("@")[0] : ""}`}
        description={primaryRole ? `Role: ${ROLE_LABELS[primaryRole]}` : "Real-time overview across all modules"}
      />

      <Card>
        <CardContent className="pt-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" className="h-9 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" className="h-9 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quick range</Label>
            <Select onValueChange={applyPreset}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Preset" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="3m">Last 3 months</SelectItem>
                <SelectItem value="6m">Last 6 months</SelectItem>
                <SelectItem value="12m">Last 12 months</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Activity entries</Label>
              <Select value={logLimit} onValueChange={setLogLimit}>
                <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10", "25", "50", "100", "250"].map((n) => <SelectItem key={n} value={n}>Last {n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => exportActivityLogPdf({
                rows: activity,
                scopeLabel: "All modules — Admin",
                rangeLabel,
                generatedBy: user?.email ?? undefined,
              })}
            >
              <FileDown className="h-4 w-4 mr-2" /> Export Activity Log
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FolderKanban} label="Total Contract Value" value={fmtNGN(totalContract)} onClick={() => navigate({ to: "/projects" })} />
        <Stat icon={FileSpreadsheet} label="Total Amount Spent" value={fmtNGN(totalSpent)} onClick={() => navigate({ to: "/cost-sheets", search: { from, to } })} />
        <Stat icon={CheckCircle2} label="Active Projects" value={String(activeProjects)} onClick={() => navigate({ to: "/projects", search: { status: "Active" } })} />
        <Stat icon={ClipboardList} label="Pending Approvals" value={String(pendingApprovals)} onClick={() => navigate({ to: "/requisitions", search: { status: "Pending Approval" } })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Monthly Expenditure — {rangeLabel}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyData}
                onClick={(e: any) => {
                  const p = e?.activePayload?.[0]?.payload;
                  if (p) navigate({ to: "/cost-sheets", search: { from: p.from, to: p.to } });
                }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip formatter={(v: any) => fmtNGN(v)} />
                <Bar dataKey="spend" fill={PURPLE} radius={[6, 6, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground -mt-4">Click a bar to open that month's cost sheets.</p>
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
                  <Pie
                    data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}
                    cursor="pointer"
                    onClick={(d: any) => navigate({ to: "/projects", search: { status: d?.name ?? d?.payload?.name } })}
                  >
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
              <BarChart
                data={bvaData} layout="vertical" margin={{ left: 40 }}
                onClick={(e: any) => {
                  const p = e?.activePayload?.[0]?.payload;
                  if (p?.id) navigate({ to: "/projects/$id", params: { id: p.id } });
                }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`} />
                <YAxis type="category" dataKey="name" width={140} />
                <Tooltip formatter={(v: any) => fmtNGN(v)} />
                <Legend />
                <Bar dataKey="budget" fill="hsl(272 60% 75%)" name="Budget" cursor="pointer" />
                <Bar dataKey="actual" fill={PURPLE} name="Actual" cursor="pointer" />
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
                <Link key={s.id} to="/purchase-orders" className="flex items-center justify-between py-2 hover:text-primary">
                  <span className="text-sm truncate">{s.name}</span>
                  <span className="text-sm font-semibold">{fmtNGN(s.spend)}</span>
                </Link>
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
                <Link key={r.id} to="/requisitions" search={{ status: "Pending Approval" }} className="flex items-center justify-between py-2 hover:text-primary">
                  <span className="text-sm">{r.number} · {projectName(r.project_id)}</span>
                  <span className="text-xs text-muted-foreground">{fmtNGN(r.total_amount)}</span>
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Activity — last {logLimit} in range</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No activity logged in this range.</p>
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

function Stat({ icon: Icon, label, value, onClick }: { icon: any; label: string; value: string; onClick?: () => void }) {
  return (
    <Card onClick={onClick} className={onClick ? "cursor-pointer transition-colors hover:bg-muted/50" : undefined}>
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
