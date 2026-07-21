import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSoftDelete } from "@/lib/data";
import { PageHeader, EmptyState, ConfirmDelete } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({ ssr: false, component: Docs });

function Docs() {
  const qc = useQueryClient();
  const del = useSoftDelete("documents");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>({ name: "", doc_type: "", version: "", expiry_date: "", file_url: "", project_id: "" });

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: async () => (await supabase.from("projects").select("id,name").is("deleted_at", null)).data ?? [] });
  const { data } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => (await supabase.from("documents").select("*, projects(name)").is("deleted_at", null).order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = (data ?? []).filter((d: any) => !q || d.name?.toLowerCase().includes(q.toLowerCase()) || d.doc_type?.toLowerCase().includes(q.toLowerCase()));

  async function save() {
    if (!form.name) return toast.error("Name required");
    const payload: any = { ...form };
    if (!payload.expiry_date) delete payload.expiry_date;
    if (!payload.project_id) delete payload.project_id;
    const { error } = await supabase.from("documents").insert(payload);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["documents"] });
    setForm({ name: "", doc_type: "", version: "", expiry_date: "", file_url: "", project_id: "" });
    setOpen(false);
    toast.success("Document added");
  }

  return (
    <div>
      <PageHeader title="Documents" description="Project documents, permits and drawings"
        action={
          <div className="flex gap-2">
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Document</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Document</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <F label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
                  <F label="Type"><Input value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })} /></F>
                  <F label="Version"><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></F>
                  <F label="Expiry"><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></F>
                  <F label="File URL"><Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} /></F>
                  <F label="Project">
                    <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </F>
                </div>
                <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />
      {filtered.length === 0 ? <EmptyState title="No documents yet" /> : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Version</TableHead><TableHead>Expiry</TableHead><TableHead>Project</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell>{d.file_url ? <a className="hover:text-primary font-medium" href={d.file_url} target="_blank" rel="noreferrer">{d.name}</a> : <span className="font-medium">{d.name}</span>}</TableCell>
                  <TableCell>{d.doc_type ?? "—"}</TableCell><TableCell>{d.version ?? "—"}</TableCell>
                  <TableCell>{d.expiry_date ?? "—"}</TableCell><TableCell>{d.projects?.name ?? "—"}</TableCell>
                  <TableCell><ConfirmDelete onConfirm={() => del.mutate(d.id)} /></TableCell>
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
