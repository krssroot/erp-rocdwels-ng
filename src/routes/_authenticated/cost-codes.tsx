import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSoftDelete } from "@/lib/data";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileDown } from "lucide-react";
import { fmtNGN } from "@/lib/roles";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { exportBudgetPdf } from "@/lib/pdf-exports";


export const Route = createFileRoute("/_authenticated/cost-codes")({
  ssr: false,
  component: CostCodesPage,
});

const CATS = ["Materials", "Labour", "Equipment", "Overhead", "Subcontractor"] as const;

function CostCodesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [openBudget, setOpenBudget] = useState(false);
  const del = useSoftDelete("cost_codes");
  const { roles } = useSession();

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

  // New Budget dialog state
  const [budgetProject, setBudgetProject] = useState<string>("");
  const [budgetLines, setBudgetLines] = useState<any[]>([]);

  function addBudgetLine() {
    setBudgetLines([...budgetLines, { code: "", category: "Materials", description: "", budgeted_amount: 0 }]);
  }
  function updateBudgetLine(i: number, col: string, val: any) {
    const copy = [...budgetLines];
    copy[i] = { ...copy[i], [col]: val };
    setBudgetLines(copy);
  }
  async function saveBudget() {
    if (!budgetProject) return toast.error("Project is required");
    if (budgetLines.length === 0) return toast.error("Add at least one cost code line");
    const payload = budgetLines.map((l) => ({ ...l, project_id: budgetProject }));
    const { error } = await supabase.from("cost_codes").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Budget created");
    qc.invalidateQueries({ queryKey: ["cost_codes"] });
    setBudgetProject(""); setBudgetLines([]); setOpenBudget(false);
  }

  const canCreateBudget = roles.some((r) => ["admin", "accountant", "site_manager"].includes(r));

  return (
    <div>
      <PageHeader
        title="Cost Codes"
        description="Per-project budget breakdown by category"
        action={
          <div className="flex items-center gap-2">
            {canCreateBudget && (
              <>
                <Dialog open={openBudget} onOpenChange={setOpenBudget}>
                  <DialogTrigger asChild><Button variant="secondary">New Budget</Button></DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>New Budget</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-2"><Label>Project</Label>
                        <Select value={budgetProject} onValueChange={(v) => setBudgetProject(v)}>
                          <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                          <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <table className="w-full">
                          <thead><tr><th>Code</th><th>Category</th><th>Description</th><th>Budgeted</th></tr></thead>
                          <tbody>
                            {budgetLines.map((l, i) => (
                              <tr key={i} className="border-t">
                                <td><Input value={l.code} onChange={(e) => updateBudgetLine(i, "code", e.target.value)} /></td>
                                <td>
                                  <Select value={l.category} onValueChange={(v) => updateBudgetLine(i, "category", v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                  </Select>
                                </td>
                                <td><Input value={l.description} onChange={(e) => updateBudgetLine(i, "description", e.target.value)} /></td>
                                <td><Input type="number" value={l.budgeted_amount} onChange={(e) => updateBudgetLine(i, "budgeted_amount", Number(e.target.value))} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="mt-2"><Button variant="ghost" onClick={addBudgetLine}>Add a line</Button></div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={saveBudget}>Create Budget</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <div className="ml-2">
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Cost Code</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>New Cost Code</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2"><Label>Project</Label>
                          <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v, cost_code_id: "" })}>
                            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                            <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Category</Label>
                          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                        <div className="space-y-2"><Label>Budgeted Amount</Label><Input type="number" value={form.budgeted_amount} onChange={(e) => setForm({ ...form, budgeted_amount: Number(e.target.value) })} /></div>
                      </div>
                      <DialogFooter><Button onClick={save}>Create</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </>
            )}
          </div>
        }
      />

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead><TableHead>Project</TableHead><TableHead>Category</TableHead>
              <TableHead>Budgeted</TableHead><TableHead>Committed</TableHead><TableHead>Actual</TableHead><TableHead>Remaining</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(codes ?? []).map((c: any) => {
              const cmp = computed(c.id, Number(c.budgeted_amount ?? 0));
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.code}</TableCell>
                  <TableCell>{c.projects?.name ?? "—"}</TableCell>
                  <TableCell>{c.category}</TableCell>
                  <TableCell>{fmtNGN(c.budgeted_amount ?? 0)}</TableCell>
                  <TableCell>{fmtNGN(cmp.committed)}</TableCell>
                  <TableCell>{fmtNGN(cmp.actual)}</TableCell>
                  <TableCell>{fmtNGN(cmp.remaining)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" title="Export project budget PDF" onClick={async () => {
                      const { data: proj } = await supabase.from("projects").select("*").eq("id", c.project_id).single();
                      const projCodes = (codes ?? []).filter((x: any) => x.project_id === c.project_id).map((x: any) => {
                        const k = computed(x.id, Number(x.budgeted_amount ?? 0));
                        return { ...x, committed_amount: k.committed, actual_amount: k.actual };
                      });
                      if (proj) exportBudgetPdf({ project: proj, costCodes: projCodes });
                    }}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
