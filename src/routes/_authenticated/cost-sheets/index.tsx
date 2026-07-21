import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSoftDelete } from "@/lib/data";
import { PageHeader, EmptyState, ConfirmDelete } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { fmtNGN } from "@/lib/roles";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cost-sheets/")({
  ssr: false,
  component: CostSheetsPage,
});

const STATUSES = ["Draft", "Confirmed", "Budget Review", "Approved", "Done"] as const;

function CostSheetsPage() {
  const qc = useQueryClient();
  const del = useSoftDelete("cost_sheets");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ project_id: "", cost_code_id: "", title: "", status: "Draft" });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("id,name").is("deleted_at", null)).data ?? [],
  });
  const { data: codes } = useQuery({
    queryKey: ["cost_codes"],
    queryFn: async () => (await supabase.from("cost_codes").select("id,code,project_id").is("deleted_at", null)).data ?? [],
  });
  const { data: sheets } = useQuery({
    queryKey: ["cost_sheets"],
    queryFn: async () => (await supabase.from("cost_sheets").select("*, projects(name)").is("deleted_at", null).order("created_at", { ascending: false })).data ?? [],
  });

  async function save() {
    if (!form.project_id) return toast.error("Project is required");
    const payload: any = { project_id: form.project_id, title: form.title, status: form.status };
    if (form.cost_code_id) payload.cost_code_id = form.cost_code_id;
    const { error } = await supabase.from("cost_sheets").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Cost sheet created");
    qc.invalidateQueries({ queryKey: ["cost_sheets"] });
    setForm({ project_id: "", cost_code_id: "", title: "", status: "Draft" });
    setOpen(false);
  }

  const availableCodes = (codes ?? []).filter((c: any) => !form.project_id || c.project_id === form.project_id);

  return (
    <div>
      <PageHeader
        title="Job Cost Sheets"
        description="Track planned vs actual across materials, labour, and overhead"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Cost Sheet</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Job Cost Sheet</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Project</Label>
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v, cost_code_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Cost code (optional)</Label>
                  <Select value={form.cost_code_id} onValueChange={(v) => setForm({ ...form, cost_code_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select cost code" /></SelectTrigger>
                    <SelectContent>{availableCodes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-2"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {(sheets ?? []).length === 0 ? (
        <EmptyState title="No cost sheets yet" description="Create a Job Cost Sheet to plan and track costs." />
      ) : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead><TableHead>Project</TableHead><TableHead>Title</TableHead>
                <TableHead>Status</TableHead><TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sheets ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell><Link to="/cost-sheets/$id" params={{ id: s.id }} className="font-medium hover:text-primary">{s.number}</Link></TableCell>
                  <TableCell>{s.projects?.name ?? "—"}</TableCell>
                  <TableCell>{s.title ?? "—"}</TableCell>
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
