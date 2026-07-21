import { createFileRoute } from "@tanstack/react-router";
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
import { Progress } from "@/components/ui/progress";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/milestones")({ ssr: false, component: MS });

function MS() {
  const qc = useQueryClient();
  const del = useSoftDelete("milestones");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ project_id: "", name: "", target_date: "", actual_date: "", percent_complete: 0, status: "Pending" });

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: async () => (await supabase.from("projects").select("id,name").is("deleted_at", null)).data ?? [] });
  const { data } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => (await supabase.from("milestones").select("*, projects(name)").is("deleted_at", null).order("target_date")).data ?? [],
  });

  async function save() {
    if (!form.project_id || !form.name) return toast.error("Project and name required");
    const payload: any = { ...form };
    if (!payload.target_date) delete payload.target_date;
    if (!payload.actual_date) delete payload.actual_date;
    const { error } = await supabase.from("milestones").insert(payload);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["milestones"] });
    setOpen(false);
    setForm({ project_id: "", name: "", target_date: "", actual_date: "", percent_complete: 0, status: "Pending" });
    toast.success("Milestone added");
  }

  return (
    <div>
      <PageHeader title="Milestones"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Milestone</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Milestone</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <F label="Project">
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Target date"><Input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></F>
                  <F label="Actual date"><Input type="date" value={form.actual_date} onChange={(e) => setForm({ ...form, actual_date: e.target.value })} /></F>
                </div>
                <F label="% complete"><Input type="number" min={0} max={100} value={form.percent_complete} onChange={(e) => setForm({ ...form, percent_complete: Number(e.target.value) })} /></F>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {(data ?? []).length === 0 ? <EmptyState title="No milestones yet" /> : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Milestone</TableHead><TableHead>Target</TableHead><TableHead>Actual</TableHead><TableHead>Progress</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell>{m.projects?.name ?? "—"}</TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.target_date ?? "—"}</TableCell>
                  <TableCell>{m.actual_date ?? "—"}</TableCell>
                  <TableCell className="w-48"><div className="flex items-center gap-2"><Progress value={Number(m.percent_complete ?? 0)} /><span className="text-xs">{Number(m.percent_complete ?? 0).toFixed(0)}%</span></div></TableCell>
                  <TableCell><ConfirmDelete onConfirm={() => del.mutate(m.id)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
