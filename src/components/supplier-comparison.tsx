import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Star, FileDown } from "lucide-react";
import { toast } from "sonner";
import { fmtNGN } from "@/lib/roles";
import { useSession } from "@/hooks/use-session";
import { logActivity } from "@/lib/activity";
import { downloadCsv } from "@/lib/csv";

export function SupplierComparison({
  requisitionId,
  recordLabel,
  readOnly = false,
}: {
  requisitionId: string;
  recordLabel?: string;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useSession();
  const [onlyShortlisted, setOnlyShortlisted] = useState(false);
  const key = ["supplier_quotes", requisitionId];

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", "picker"],
    queryFn: async () => (await supabase.from("suppliers").select("id,name,rating").is("deleted_at", null)).data ?? [],
  });

  const { data: lines = [] } = useQuery({
    queryKey: ["requisition_lines", requisitionId],
    queryFn: async () =>
      (await supabase.from("requisition_lines").select("*").eq("requisition_id", requisitionId).is("deleted_at", null).order("created_at")).data ?? [],
  });

  const { data: quotes = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (await supabase.from("supplier_quotes").select("*, suppliers(name)").eq("requisition_id", requisitionId).is("deleted_at", null).order("created_at")).data ?? [],
  });

  const rows = (quotes as any[]).filter((q) => !onlyShortlisted || q.shortlisted);

  const bySupplier = useMemo(() => {
    const map = new Map<string, { name: string; total: number; lead: number[]; count: number; shortlisted: boolean }>();
    for (const q of quotes as any[]) {
      const id = q.supplier_id ?? "none";
      const e = map.get(id) ?? { name: q.suppliers?.name ?? "Unassigned", total: 0, lead: [], count: 0, shortlisted: false };
      e.total += Number(q.total_amount ?? 0);
      if (q.lead_time_days != null) e.lead.push(Number(q.lead_time_days));
      e.count += 1;
      e.shortlisted = e.shortlisted || !!q.shortlisted;
      map.set(id, e);
    }
    return Array.from(map.entries()).map(([id, v]) => ({
      id,
      ...v,
      avgLead: v.lead.length ? v.lead.reduce((a, b) => a + b, 0) / v.lead.length : null,
    })).sort((a, b) => a.total - b.total);
  }, [quotes]);

  const bestTotal = bySupplier.length ? Math.min(...bySupplier.map((s) => s.total)) : 0;
  const bestLead = bySupplier.filter((s) => s.avgLead != null).length
    ? Math.min(...bySupplier.filter((s) => s.avgLead != null).map((s) => s.avgLead as number))
    : null;

  async function addQuote() {
    const { error } = await supabase.from("supplier_quotes").insert({
      requisition_id: requisitionId,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  }

  async function update(id: string, patch: any) {
    const row = (quotes as any[]).find((q) => q.id === id);
    const merged = { ...row, ...patch };
    if ("qty" in patch || "unit_price" in patch) {
      patch.total_amount = Number(merged.qty ?? 0) * Number(merged.unit_price ?? 0);
    }
    const { error } = await supabase.from("supplier_quotes").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("supplier_quotes")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: key });
  }

  async function award(q: any) {
    if (!q.supplier_id) return toast.error("Pick a supplier on this quote first");
    await supabase.from("supplier_quotes").update({ selected: false }).eq("requisition_id", requisitionId);
    const { error } = await supabase.from("supplier_quotes").update({ selected: true, shortlisted: true }).eq("id", q.id);
    if (error) return toast.error(error.message);
    if (q.requisition_line_id) {
      await supabase.from("requisition_lines").update({ supplier_id: q.supplier_id }).eq("id", q.requisition_line_id);
    } else {
      await supabase.from("requisition_lines").update({ supplier_id: q.supplier_id }).eq("requisition_id", requisitionId);
    }
    await logActivity(`awarded supplier ${q.suppliers?.name ?? ""}`, "requisitions", requisitionId, recordLabel);
    toast.success("Supplier selected for this requisition");
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["requisition_lines", requisitionId] });
  }

  function exportCsvFile() {
    downloadCsv(
      `supplier-comparison-${recordLabel ?? requisitionId}`,
      ["Supplier", "Item", "Qty", "Unit", "Unit Price", "Total", "Lead time (days)", "Payment terms", "Valid until", "Shortlisted", "Selected", "Notes"],
      (quotes as any[]).map((q) => [
        q.suppliers?.name ?? "",
        q.item_name ?? "",
        q.qty ?? 0,
        q.unit ?? "",
        q.unit_price ?? 0,
        q.total_amount ?? 0,
        q.lead_time_days ?? "",
        q.payment_terms ?? "",
        q.validity_date ?? "",
        q.shortlisted ? "Yes" : "No",
        q.selected ? "Yes" : "No",
        q.notes ?? "",
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {bySupplier.length === 0 ? (
          <Card className="md:col-span-3"><CardContent className="pt-6 text-sm text-muted-foreground">No quotes captured yet.</CardContent></Card>
        ) : bySupplier.map((s) => (
          <Card key={s.id} className={s.total === bestTotal ? "border-primary" : ""}>
            <CardContent className="pt-6 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{s.name}</p>
                {s.total === bestTotal && <Badge>Lowest total</Badge>}
                {bestLead != null && s.avgLead === bestLead && <Badge variant="secondary">Fastest</Badge>}
              </div>
              <p className="text-sm">Total: <b>{fmtNGN(s.total)}</b></p>
              <p className="text-sm text-muted-foreground">
                Avg lead time: {s.avgLead != null ? `${s.avgLead.toFixed(0)} days` : "—"} · {s.count} quoted line{s.count === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={onlyShortlisted} onCheckedChange={(v) => setOnlyShortlisted(!!v)} /> Show shortlisted only
        </label>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsvFile}><FileDown className="h-4 w-4 mr-1" /> CSV</Button>
          {!readOnly && <Button size="sm" onClick={addQuote}><Plus className="h-4 w-4 mr-1" /> Add quote</Button>}
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-40">Supplier</TableHead>
              <TableHead className="min-w-40">Item</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Unit price ₦</TableHead>
              <TableHead>Total ₦</TableHead>
              <TableHead>Lead (days)</TableHead>
              <TableHead className="min-w-32">Payment terms</TableHead>
              <TableHead>Valid until</TableHead>
              <TableHead>Shortlist</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-4">No quotes to compare yet.</TableCell></TableRow>
            )}
            {rows.map((q: any) => (
              <TableRow key={q.id} className={q.selected ? "bg-primary/5" : ""}>
                <TableCell className="p-1">
                  <Select value={q.supplier_id ?? ""} onValueChange={(v) => update(q.id, { supplier_id: v })} disabled={readOnly}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>{(suppliers as any[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-1">
                  <Input list={`req-items-${requisitionId}`} className="h-8" defaultValue={q.item_name ?? ""} disabled={readOnly}
                    onBlur={(e) => e.target.value !== (q.item_name ?? "") && update(q.id, { item_name: e.target.value })} />
                </TableCell>
                <TableCell className="p-1"><Input className="h-8 w-20" type="number" defaultValue={q.qty ?? 0} disabled={readOnly}
                  onBlur={(e) => update(q.id, { qty: Number(e.target.value) })} /></TableCell>
                <TableCell className="p-1"><Input className="h-8 w-16" defaultValue={q.unit ?? ""} disabled={readOnly}
                  onBlur={(e) => update(q.id, { unit: e.target.value })} /></TableCell>
                <TableCell className="p-1"><Input className="h-8 w-28" type="number" defaultValue={q.unit_price ?? 0} disabled={readOnly}
                  onBlur={(e) => update(q.id, { unit_price: Number(e.target.value) })} /></TableCell>
                <TableCell className="text-sm">{fmtNGN(q.total_amount)}</TableCell>
                <TableCell className="p-1"><Input className="h-8 w-20" type="number" defaultValue={q.lead_time_days ?? ""} disabled={readOnly}
                  onBlur={(e) => update(q.id, { lead_time_days: e.target.value === "" ? null : Number(e.target.value) })} /></TableCell>
                <TableCell className="p-1"><Input className="h-8" defaultValue={q.payment_terms ?? ""} disabled={readOnly}
                  onBlur={(e) => update(q.id, { payment_terms: e.target.value })} /></TableCell>
                <TableCell className="p-1"><Input className="h-8 w-36" type="date" defaultValue={q.validity_date ?? ""} disabled={readOnly}
                  onBlur={(e) => update(q.id, { validity_date: e.target.value || null })} /></TableCell>
                <TableCell>
                  <Checkbox checked={!!q.shortlisted} disabled={readOnly} onCheckedChange={(v) => update(q.id, { shortlisted: !!v })} />
                </TableCell>
                <TableCell className="p-1">
                  {readOnly ? (
                    q.selected ? <Badge>Awarded</Badge> : null
                  ) : (
                    <div className="flex gap-1 items-center">
                      <Button size="icon" variant={q.selected ? "default" : "ghost"} title="Award to this supplier" onClick={() => award(q)}>
                        <Star className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <datalist id={`req-items-${requisitionId}`}>
          {(lines as any[]).map((l) => <option key={l.id} value={l.item_name ?? ""} />)}
        </datalist>
      </div>
    </div>
  );
}
