import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Plus } from "lucide-react";
import { fmtNGN } from "@/lib/roles";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cost-codes")({
  ssr: false,
  component: CostCodesPage,
});

const CATS = ["Materials", "Labour", "Equipment", "Overhead", "Subcontractor"] as const;

function CostCodesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const del = useSoftDelete("cost_codes");

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await supabase.from("projects").select("id,name").is("deleted_at", null)).data ?? [],
  });
  const { data: codes } = useQuery({
    queryKey: ["cost_codes"],
    queryFn: async () => (await supabase.from("cost_codes").select("*, projects(name)").is("deleted_at", null)).data ?? [],
  });
  const { data: reqs } = useQuery({
    queryKey: ["requisitions"],
    queryFn: async () => (await supabase.from("requisitions").select("cost_code_id,total_amount,status").is("deleted_at", null)).data ?? [],
  });
  const { data: sheets } = useQuery({
    queryKey: ["cost_sheets_summary"],
    queryFn: async () => (await supabase.from("cost_sheet_materials").select("cost_sheet_id,actual_purchased_cost,cost_sheets!inner(cost_code_id,status)").is("deleted_at", null)).data ?? [],
  });

  function computed(codeId: string, budgeted: number) {
    const committed = (reqs ?? []).filter((r: any) => r.cost_code_id === codeId && ["Pending Approval", "Approved"].includes(r.status)).reduce((a, r: any) => a + Number(r.total_amount ?? 0), 0);
    const actual = (sheets ?? []).filter((s: any) => s.cost_sheets?.cost_code_id === codeId && s.cost_sheets?.status === "Approved").reduce((a: number, s: any) => a + Number(s.actual_purchased_cost ?? 0), 0);
    return { committed, actual, remaining: Number(budgeted ?? 0) - committed - actual };
  }

  const [form, setForm] = useState<any>({ project_id: "", code: "", category: "Materials", description: "", budgeted_amount: 0 });
  async function save() {
    if (!form.project_id || !form.code) return toast.error("Project and code are required");
    const { error } = await supabase.from("cost_codes").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Cost code created");
    qc.invalidateQueries({ queryKey: ["cost_codes"] });
    setForm({ project_id: "", code: "", category: "Materials", description: "", budgeted_amount: 0 });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Cost Codes"
        description="Per-project budget breakdown by category"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Cost Code</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Cost Code</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2"><Label>Project</Label>
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="space-y-2"><Label>Budgeted amount (₦)</Label><Input type="number" value={form.budgeted_amount} onChange={(e) => setForm({ ...form, budgeted_amount: Number(e.target.value) })} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {(codes ?? []).length === 0 ? (
        <EmptyState title="No cost codes yet" description="Create cost codes for a project to track budgets." />
      ) : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead><TableHead>Project</TableHead><TableHead>Category</TableHead>
                <TableHead>Budgeted</TableHead><TableHead>Committed</TableHead>
                <TableHead>Actual</TableHead><TableHead>Remaining</TableHead><TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(codes ?? []).map((c: any) => {
                const { committed, actual, remaining } = computed(c.id, c.budgeted_amount);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.code}</TableCell>
                    <TableCell>{c.projects?.name ?? "—"}</TableCell>
                    <TableCell>{c.category}</TableCell>
                    <TableCell>{fmtNGN(c.budgeted_amount)}</TableCell>
                    <TableCell>{fmtNGN(committed)}</TableCell>
                    <TableCell>{fmtNGN(actual)}</TableCell>
                    <TableCell className={remaining < 0 ? "text-destructive font-semibold" : ""}>{fmtNGN(remaining)}</TableCell>
                    <TableCell><ConfirmDelete onConfirm={() => del.mutate(c.id)} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
