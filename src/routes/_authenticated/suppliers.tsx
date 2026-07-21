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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  ssr: false,
  component: SuppliersPage,
});

function SuppliersPage() {
  const qc = useQueryClient();
  const del = useSoftDelete("suppliers");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: "", contact_person: "", phone: "", email: "", category: "", tax_id: "", bank_details: "", rating: 0, notes: "" });

  const { data } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").is("deleted_at", null).order("name")).data ?? [],
  });

  async function save() {
    if (!form.name) return toast.error("Name required");
    const { error } = await supabase.from("suppliers").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Supplier added");
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    setForm({ name: "", contact_person: "", phone: "", email: "", category: "", tax_id: "", bank_details: "", rating: 0, notes: "" });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader title="Suppliers" description="Vendor and subcontractor directory"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Supplier</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
              <div className="grid gap-3 md:grid-cols-2">
                <F label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
                <F label="Contact person"><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></F>
                <F label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
                <F label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
                <F label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></F>
                <F label="Tax ID"><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></F>
                <div className="md:col-span-2"><F label="Bank details"><Input value={form.bank_details} onChange={(e) => setForm({ ...form, bank_details: e.target.value })} /></F></div>
                <F label="Rating (0-5)"><Input type="number" min={0} max={5} value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} /></F>
                <div className="md:col-span-2"><F label="Notes"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F></div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {(data ?? []).length === 0 ? <EmptyState title="No suppliers yet" /> : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Rating</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.contact_person ?? "—"}</TableCell>
                  <TableCell>{s.phone ?? "—"}</TableCell>
                  <TableCell>{s.email ?? "—"}</TableCell>
                  <TableCell><div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={"h-3 w-3 " + (i < (s.rating ?? 0) ? "fill-primary text-primary" : "text-muted-foreground")} />)}</div></TableCell>
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
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
