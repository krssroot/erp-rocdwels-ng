import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSoftDelete } from "@/lib/data";
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

export const Route = createFileRoute("/_authenticated/variations")({ ssr: false, component: VO });

const STATUSES = ["Pending", "Approved", "Rejected"] as const;

function VO() {
  const qc = useQueryClient();
  const del = useSoftDelete("variation_orders");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ project_id: "", description: "", amount: 0, vo_type: "Addition", status: "Pending" });

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: async () => (await supabase.from("projects").select("id,name").is("deleted_at", null)).data ?? [] });
  const { data } = useQuery({
    queryKey: ["variation_orders"],
    queryFn: async () => (await supabase.from("variation_orders").select("*, projects(name)").is("deleted_at", null).order("created_at", { ascending: false })).data ?? [],
  });

  async function save() {
    if (!form.project_id) return toast.error("Project required");
    const { error } = await supabase.from("variation_orders").insert(form);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["variation_orders"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    setOpen(false);
    setForm({ project_id: "", description: "", amount: 0, vo_type: "Addition", status: "Pending" });
    toast.success("Variation created");
  }
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("variation_orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["variation_orders"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    if (status === "Approved") toast.success("Approved — contract value updated");
  }

  return (
    <div>
      <PageHeader title="Variation Orders" description="Approving a variation adjusts the project contract value"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Variation</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Variation Order</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <F label="Project">
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Type"><Input value={form.vo_type} onChange={(e) => setForm({ ...form, vo_type: e.target.value })} /></F>
                <F label="Amount (₦)"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></F>
                <F label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></F>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {(data ?? []).length === 0 ? <EmptyState title="No variation orders yet" /> : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Project</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="w-40"></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell>{v.projects?.name ?? "—"}</TableCell>
                  <TableCell>{v.vo_type ?? "—"}</TableCell>
                  <TableCell>{fmtNGN(v.amount)}</TableCell>
                  <TableCell className="max-w-xs truncate">{v.description ?? "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{v.status}</Badge></TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Select value={v.status} onValueChange={(x) => setStatus(v.id, x)}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <ConfirmDelete onConfirm={() => del.mutate(v.id)} />
                  </TableCell>
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
