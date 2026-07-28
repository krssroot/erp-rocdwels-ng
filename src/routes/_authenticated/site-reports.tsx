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
import { Plus, FileDown } from "lucide-react";
import { toast } from "sonner";
import { exportSiteReportPdf } from "@/lib/pdf-exports";

export const Route = createFileRoute("/_authenticated/site-reports")({ ssr: false, component: SR });

const STATUSES = ["Draft", "Submitted", "Reviewed"] as const;

function SR() {
  const qc = useQueryClient();
  const del = useSoftDelete("site_reports");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ project_id: "", report_date: new Date().toISOString().slice(0, 10), weather: "", workers_count: 0, tomorrow_plan: "", status: "Draft" });

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: async () => (await supabase.from("projects").select("id,name").is("deleted_at", null)).data ?? [] });
  const { data } = useQuery({
    queryKey: ["site_reports"],
    queryFn: async () => (await supabase.from("site_reports").select("*, projects(name)").is("deleted_at", null).order("report_date", { ascending: false })).data ?? [],
  });

  async function save() {
    if (!form.project_id) return toast.error("Project required");
    const { error } = await supabase.from("site_reports").insert(form);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["site_reports"] });
    setForm({ project_id: "", report_date: new Date().toISOString().slice(0, 10), weather: "", workers_count: 0, tomorrow_plan: "", status: "Draft" });
    setOpen(false);
    toast.success("Report created");
  }

  return (
    <div>
      <PageHeader title="Daily Site Reports" description="Site progress, weather, workers, and issues"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Report</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Site Report</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <F label="Project">
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Date"><Input type="date" value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} /></F>
                  <F label="Weather"><Input value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} /></F>
                </div>
                <F label="Workers on site"><Input type="number" value={form.workers_count} onChange={(e) => setForm({ ...form, workers_count: Number(e.target.value) })} /></F>
                <F label="Tomorrow's plan"><Textarea value={form.tomorrow_plan} onChange={(e) => setForm({ ...form, tomorrow_plan: e.target.value })} /></F>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {(data ?? []).length === 0 ? <EmptyState title="No site reports yet" /> : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Project</TableHead><TableHead>Weather</TableHead><TableHead>Workers</TableHead><TableHead>Status</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.report_date}</TableCell>
                  <TableCell>{r.projects?.name ?? "—"}</TableCell>
                  <TableCell>{r.weather ?? "—"}</TableCell>
                  <TableCell>{r.workers_count ?? 0}</TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={async (v) => { await supabase.from("site_reports").update({ status: v }).eq("id", r.id); qc.invalidateQueries({ queryKey: ["site_reports"] }); }}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" title="Export PDF" onClick={() => exportSiteReportPdf({ report: r, projectName: r.projects?.name })}>
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
      {/* Badge kept for potential future use */}
      <div className="hidden"><Badge /></div>
    </div>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
