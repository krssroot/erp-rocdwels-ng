import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useList, useSoftDelete } from "@/lib/data";
import { PageHeader, EmptyState, ConfirmDelete } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/cost-sheets/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
    project: typeof search.project === "string" ? search.project : undefined,
  }),
  component: CostSheetsPage,
});

const STATUSES = ["Draft", "Confirmed", "Budget Validated", "Approved", "Done"] as const;

function CostSheetsPage() {
  const { data, isLoading } = useList<any>("cost_sheets", { select: "*, projects(name)", order: "created_at" });
  const del = useSoftDelete("cost_sheets");
  const [open, setOpen] = useState(false);
  const { from, to, status, project } = Route.useSearch();

  const rows = (data ?? []).filter((s: any) => {
    if (status && s.status !== status) return false;
    if (project && s.project_id !== project) return false;
    const d = new Date(s.sheet_date ?? s.created_at).getTime();
    if (from && d < new Date(from + "T00:00:00").getTime()) return false;
    if (to && d > new Date(to + "T23:59:59").getTime()) return false;
    return true;
  });
  const filtered = !!(from || to || status || project);

  return (
    <div>
      <PageHeader
        title="Job Cost Sheets"
        description="Odoo-style job costing with integrated budget"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Cost Sheet</Button>
            </DialogTrigger>
            <NewSheetDialog onClose={() => setOpen(false)} />
          </Dialog>
        }
      />
      {filtered && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {status && <Badge>Status: {status}</Badge>}
          {(from || to) && <Badge variant="secondary">{from ?? "…"} → {to ?? "…"}</Badge>}
          <Link to="/cost-sheets" search={{}} className="text-muted-foreground hover:text-primary">Clear filters</Link>
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title={filtered ? "No cost sheets match this filter" : "No cost sheets yet"} description={filtered ? "Try clearing the filter or widening the date range." : "Create your first job cost sheet."} />

      ) : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link to="/cost-sheets/$id" params={{ id: s.id }} className="font-medium hover:text-primary">
                      {s.number}
                    </Link>
                  </TableCell>
                  <TableCell>{s.title ?? "—"}</TableCell>
                  <TableCell>{s.projects?.name ?? "—"}</TableCell>
                  <TableCell>{s.sheet_date ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{s.status}</Badge></TableCell>
                  <TableCell><ConfirmDelete onConfirm={() => del.mutate(s.id)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function NewSheetDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: projects } = useList<any>("projects");
  const [form, setForm] = useState<any>({
    title: "", project_id: "", cost_code_id: "", status: "Draft",
    sheet_date: new Date().toISOString().slice(0, 10), currency: "NGN",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.project_id) return toast.error("Project is required");
    setSaving(true);
    const payload: any = { ...form };
    if (!payload.cost_code_id) delete payload.cost_code_id;
    const { data, error } = await supabase.from("cost_sheets").insert(payload).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cost_sheets"] });
    onClose();
    nav({ to: "/cost-sheets/$id", params: { id: data.id } });
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Cost Sheet</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Job Name</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Project</Label>
          <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v, cost_code_id: "" })}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date</Label>
          <Input type="date" value={form.sheet_date} onChange={(e) => setForm({ ...form, sheet_date: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
