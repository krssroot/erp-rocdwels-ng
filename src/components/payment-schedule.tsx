import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { fmtNGN } from "@/lib/roles";
import { useSession } from "@/hooks/use-session";

export function PaymentSchedule({
  requisitionId,
  projectId,
  defaultAmount = 0,
}: {
  requisitionId: string;
  projectId?: string | null;
  defaultAmount?: number;
}) {
  const qc = useQueryClient();
  const { user, roles } = useSession();
  const canManage = roles.includes("accountant") || roles.includes("admin");
  const [form, setForm] = useState({ amount: String(defaultAmount || ""), bank: "", due_date: "", notes: "" });
  const key = ["payment_schedules", requisitionId];

  const { data: rows = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await supabase
          .from("payment_schedules")
          .select("*")
          .eq("requisition_id", requisitionId)
          .is("deleted_at", null)
          .order("created_at")
      ).data ?? [],
  });

  async function add() {
    const { error } = await supabase.from("payment_schedules").insert({
      requisition_id: requisitionId,
      project_id: projectId ?? null,
      amount: Number(form.amount || 0),
      bank: form.bank || null,
      due_date: form.due_date || null,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setForm({ amount: "", bank: "", due_date: "", notes: "" });
    toast.success("Payment schedule added");
    qc.invalidateQueries({ queryKey: key });
  }

  async function confirm(id: string) {
    const { error } = await supabase.from("payment_schedules").update({ status: "Confirmed" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payment confirmed — mark the requisition as PAID to post it to expenditure");
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-lg bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Amount</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confirmed</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-4">
                  No payment schedule yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{fmtNGN(r.amount)}</TableCell>
                <TableCell>{r.bank ?? "—"}</TableCell>
                <TableCell>{r.due_date ? new Date(r.due_date).toLocaleDateString("en-NG") : "—"}</TableCell>
                <TableCell className="text-sm">{r.notes ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "Confirmed" ? "default" : "secondary"}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {r.confirmed_at ? new Date(r.confirmed_at).toLocaleString("en-NG") : "—"}
                </TableCell>
                <TableCell>
                  {r.status !== "Confirmed" && (
                    <Button size="sm" variant="outline" disabled={!canManage} onClick={() => confirm(r.id)}>
                      <Check className="h-4 w-4 mr-1" /> Confirm
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManage ? (
        <div className="grid gap-3 md:grid-cols-5 items-end border rounded-lg p-3 bg-card">
          <div className="space-y-1">
            <Label className="text-xs">Amount ₦</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bank</Label>
            <Input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Due date</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <Button onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Add schedule
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Only the Accountant can create and confirm payment schedules.</p>
      )}
    </div>
  );
}
