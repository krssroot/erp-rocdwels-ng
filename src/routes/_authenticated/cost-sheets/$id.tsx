import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, FileDown } from "lucide-react";
import { fmtNGN } from "@/lib/roles";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { exportCostSheetPdf } from "@/lib/pdf-exports";
import { logActivity } from "@/lib/activity";
import { ApprovalPanel } from "@/components/approvals";
import { Attachments } from "@/components/attachments";
import { Chatter } from "@/components/chatter";
import { ApprovalHistory } from "@/components/approval-history";
import { BUDGET_STATUSES, budgetSteps, allowed } from "@/lib/workflow";

export const Route = createFileRoute("/_authenticated/cost-sheets/$id")({
  ssr: false,
  component: CostSheetDetail,
});

const STATUSES = BUDGET_STATUSES;

const CATEGORIES = ["Materials", "Labour", "Equipment", "Overhead", "Subcontractor"] as const;
const DEFAULT_UOMS = ["bags", "tons", "kg", "meters", "pieces", "litres"];

type Col = { key: string; label: string; type?: string; auto?: boolean; min?: number };

const MAT_COLS: Col[] = [
  { key: "line_date", label: "Date", type: "date" },
  { key: "product", label: "Product" },
  { key: "description", label: "Description" },
  { key: "planned_qty", label: "Planned Qty", type: "number" },
  { key: "uom", label: "UoM" },
  { key: "unit_cost", label: "Unit Cost ₦", type: "number" },
  { key: "planned_amount", label: "Planned Amount", type: "number", auto: true },
  { key: "actual_req_qty", label: "Req Qty", type: "number" },
  { key: "actual_purchased_qty", label: "Purch Qty", type: "number" },
  { key: "actual_purchased_cost", label: "Purch Cost ₦", type: "number" },
  { key: "vendor_bill_qty", label: "Bill Qty", type: "number" },
  { key: "vendor_bill_cost", label: "Bill Cost ₦", type: "number" },
  { key: "invoice_subtotal", label: "Invoice Sub ₦", type: "number", auto: true },
  { key: "cost_price_subtotal", label: "Cost Price Sub ₦", type: "number", auto: true },
];
const LAB_COLS: Col[] = [
  { key: "line_date", label: "Date", type: "date" },
  { key: "job_type", label: "Job Type" },
  { key: "worker", label: "Worker" },
  { key: "description", label: "Description" },
  { key: "planned_days", label: "Planned Days", type: "number" },
  { key: "daily_rate", label: "Daily Rate ₦", type: "number" },
  { key: "planned_cost", label: "Planned Cost", type: "number", auto: true },
  { key: "actual_days", label: "Actual Days", type: "number" },
  { key: "actual_cost", label: "Actual Cost ₦", type: "number" },
  { key: "variance", label: "Variance", type: "number", auto: true },
];
const OVH_COLS: Col[] = [
  { key: "line_date", label: "Date", type: "date" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "planned_amount", label: "Planned ₦", type: "number" },
  { key: "actual_amount", label: "Actual ₦", type: "number" },
  { key: "variance", label: "Variance", type: "number", auto: true },
];

function num(v: any) { const n = Number(v ?? 0); return isFinite(n) ? n : 0; }
function sum(rows: any[], key: string): number { return rows.reduce((a, r) => a + num(r[key]), 0); }
function pctColor(p: number) { return p < 80 ? "text-green-600" : p <= 100 ? "text-amber-600" : "text-red-600"; }

function CostSheetDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user, roles } = useSession();

  // Header
  const { data: sheet } = useQuery({
    queryKey: ["cost_sheets", id],
    queryFn: async () => (await supabase.from("cost_sheets").select("*, projects(name, client)").eq("id", id).single()).data,
  });
  const [hdr, setHdr] = useState<any>({});
  useEffect(() => { if (sheet) setHdr(sheet); }, [sheet]);

  const { data: projects } = useQuery({
    queryKey: ["projects", "min"],
    queryFn: async () => (await supabase.from("projects").select("id,name,client").is("deleted_at", null)).data ?? [],
  });
  const { data: costCodes } = useQuery({
    queryKey: ["cost_codes", "for-project", hdr.project_id],
    queryFn: async () => {
      if (!hdr.project_id) return [];
      const { data } = await supabase.from("cost_codes").select("*").eq("project_id", hdr.project_id).is("deleted_at", null);
      return data ?? [];
    },
    enabled: !!hdr.project_id,
  });

  const selectedCode = (costCodes ?? []).find((c: any) => c.id === hdr.cost_code_id);

  // Committed = sum of Pending/Approved requisitions for this cost_code
  const { data: committedAgg } = useQuery({
    queryKey: ["cc_committed", hdr.cost_code_id],
    queryFn: async () => {
      if (!hdr.cost_code_id) return 0;
      const { data } = await supabase.from("requisitions")
        .select("total_amount,status")
        .eq("cost_code_id", hdr.cost_code_id)
        .is("deleted_at", null);
      return (data ?? []).filter((r: any) => ["Pending Vetting", "Pending PO", "MD Approval", "Payment Schedule", "Payment Confirmed"].includes(r.status))
        .reduce((a: number, r: any) => a + num(r.total_amount), 0);
    },
    enabled: !!hdr.cost_code_id,
  });

  const budgeted = num(selectedCode?.budgeted_amount);
  const committed = num(committedAgg);
  const actualFromCode = num(selectedCode?.actual_amount);
  const remaining = budgeted - committed - actualFromCode;

  // Lines
  const mat = useLines("cost_sheet_materials", id, matCompute);
  const lab = useLines("cost_sheet_labour", id, labCompute);
  const ovh = useLines("cost_sheet_overhead", id, ovhCompute);

  // Budget lines (uses cost_codes rows filtered by project)
  const budgetLines = costCodes ?? [];

  // Quick counts
  const { data: counts } = useQuery({
    queryKey: ["cs_counts", hdr.cost_code_id, id],
    queryFn: async () => {
      const [po, req] = await Promise.all([
        supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("project_id", hdr.project_id ?? "").is("deleted_at", null),
        supabase.from("requisitions").select("id", { count: "exact", head: true }).eq("cost_code_id", hdr.cost_code_id ?? "").is("deleted_at", null),
      ]);
      return { po: po.count ?? 0, req: req.count ?? 0 };
    },
    enabled: !!hdr.project_id,
  });

  const matPlan = sum(mat.rows, "planned_amount");
  const matAct = sum(mat.rows, "actual_purchased_cost");
  const labPlan = sum(lab.rows, "planned_cost");
  const labAct = sum(lab.rows, "actual_cost");
  const ovhPlan = sum(ovh.rows, "planned_amount");
  const ovhAct = sum(ovh.rows, "actual_amount");
  const grandPlan = matPlan + labPlan + ovhPlan;
  const grandAct = matAct + labAct + ovhAct;
  const variance = grandPlan - grandAct;
  const utilPct = budgeted > 0 ? (grandAct / budgeted) * 100 : 0;
  const overBudget = hdr.cost_code_id && grandPlan > remaining + actualFromCode;

  async function saveHeader(patch: any) {
    setHdr((h: any) => ({ ...h, ...patch }));
    const clean: any = { ...patch };
    if (clean.cost_code_id === "") clean.cost_code_id = null;
    const { error } = await supabase.from("cost_sheets").update(clean).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cost_sheets", id] });
  }

  async function updateStatus(v: string, reason?: string) {
    if (!sheet) return;
    const from = sheet.status, to = v;
    const step = budgetSteps(from).find((s) => s.to === to);
    if (!step) return toast.error(`Not a valid transition from ${from}`);
    if (!allowed(step, roles)) return toast.error(step.hint);

    const patch: any = { status: v };
    if (to === "Rejected") patch.rejection_reason = reason ?? null;
    const { error } = await supabase.from("cost_sheets").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await logActivity(`status → ${to}`, "cost_sheets", id, sheet.number ?? sheet.title ?? undefined, { from, to });
    toast.success(`Budget ${to}`);
    qc.invalidateQueries({ queryKey: ["cost_sheets"] });
    qc.invalidateQueries({ queryKey: ["cost_sheets", id] });
    qc.invalidateQueries({ queryKey: ["approval_history", id] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }


  if (!sheet) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <Link to="/cost-sheets" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-primary">
        <ArrowLeft className="h-3 w-3" /> Back
      </Link>
      <PageHeader
        title={`${sheet.number} — ${hdr.title ?? "Cost Sheet"}`}
        description={<span>{sheet.projects?.name}</span>}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-3 text-xs mr-3">
              <QuickLink label="POs" value={counts?.po ?? 0} />
              <QuickLink label="Reqs" value={counts?.req ?? 0} />
              <QuickLink label="Budget Lines" value={budgetLines.length} />
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCostSheetPdf({
              sheet: { ...sheet, ...hdr },
              projectName: sheet.projects?.name,
              materials: mat.rows, labour: lab.rows, overhead: ovh.rows,
              budgetLines,
              totals: { matPlan, matAct, labPlan, labAct, ovhPlan, ovhAct, grandPlan, grandAct, utilPct },
              generatedBy: user?.email ?? undefined,
            })}>
              <FileDown className="h-4 w-4 mr-1" /> Export PDF
            </Button>
            <Badge variant={sheet.status === "Rejected" ? "destructive" : "secondary"}>{sheet.status}</Badge>
            {budgetSteps(sheet.status).map((s) => (
              <Button
                key={s.to}
                size="sm"
                variant={s.to === "Rejected" ? "destructive" : "default"}
                disabled={!allowed(s, roles)}
                title={allowed(s, roles) ? s.label : s.hint}
                onClick={() =>
                  updateStatus(s.to, s.to === "Rejected" ? window.prompt("Reason for rejection") ?? undefined : undefined)
                }
              >
                {s.label}
              </Button>
            ))}

          </div>
        }
      />

      {/* HEADER FORM */}
      <Card>
        <CardContent className="pt-4 grid gap-3 md:grid-cols-3">
          <Field label="Job Name">
            <Input value={hdr.title ?? ""} onChange={(e) => setHdr({ ...hdr, title: e.target.value })} onBlur={(e) => saveHeader({ title: e.target.value })} />
          </Field>
          <Field label="Project">
            <Select value={hdr.project_id ?? ""} onValueChange={(v) => { const p = (projects ?? []).find((x: any) => x.id === v); saveHeader({ project_id: v, cost_code_id: null, customer: p?.client ?? hdr.customer }); }}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Cost Code">
            <Select value={hdr.cost_code_id ?? ""} onValueChange={(v) => saveHeader({ cost_code_id: v })} disabled={!hdr.project_id}>
              <SelectTrigger><SelectValue placeholder={hdr.project_id ? "Select cost code" : "Pick project first"} /></SelectTrigger>
              <SelectContent>{(costCodes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.category}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Analytic Account">
            <Input value={hdr.analytic_account ?? ""} onChange={(e) => setHdr({ ...hdr, analytic_account: e.target.value })} onBlur={(e) => saveHeader({ analytic_account: e.target.value })} />
          </Field>
          <Field label="Job Order">
            <Input value={hdr.job_order ?? ""} onChange={(e) => setHdr({ ...hdr, job_order: e.target.value })} onBlur={(e) => saveHeader({ job_order: e.target.value })} />
          </Field>
          <Field label="Customer">
            <Input value={hdr.customer ?? ""} onChange={(e) => setHdr({ ...hdr, customer: e.target.value })} onBlur={(e) => saveHeader({ customer: e.target.value })} />
          </Field>
          <Field label="Date">
            <Input type="date" value={hdr.sheet_date ?? ""} onChange={(e) => saveHeader({ sheet_date: e.target.value })} />
          </Field>
          <Field label="Currency">
            <Input value={hdr.currency ?? "NGN"} onChange={(e) => setHdr({ ...hdr, currency: e.target.value })} onBlur={(e) => saveHeader({ currency: e.target.value })} />
          </Field>
          <Field label="Sale Reference">
            <Input value={hdr.sale_reference ?? ""} onChange={(e) => setHdr({ ...hdr, sale_reference: e.target.value })} onBlur={(e) => saveHeader({ sale_reference: e.target.value })} />
          </Field>
          <div className="md:col-span-3">
            <Field label="Description">
              <Textarea rows={2} value={hdr.description ?? ""} onChange={(e) => setHdr({ ...hdr, description: e.target.value })} onBlur={(e) => saveHeader({ description: e.target.value })} />
            </Field>
          </div>

          {hdr.cost_code_id && (
            <div className="md:col-span-3 text-sm rounded border p-3 bg-muted/30">
              <span className="mr-4">Budget Allocated: <b>{fmtNGN(budgeted)}</b></span>
              <span className="mr-4">Committed: <b>{fmtNGN(committed)}</b></span>
              <span>Remaining: <b className={remaining < 0 ? "text-red-600" : ""}>{fmtNGN(remaining)}</b></span>
              {overBudget && (
                <div className="mt-2 text-red-600 font-medium">⚠ Planned total exceeds remaining budget by {fmtNGN(grandPlan - (remaining + actualFromCode))}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* BUDGET BREAKDOWN */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="font-semibold mb-2">Budget Breakdown</h3>
          <BudgetTable projectId={hdr.project_id} rows={budgetLines} />
        </CardContent>
      </Card>

      {/* Line item tabs */}
      <Tabs defaultValue="materials">
        <TabsList>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="labour">Labour</TabsTrigger>
          <TabsTrigger value="overhead">Overhead</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
          <TabsTrigger value="history">Workflow history</TabsTrigger>
          <TabsTrigger value="discussion">Discussion</TabsTrigger>
        </TabsList>
        <TabsContent value="history">
          <div className="border rounded-lg bg-card p-4">
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              {STATUSES.filter((s) => s !== "Rejected").map((s, i) => (
                <span
                  key={s}
                  className={
                    "px-2 py-1 rounded-full border " +
                    (s === sheet.status ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground")
                  }
                >
                  {i + 1}. {s}
                </span>
              ))}
            </div>
            <ApprovalHistory budgetId={id} />
          </div>
        </TabsContent>
        <TabsContent value="materials"><LinesTable cols={MAT_COLS} api={mat} totalsKeys={["planned_amount", "actual_purchased_cost"]} /></TabsContent>

        <TabsContent value="labour"><LinesTable cols={LAB_COLS} api={lab} totalsKeys={["planned_cost", "actual_cost"]} /></TabsContent>
        <TabsContent value="overhead"><LinesTable cols={OVH_COLS} api={ovh} totalsKeys={["planned_amount", "actual_amount"]} /></TabsContent>
        <TabsContent value="approvals">
          <ApprovalPanel
            entityType="cost_sheets"
            entityId={id}
            recordLabel={sheet.number ?? "Cost Sheet"}
            projectId={sheet.project_id}
            meta={[["Project", sheet.projects?.name ?? "—"], ["Status", sheet.status]]}
          />
        </TabsContent>
        <TabsContent value="attachments">
          <Attachments entityType="cost_sheets" entityId={id} recordLabel={sheet.number ?? undefined} />
        </TabsContent>
        <TabsContent value="discussion">
          <Chatter entityType="cost_sheets" entityId={id} title={`Discussion — ${sheet.number}`} />
        </TabsContent>
      </Tabs>

      {/* FOOTER TOTALS */}
      <Card>
        <CardContent className="pt-4 grid gap-3 md:grid-cols-3">
          <TotalRow label="Materials" plan={matPlan} act={matAct} />
          <TotalRow label="Labour" plan={labPlan} act={labAct} />
          <TotalRow label="Overhead" plan={ovhPlan} act={ovhAct} />
          <div className="md:col-span-3 border-t pt-3 grid gap-3 md:grid-cols-4">
            <Stat label="Grand Planned" value={fmtNGN(grandPlan)} />
            <Stat label="Grand Actual" value={fmtNGN(grandAct)} />
            <Stat label="Variance" value={fmtNGN(variance)} className={variance < 0 ? "text-red-600" : "text-green-600"} />
            <Stat label="Budget Utilisation" value={`${utilPct.toFixed(0)}%`} className={pctColor(utilPct)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QuickLink({ label, value }: { label: string; value: number }) {
  return <div className="px-2 py-1 rounded bg-muted"><span className="text-muted-foreground">{label}:</span> <b>{value}</b></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className={"font-bold " + (className ?? "")}>{value}</p></div>;
}
function TotalRow({ label, plan, act }: { label: string; plan: number; act: number }) {
  return (
    <div className="text-sm">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p>Planned: <b>{fmtNGN(plan)}</b></p>
      <p>Actual: <b>{fmtNGN(act)}</b></p>
    </div>
  );
}

// ----- Auto-compute helpers -----
function matCompute(r: any) {
  const planned_amount = num(r.planned_qty) * num(r.unit_cost);
  const invoice_subtotal = num(r.vendor_bill_qty) * num(r.unit_cost);
  const cost_price_subtotal = num(r.actual_purchased_cost);
  return { planned_amount, invoice_subtotal, cost_price_subtotal };
}
function labCompute(r: any) {
  const planned_cost = num(r.planned_days) * num(r.daily_rate);
  const variance = planned_cost - num(r.actual_cost);
  return { planned_cost, variance };
}
function ovhCompute(r: any) {
  const variance = num(r.planned_amount) - num(r.actual_amount);
  return { variance };
}

function useLines(table: string, sheetId: string, compute: (r: any) => any) {
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
  }
  async function update(id: string, patch: any) {
    setRows((r) => r.map((x) => {
      if (x.id !== id) return x;
      const merged = { ...x, ...patch };
      const auto = compute(merged);
      return { ...merged, ...auto };
    }));
    const current = rows.find((x) => x.id === id) ?? {};
    const merged = { ...current, ...patch };
    const auto = compute(merged);
    const full = { ...patch, ...auto };
    const { error } = await supabase.from(table as any).update(full).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: [table, sheetId] });
  }
  async function remove(id: string) {
    setRows((r) => r.filter((x) => x.id !== id));
    await supabase.from(table as any).update({ deleted_at: new Date().toISOString() }).eq("id", id);
  }
  return { rows, add, update, remove };
}

function LinesTable({ cols, api, totalsKeys }: { cols: Col[]; api: ReturnType<typeof useLines>; totalsKeys: string[] }) {
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    totalsKeys.forEach((k) => { t[k] = sum(api.rows, k); });
    return t;
  }, [api.rows, totalsKeys]);

  return (
    <div className="border rounded-lg bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map((c) => <TableHead key={c.key} className="whitespace-nowrap">{c.label}</TableHead>)}
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
                  {c.key === "uom" ? (
                    <UomCell value={row[c.key] ?? ""} onChange={(v) => api.update(row.id, { uom: v })} />
                  ) : c.key === "category" && cols === OVH_COLS ? (
                    <Input value={row[c.key] ?? ""} className="h-8 min-w-32" onChange={(e) => api.update(row.id, { [c.key]: e.target.value })} />
                  ) : (
                    <Input
                      type={c.type ?? "text"}
                      className="h-8 min-w-24"
                      readOnly={c.auto}
                      value={row[c.key] ?? (c.type === "number" ? 0 : "")}
                      onChange={(e) => {
                        const v = c.type === "number" ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value;
                        api.update(row.id, { [c.key]: v });
                      }}
                    />
                  )}
                </TableCell>
              ))}
              <TableCell>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => api.remove(row.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {api.rows.length > 0 && (
            <TableRow className="font-semibold bg-muted/50">
              {cols.map((c) => (
                <TableCell key={c.key} className="p-2">
                  {totalsKeys.includes(c.key) ? fmtNGN(totals[c.key]) : c.key === cols[0].key ? "Totals" : ""}
                </TableCell>
              ))}
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="p-2 border-t">
        <Button size="sm" variant="outline" onClick={api.add}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
      </div>
    </div>
  );
}

function UomCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useQuery({
    queryKey: ["uom"],
    queryFn: async () => (await supabase.from("uom").select("name")).data ?? [],
  });
  const options = Array.from(new Set([...(data ?? []).map((u: any) => u.name), ...DEFAULT_UOMS]));
  return (
    <>
      <Input list="uom-list" className="h-8 min-w-24" value={value} onChange={(e) => onChange(e.target.value)} />
      <datalist id="uom-list">
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </>
  );
}

function BudgetTable({ projectId, rows }: { projectId?: string; rows: any[] }) {
  const qc = useQueryClient();
  const [local, setLocal] = useState<any[]>([]);
  useEffect(() => { setLocal(rows); }, [rows]);

  async function add() {
    if (!projectId) return toast.error("Pick a project first");
    const { data, error } = await supabase.from("cost_codes").insert({
      project_id: projectId, code: `CC-${Date.now().toString().slice(-5)}`, category: "Materials", budgeted_amount: 0,
    }).select().single();
    if (error) return toast.error(error.message);
    setLocal((r) => [...r, data]);
    qc.invalidateQueries({ queryKey: ["cost_codes"] });
  }
  async function update(id: string, patch: any) {
    setLocal((r) => r.map((x) => x.id === id ? { ...x, ...patch } : x));
    const { error } = await supabase.from("cost_codes").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cost_codes"] });
  }
  async function remove(id: string) {
    setLocal((r) => r.filter((x) => x.id !== id));
    await supabase.from("cost_codes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["cost_codes"] });
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cost Code</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Budgeted ₦</TableHead>
            <TableHead>Committed ₦</TableHead>
            <TableHead>Actual ₦</TableHead>
            <TableHead>Remaining</TableHead>
            <TableHead>% Used</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {local.length === 0 && (
            <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-4">No budget lines yet.</TableCell></TableRow>
          )}
          {local.map((r) => {
            const b = num(r.budgeted_amount), c = num(r.committed_amount), a = num(r.actual_amount);
            const rem = b - c - a;
            const pct = b > 0 ? ((c + a) / b) * 100 : 0;
            return (
              <TableRow key={r.id}>
                <TableCell className="p-1"><Input className="h-8 min-w-24" value={r.code ?? ""} onChange={(e) => update(r.id, { code: e.target.value })} /></TableCell>
                <TableCell className="p-1">
                  <Input list="cat-list" className="h-8 min-w-32" value={r.category ?? ""} onChange={(e) => update(r.id, { category: e.target.value })} />
                </TableCell>
                <TableCell className="p-1"><Input className="h-8 min-w-40" value={r.description ?? ""} onChange={(e) => update(r.id, { description: e.target.value })} /></TableCell>
                <TableCell className="p-1"><Input type="number" className="h-8 min-w-24" value={r.budgeted_amount ?? 0} onChange={(e) => update(r.id, { budgeted_amount: Number(e.target.value) })} /></TableCell>
                <TableCell className="text-sm">{fmtNGN(c)}</TableCell>
                <TableCell className="text-sm">{fmtNGN(a)}</TableCell>
                <TableCell className={"text-sm " + (rem < 0 ? "text-red-600" : "")}>{fmtNGN(rem)}</TableCell>
                <TableCell className={"text-sm font-semibold " + pctColor(pct)}>{pct.toFixed(0)}%</TableCell>
                <TableCell><Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <datalist id="cat-list">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="p-2 border-t">
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
      </div>
    </div>
  );
}
