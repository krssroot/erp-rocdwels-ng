import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useList, useSoftDelete } from "@/lib/data";
import { PageHeader, EmptyState, ConfirmDelete } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { fmtNGN } from "@/lib/roles";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/projects/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  component: ProjectsPage,
});

const STATUSES = ["Active", "Completed", "On Hold", "Handover"] as const;

function ProjectsPage() {
  const { data, isLoading } = useList<any>("projects", { order: "created_at" });
  const del = useSoftDelete("projects");
  const [open, setOpen] = useState(false);
  const { status } = Route.useSearch();
  const rows = (data ?? []).filter((p: any) => !status || p.status === status);

  return (
    <div>
      <PageHeader
        title="Projects"
        description="All active and past construction projects"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Project</Button>
            </DialogTrigger>
            <ProjectDialog onClose={() => setOpen(false)} />
          </Dialog>
        }
      />
      {status && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <Badge>Status: {status}</Badge>
          <Link to="/projects" search={{}} className="text-muted-foreground hover:text-primary">Clear filter</Link>
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (

        <EmptyState
          title="No projects yet"
          description="Create your first construction project to get started."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Project</Button>}
        />
      ) : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contract Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link to="/projects/$id" params={{ id: p.id }} className="font-medium hover:text-primary">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.client ?? "—"}</TableCell>
                  <TableCell>{p.location ?? "—"}</TableCell>
                  <TableCell>{fmtNGN(p.contract_value)}</TableCell>
                  <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                  <TableCell>{Number(p.percent_complete ?? 0).toFixed(0)}%</TableCell>
                  <TableCell><ConfirmDelete onConfirm={() => del.mutate(p.id)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function ProjectDialog({ onClose, initial }: { onClose: () => void; initial?: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(initial ?? {
    name: "", client: "", location: "", contract_value: 0,
    start_date: "", end_date: "", status: "Active", percent_complete: 0, description: "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const payload = { ...form };
    if (!payload.start_date) delete payload.start_date;
    if (!payload.end_date) delete payload.end_date;
    const { error } = initial
      ? await supabase.from("projects").update(payload).eq("id", initial.id)
      : await supabase.from("projects").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Project saved");
    qc.invalidateQueries({ queryKey: ["projects"] });
    onClose();
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{initial ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Project name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Client"><Input value={form.client ?? ""} onChange={(e) => setForm({ ...form, client: e.target.value })} /></Field>
        <Field label="Location"><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
        <Field label="Contract value (₦)"><Input type="number" value={form.contract_value ?? 0} onChange={(e) => setForm({ ...form, contract_value: Number(e.target.value) })} /></Field>
        <Field label="Start date"><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
        <Field label="End date"><Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="% Complete"><Input type="number" min={0} max={100} value={form.percent_complete ?? 0} onChange={(e) => setForm({ ...form, percent_complete: Number(e.target.value) })} /></Field>
        <div className="md:col-span-2">
          <Field label="Description"><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></Field>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving || !form.name}>{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
