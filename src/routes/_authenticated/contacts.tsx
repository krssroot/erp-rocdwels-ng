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
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contacts")({ ssr: false, component: Contacts });

function Contacts() {
  const qc = useQueryClient();
  const del = useSoftDelete("contacts");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", contact_type: "", phone: "", email: "", company: "", project_id: "", notes: "" });

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: async () => (await supabase.from("projects").select("id,name").is("deleted_at", null)).data ?? [] });
  const { data } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => (await supabase.from("contacts").select("*, projects(name)").is("deleted_at", null).order("name")).data ?? [],
  });

  async function save() {
    if (!form.name) return toast.error("Name required");
    const payload: any = { ...form };
    if (!payload.project_id) delete payload.project_id;
    const { error } = await supabase.from("contacts").insert(payload);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["contacts"] });
    setOpen(false);
    setForm({ name: "", contact_type: "", phone: "", email: "", company: "", project_id: "", notes: "" });
    toast.success("Contact saved");
  }

  return (
    <div>
      <PageHeader title="Contacts"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Contact</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
              <div className="grid gap-3 md:grid-cols-2">
                <F label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
                <F label="Type"><Input value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })} /></F>
                <F label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
                <F label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
                <F label="Company"><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></F>
                <F label="Project">
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <div className="md:col-span-2"><F label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F></div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {(data ?? []).length === 0 ? <EmptyState title="No contacts yet" /> : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Company</TableHead><TableHead>Project</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.contact_type ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.company ?? "—"}</TableCell>
                  <TableCell>{c.projects?.name ?? "—"}</TableCell>
                  <TableCell><ConfirmDelete onConfirm={() => del.mutate(c.id)} /></TableCell>
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
