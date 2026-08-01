import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSoftDelete } from "@/lib/data";
import { PageHeader, EmptyState, ConfirmDelete } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle, FileDown } from "lucide-react";
import { fmtNGN } from "@/lib/roles";
import { useSession } from "@/hooks/use-session";
import { exportRequisitionPdf } from "@/lib/pdf-exports";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/requisitions")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search.status === "string" ? search.status : undefined,
    project: typeof search.project === "string" ? search.project : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  }),
  component: RequisitionsPage,
});

const TYPES = ["Materials", "Labour", "Equipment", "Services"] as const;
const STATUSES = ["Draft", "Pending Approval", "Approved", "Rejected", "Fulfilled"] as const;

export async function downloadRequisitionPdf(req: any, generatedBy?: string) {
  const [{ data: lines }, { data: sups }] = await Promise.all([
    supabase.from("requisition_lines").select("*").eq("requisition_id", req.id).is("deleted_at", null).order("created_at"),
    supabase.from("suppliers").select("id,name").is("deleted_at", null),
  ]);
  const nameById = new Map((sups ?? []).map((s: any) => [s.id, s.name]));
  exportRequisitionPdf({
    req,
    projectName: req.projects?.name,
    costCodeLabel: req.cost_codes?.code,
    lines: lines ?? [],
    supplierName: (id?: string) => (id ? nameById.get(id) ?? "—" : "—"),
    generatedBy,
  });
}

function RequisitionsPage() {
  const qc = useQueryClient();
  const del = useSoftDelete("requisitions");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { status, project, from, to } = Route.useSearch();
  const { user } = useSession();

  const { data: reqs } = useQuery({
    queryKey: ["requisitions"],
    queryFn: async () => (await supabase.from("requisitions").select("*, projects(name), cost_codes(code,budgeted_amount)").is("deleted_at", null).order("created_at", { ascending: false })).data ?? [],
  });

  const rows = (reqs ?? []).filter((r: any) => {
    if (status && r.status !== status) return false;
    if (project && r.project_id !== project) return false;
    const d = new Date(r.created_at).getTime();
    if (from && d < new Date(from + "T00:00:00").getTime()) return false;
    if (to && d > new Date(to + "T23:59:59").getTime()) return false;
    return true;
  });
  const filtered = !!(status || project || from || to);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("requisitions").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Status → ${status}`);
    qc.invalidateQueries({ queryKey: ["requisitions"] });
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  }


  return (
    <div>
      <PageHeader
        title="Requisitions"
        description="Material, labour, equipment and services requests"
        action={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Requisition
          </Button>
        }
      />
      {filtered && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {status && <Badge>Status: {status}</Badge>}
          {(from || to) && <Badge variant="secondary">{from ?? "…"} → {to ?? "…"}</Badge>}
          <Link to="/requisitions" search={{}} className="text-muted-foreground hover:text-primary">Clear filters</Link>
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState title={filtered ? "No requisitions match this filter" : "No requisitions yet"} description={filtered ? "Try clearing the filter." : "Raise a new requisition for materials, labour, equipment or services."} />
      ) : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead><TableHead>Project</TableHead><TableHead>Type</TableHead>
                <TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="w-48"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell><button className="font-medium hover:text-primary" onClick={() => { setEditing(r); setOpen(true); }}>{r.number}</button></TableCell>
                  <TableCell>{r.projects?.name ?? "—"}</TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>{fmtNGN(r.total_amount)}</TableCell>
                  <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Select value={r.status} onValueChange={(v) => setStatus(r.id, v)}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" title="Export PDF" onClick={() => downloadRequisitionPdf(r, user?.email ?? undefined)}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <ConfirmDelete onConfirm={() => del.mutate(r.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <RequisitionDialog key={editing?.id ?? "new"} initial={editing} onClose={() => setOpen(false)} />
      </Dialog>
    </div>
  );
}

function RequisitionDialog({ initial, onClose }: { initial: any | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(initial ?? {
    project_id: "", cost_code_id: "", type: "Materials", department: "",
    deadline: "", is_change_order: false, status: "Draft", notes: "",
  });
  const [lines, setLines] = useState<any[]>([]);
  const [reqId, setReqId] = useState<string | null>(initial?.id ?? null);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("id,name").is("deleted_at", null)).data ?? [],
  });
  const { data: codes } = useQuery({
    queryKey: ["cost_codes"],
    queryFn: async () => (await supabase.from("cost_codes").select("id,code,project_id,budgeted_amount").is("deleted_at", null)).data ?? [],
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("id,name").is("deleted_at", null)).data ?? [],
  });

  useEffect(() => {
    if (!reqId) { setLines([]); return; }
    supabase.from("requisition_lines").select("*").eq("requisition_id", reqId).is("deleted_at", null).order("created_at").then(({ data }) => setLines(data ?? []));
  }, [reqId]);

  const total = lines.reduce((a, l) => a + Number(l.total ?? 0), 0);

  const codeInfo = (codes ?? []).find((c: any) => c.id === form.cost_code_id);
  const budgetWarn = codeInfo && total > Number(codeInfo.budgeted_amount ?? 0);

  async function ensureSaved() {
    if (reqId) {
      const { error } = await supabase.from("requisitions").update({ ...form, total_amount: total }).eq("id", reqId);
      if (error) throw error;
      return reqId;
    }
    if (!form.project_id) throw new Error("Project required");
    const payload: any = { ...form, total_amount: total };
    if (!payload.cost_code_id) delete payload.cost_code_id;
    if (!payload.deadline) delete payload.deadline;
    const { data, error } = await supabase.from("requisitions").insert(payload).select().single();
    if (error) throw error;
    setReqId(data.id);
    return data.id;
  }

  async function addLine() {
    try {
      const rid = await ensureSaved();
      const { data, error } = await supabase.from("requisition_lines").insert({ requisition_id: rid }).select().single();
      if (error) throw error;
      setLines((l) => [...l, data]);
    } catch (e: any) { toast.error(e.message); }
  }

  async function updateLine(id: string, patch: any) {
    const newLines = lines.map((l) => (l.id === id ? { ...l, ...patch } : l));
    const line = newLines.find((l) => l.id === id)!;
    line.total = Number(line.qty ?? 0) * Number(line.unit_cost ?? 0);
    if ("qty" in patch || "unit_cost" in patch) patch.total = line.total;
    setLines(newLines);
    await supabase.from("requisition_lines").update(patch).eq("id", id);
  }
  async function removeLine(id: string) {
    setLines((l) => l.filter((x) => x.id !== id));
    await supabase.from("requisition_lines").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  }

  async function save() {
    try {
      await ensureSaved();
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["requisitions"] });
      onClose();
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <DialogContent className="max-w-4xl">
      <DialogHeader><DialogTitle>{initial ? "Edit Requisition" : "New Requisition"}</DialogTitle></DialogHeader>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2"><Label>Project</Label>
          <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v, cost_code_id: "" })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Cost Code</Label>
          <Select value={form.cost_code_id} onValueChange={(v) => setForm({ ...form, cost_code_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{(codes ?? []).filter((c: any) => !form.project_id || c.project_id === form.project_id).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Department</Label><Input value={form.department ?? ""} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
        <div className="space-y-2"><Label>Deadline</Label><Input type="date" value={form.deadline ?? ""} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
        <div className="space-y-2"><Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 md:col-span-3 text-sm">
          <Checkbox checked={!!form.is_change_order} onCheckedChange={(v) => setForm({ ...form, is_change_order: !!v })} />
          This is a Change Order
        </label>
      </div>

      {budgetWarn && (
        <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Requisition total {fmtNGN(total)} exceeds cost-code budget {fmtNGN(codeInfo?.budgeted_amount)}.
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Unit</TableHead>
              <TableHead>Unit Cost</TableHead><TableHead>Total</TableHead><TableHead>Supplier</TableHead><TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-4">No lines. {reqId ? "" : "Save the header first."}</TableCell></TableRow>}
            {lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="p-1"><Input className="h-8" value={l.item_name ?? ""} onChange={(e) => updateLine(l.id, { item_name: e.target.value })} /></TableCell>
                <TableCell className="p-1"><Input className="h-8 w-20" type="number" value={l.qty ?? 0} onChange={(e) => updateLine(l.id, { qty: Number(e.target.value) })} /></TableCell>
                <TableCell className="p-1"><Input className="h-8 w-16" value={l.unit ?? ""} onChange={(e) => updateLine(l.id, { unit: e.target.value })} /></TableCell>
                <TableCell className="p-1"><Input className="h-8 w-28" type="number" value={l.unit_cost ?? 0} onChange={(e) => updateLine(l.id, { unit_cost: Number(e.target.value) })} /></TableCell>
                <TableCell className="p-1 text-sm">{fmtNGN(l.total)}</TableCell>
                <TableCell className="p-1">
                  <Select value={l.supplier_id ?? ""} onValueChange={(v) => updateLine(l.id, { supplier_id: v })}>
                    <SelectTrigger className="h-8 w-40"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(suppliers ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell><Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeLine(l.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-2 border-t flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-4 w-4 mr-1" /> Add Line</Button>
          <div className="text-sm font-semibold">Total: {fmtNGN(total)}</div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          disabled={!reqId}
          onClick={() => exportRequisitionPdf({
            req: { ...form, id: reqId, number: initial?.number, created_at: initial?.created_at, updated_at: initial?.updated_at, total_amount: total },
            projectName: (projects ?? []).find((p: any) => p.id === form.project_id)?.name,
            costCodeLabel: codeInfo?.code,
            lines,
            supplierName: (id?: string) => (suppliers ?? []).find((s: any) => s.id === id)?.name ?? "—",
            generatedBy: dialogUser?.email ?? undefined,
          })}
        >
          <FileDown className="h-4 w-4 mr-2" /> Export PDF
        </Button>
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button onClick={save}>Save</Button>
      </DialogFooter>

    </DialogContent>
  );
}
