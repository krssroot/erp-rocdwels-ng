import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSoftDelete } from "@/lib/data";
import { PageHeader, EmptyState, ConfirmDelete } from "@/components/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip } from "lucide-react";
import { Attachments } from "@/components/attachments";
import { Chatter } from "@/components/chatter";
import { SupplierComparison } from "@/components/supplier-comparison";
import { fmtNGN } from "@/lib/roles";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/purchase-orders")({ ssr: false, component: POs });

const STATUSES = ["Issued", "Partially Received", "Received", "Cancelled"] as const;

function POs() {
  const qc = useQueryClient();
  const del = useSoftDelete("purchase_orders");
  const [detail, setDetail] = useState<any | null>(null);
  const { data } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => (await supabase.from("purchase_orders").select("*, suppliers(name), projects(name), requisitions(number)").is("deleted_at", null).order("created_at", { ascending: false })).data ?? [],
  });

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  }

  return (
    <div>
      <PageHeader title="Purchase Orders" description="POs are created automatically when a requisition is approved" />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No purchase orders yet" description="Approve a requisition and a PO will be created automatically." />
      ) : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>PO #</TableHead><TableHead>Requisition</TableHead><TableHead>Supplier</TableHead><TableHead>Project</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="w-56"></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.number}</TableCell>
                  <TableCell>{p.requisitions?.number ?? "—"}</TableCell>
                  <TableCell>{p.suppliers?.name ?? "—"}</TableCell>
                  <TableCell>{p.projects?.name ?? "—"}</TableCell>
                  <TableCell>{fmtNGN(p.total_amount)}</TableCell>
                  <TableCell><Badge variant="secondary">{p.status}</Badge></TableCell>
                  <TableCell className="flex items-center gap-1">
                    <Select value={p.status} onValueChange={(v) => setStatus(p.id, v)}>
                      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" title="Files, quotes & discussion" onClick={() => setDetail(p)}>
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <ConfirmDelete onConfirm={() => del.mutate(p.id)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail?.number} — {detail?.suppliers?.name ?? "Purchase Order"}</DialogTitle></DialogHeader>
          {detail && (
            <Tabs defaultValue="attachments">
              <TabsList>
                <TabsTrigger value="attachments">Attachments</TabsTrigger>
                <TabsTrigger value="suppliers">Supplier Comparison</TabsTrigger>
                <TabsTrigger value="discussion">Discussion</TabsTrigger>
              </TabsList>
              <TabsContent value="attachments">
                <Attachments entityType="purchase_orders" entityId={detail.id} recordLabel={detail.number} />
              </TabsContent>
              <TabsContent value="suppliers">
                {detail.requisition_id ? (
                  <SupplierComparison requisitionId={detail.requisition_id} recordLabel={detail.number} readOnly />
                ) : (
                  <p className="text-sm text-muted-foreground p-4">This PO is not linked to a requisition, so there are no quotes to compare.</p>
                )}
              </TabsContent>
              <TabsContent value="discussion">
                <Chatter entityType="purchase_orders" entityId={detail.id} title={`Discussion — ${detail.number}`} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
