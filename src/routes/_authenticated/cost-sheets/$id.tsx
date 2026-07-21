import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { fmtNGN } from "@/lib/roles";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/cost-sheets/$id")({
  ssr: false,
  component: CostSheetDetail,
});

const STATUSES = ["Draft", "Confirmed", "Budget Validated", "Approved", "Done"] as const;

const MAT_COLS: { key: string; label: string; type?: string }[] = [
  { key: "line_date", label: "Date", type: "date" },
  { key: "product", label: "Product" },
  { key: "description", label: "Description" },
  { key: "planned_qty", label: "Planned Qty", type: "number" },
  { key: "uom", label: "UoM" },
  { key: "unit_cost", label: "Unit Cost", type: "number" },
  { key: "planned_amount", label: "Planned Amount", type: "number" },
  { key: "actual_req_qty", label: "Actual Req Qty", type: "number" },
  { key: "actual_purchased_qty", label: "Actual Purch Qty", type: "number" },
  { key: "actual_purchased_cost", label: "Actual Purch Cost", type: "number" },
  { key: "vendor_bill_qty", label: "Vendor Bill Qty", type: "number" },
  { key: "vendor_bill_cost", label: "Vendor Bill Cost", type: "number" },
  { key: "invoice_subtotal", label: "Invoice Subtotal", type: "number" },
  { key: "cost_price_subtotal", label: "Cost Price Subtotal", type: "number" },
];
const LAB_COLS: { key: string; label: string; type?: string }[] = [
  { key: "line_date", label: "Date", type: "date" },
  { key: "job_type", label: "Job Type" },
  { key: "worker", label: "Worker" },
  { key: "description", label: "Description" },
  { key: "planned_days", label: "Planned Days", type: "number" },
  { key: "daily_rate", label: "Daily Rate", type: "number" },
  { key: "planned_cost", label: "Planned Cost", type: "number" },
  { key: "actual_days", label: "Actual Days", type: "number" },
  { key: "actual_cost", label: "Actual Cost", type: "number" },
  { key: "variance", label: "Variance", type: "number" },
];
const OVH_COLS: { key: string; label: string; type?: string }[] = [
  { key: "line_date", label: "Date", type: "date" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "planned_amount", label: "Planned Amount", type: "number" },
  { key: "actual_amount", label: "Actual Amount", type: "number" },
  { key: "variance", label: "Variance", type: "number" },
];

function CostSheetDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user, roles } = useSession();

  const { data: sheet } = useQuery({
    queryKey: ["cost_sheets", id],
    queryFn: async () => (await supabase.from("cost_sheets").select("*, projects(name)").eq("id", id).single()).data,
  });
  const mat = useLines("cost_sheet_materials", id);
  const lab = useLines("cost_sheet_labour", id);
  const ovh = useLines("cost_sheet_overhead", id);

  const { data: costCode } = useQuery({
    queryKey: ["cost_code", sheet?.cost_code_id],
    queryFn: async () => {
      if (!sheet?.cost_code_id) return null;
      const { data } = await supabase.from("cost_codes").select("*").eq("id", sheet.cost_code_id).maybeSingle();
      return data;
    },
    enabled: !!sheet?.cost_code_id,
  });

  const { data: requisitions } = useQuery({
    queryKey: ["requisitions", sheet?.cost_code_id],
    queryFn: async () => {
      if (!sheet?.cost_code_id) return [];
      const { data } = await supabase.from("requisitions").select("total_amount,status").eq("cost_code_id", sheet.cost_code_id).is("deleted_at", null);
      return data ?? [];
    },
    enabled: !!sheet?.cost_code_id,
  });

  const committed = (requisitions ?? []).filter((r: any) => ["Pending Approval", "Approved"].includes(r.status)).reduce((a: number, r: any) => a + Number(r.total_amount ?? 0), 0);
  const actualFromCostCode = Number(costCode?.actual_amount ?? 0);
  const budgeted = Number(costCode?.budgeted_amount ?? 0);
  const remainingBudget = budgeted - committed - actualFromCostCode;

  async function updateStatus(v: string) {
    if (!sheet) return toast.error("Sheet not loaded");
    const from = sheet.status;
    const to = v;
    const uid = user?.id;

    // Draft -> Confirmed: Creator
    if (from === "Draft" && to === "Confirmed") {
      if (sheet.created_by !== uid) return toast.error("Only the creator can confirm");
    }
    // Confirmed -> Budget Validated: Accountant
    if (from === "Confirmed" && to === "Budget Validated") {
      if (!roles.includes("accountant")) return toast.error("Only accountants can validate budget");
    }
    // Budget Validated -> Approved: Project Manager
    if (from === "Budget Validated" && to === "Approved") {
      if (!roles.includes("project_manager")) return toast.error("Only project managers can approve");
    }
    // Approved -> Done: Admin or Accountant
    if (from === "Approved" && to === "Done") {
      if (!roles.includes("admin") && !roles.includes("accountant")) return toast.error("Only admin or accountant can mark done");
    }

    const { error } = await supabase.from("cost_sheets").update({ status: v }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cost_sheets"] });

    // If moved to Approved, recalculate and update cost_codes.actual_amount
    if (to === "Approved" && sheet.cost_code_id) {
      try {
        const { data: mats } = await supabase.from("cost_sheet_materials").select("actual_purchased_cost,cost_sheets!inner(cost_code_id,status)").is("deleted_at", null);
        const { data: labs } = await supabase.from("cost_sheet_labour").select("actual_cost,cost_sheets!inner(cost_code_id,status)").is("deleted_at", null);
        const { data: ovhs } = await supabase.from("cost_sheet_overhead").select("actual_amount,cost_sheets!inner(cost_code_id,status)").is("deleted_at", null);

        const matSum = (mats ?? []).filter((r: any) => r.cost_sheets?.cost_code_id === sheet.cost_code_id && r.cost_sheets?.status === "Approved").reduce((a: number, r: any) => a + Number(r.actual_purchased_cost ?? 0), 0);
        const labSum = (labs ?? []).filter((r: any) => r.cost_sheets?.cost_code_id === sheet.cost_code_id && r.cost_sheets?.status === "Approved").reduce((a: number, r: any) => a + Number(r.actual_cost ?? 0), 0);
        const ovhSum = (ovhs ?? []).filter((r: any) => r.cost_sheets?.cost_code_id === sheet.cost_code_id && r.cost_sheets?.status === "Approved").reduce((a: number, r: any) => a + Number(r.actual_amount ?? 0), 0);

        const totalActual = matSum + labSum + ovhSum;
        await supabase.from("cost_codes").update({ actual_amount: totalActual }).eq("id", sheet.cost_code_id);
        qc.invalidateQueries({ queryKey: ["cost_codes"] });
      } catch (e) {
        console.error(e);
      }
    }
  }

  const plannedTotal =
    sum(mat.rows, "planned_amount") + sum(lab.rows, "planned_cost") + sum(ovh.rows, "planned_amount");
  const actualTotal =
    sum(mat.rows, "actual_purchased_cost") + sum(lab.rows, "actual_cost") + sum(ovh.rows, "actual_amount");
  const variance = plannedTotal - actualTotal;
  const pctUsed = plannedTotal > 0 ? Math.min(100, (actualTotal / plannedTotal) * 100) : 0;

  const budgetUtilPct = budgeted > 0 ? Math.min(999, ((actualFromCostCode || actualTotal) / budgeted) * 100) : 0;
  const budgetUtilColor = budgetUtilPct < 80 ? "text-green-600" : budgetUtilPct <= 100 ? "text-yellow-600" : "text-red-600";

  if (!sheet) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div>
      <Link to="/cost-sheets" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-primary mb-2">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <PageHeader
        title={`${sheet.number} — ${sheet.title ?? "Cost Sheet"}`}
        description={
          <div className="flex flex-col">
            <span>{sheet.projects?.name}</span>
            {sheet.cost_code_id && (
              <div className="text-sm text-muted-foreground">Remaining Budget: <span className="font-semibold">{fmtNGN(remainingBudget)}</span></div>
            )}
          </div>
        }
        action={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{sheet.status}</Badge>
            <Select value={sheet.status} onValueChange={updateStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{(STATUSES as readonly string[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Planned</p><p className="font-bold">{fmtNGN(plannedTotal)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Actual</p><p className="font-bold">{fmtNGN(actualTotal)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Variance</p><p className={"font-bold " + (variance < 0 ? "text-destructive" : "")}>{fmtNGN(variance)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">% Used</p><Progress value={pctUsed} className="mt-2" /><p className="text-xs mt-1">{pctUsed.toFixed(0)}%</p>
        {sheet.cost_code_id && (
          <p className={`text-sm mt-2 ${budgetUtilColor}`}>Budget Utilization: {budgetUtilPct.toFixed(0)}%</p>
        )}
        </CardContent></Card>
      </div>

      {sheet.cost_code_id && plannedTotal > remainingBudget && (
        <div className="mb-4 p-3 rounded border border-destructive/50 bg-destructive/10 text-destructive">Over budget by {fmtNGN(plannedTotal - remainingBudget)}</div>
      )}

      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="labour">Labour</TabsTrigger>
          <TabsTrigger value="overhead">Overhead</TabsTrigger>
        </TabsList>
        <TabsContent value="materials"><LinesTable cols={MAT_COLS} api={mat} /></TabsContent>
        <TabsContent value="labour"><LinesTable cols={LAB_COLS} api={lab} /></TabsContent>
        <TabsContent value="overhead"><LinesTable cols={OVH_COLS} api={ovh} /></TabsContent>
      </Tabs>
    </div>
  );
}

function sum(rows: any[], key: string): number {
  return rows.reduce((a, r) => a + Number(r[key] ?? 0), 0);
}

function useLines(table: string, sheetId: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: [table, sheetId],
    queryFn: async () => (await supabase.from(table as any).select("*").eq("cost_sheet_id", sheetId).is("deleted_at", null).order("created_at")).data ?? [],
  });
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (q.data) setRows(q.data as any[]); }, [q.data]);

  async function add() {
    const { data, error } = await supabase.from(table as any).insert({ cost_sheet_id: sheetId }).select().single();
    if (error) return toast.error(error.message);
    setRows((r) => [...r, data]);
    qc.invalidateQueries({ queryKey: ["cost_sheets_summary"] });
  }
  async function update(id: string, patch: any) {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from(table as any).update(patch).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cost_sheets_summary"] });
  }
  async function remove(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    const { data: u } = await supabase.auth.getUser();
    await supabase.from(table as any).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    void u;
  }
  return { rows, add, update, remove };
}

function LinesTable({ cols, api }: { cols: { key: string; label: string; type?: string }[]; api: ReturnType<typeof useLines> }) {
  return (
    <div className="border rounded-lg bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {api.rows.length === 0 && (
            <TableRow><TableCell colSpan={cols.length + 1} className="text-center text-sm text-muted-foreground py-6">No lines. Click Add Line.</TableCell></TableRow>
          )}
          {api.rows.map((row) => (
            <TableRow key={row.id}>
              {cols.map((c) => (
                <TableCell key={c.key} className="p-1">
                  <Input
                    type={c.type ?? "text"}
                    className="h-8 min-w-24"
                    value={row[c.key] ?? ""}
                    onChange={(e) => {
                      const v = c.type === "number" ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value;
                      api.update(row.id, { [c.key]: v });
                    }}
                  />
                </TableCell>
              ))}
              <TableCell>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => api.remove(row.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="p-2 border-t">
        <Button size="sm" variant="outline" onClick={api.add}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
      </div>
    </div>
  );
}
