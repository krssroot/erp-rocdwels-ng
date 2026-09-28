import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileDown } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { addFooter, createBrandedDoc, keyValueBlock, sectionTitle, table } from "@/lib/pdf";
import { useSession } from "@/hooks/use-session";

function fmt(d?: string) {
  return d ? new Date(d).toLocaleString("en-NG") : "—";
}

export function ApprovalHistory({
  requisitionId,
  budgetId,
  recordLabel,
}: {
  requisitionId?: string;
  budgetId?: string;
  recordLabel?: string;
}) {
  const { user } = useSession();
  const { data: rows = [] } = useQuery({
    queryKey: ["approval_history", requisitionId ?? budgetId ?? "none"],
    enabled: !!(requisitionId || budgetId),
    queryFn: async () => {
      let q = supabase.from("approval_history").select("*").order("created_at", { ascending: false });
      q = requisitionId ? q.eq("requisition_id", requisitionId) : q.eq("budget_id", budgetId!);
      return (await q).data ?? [];
    },
  });

  const kind = requisitionId ? "Requisition" : "Budget";
  const label = recordLabel || kind;
  const slug = `approval-history-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const data = [...rows].reverse().map((r: any) => [
    r.by_email ?? "System",
    r.action ?? "",
    r.from_status ? `${r.from_status} → ${r.to_status ?? ""}` : r.to_status ?? "",
    fmt(r.created_at),
    r.notes ?? "",
  ]);
  const headers = ["Approver", "Action", "Status change", "Timestamp", "Notes"];

  function exportPdf() {
    const doc = createBrandedDoc(`${kind} Approval History`);
    let y = keyValueBlock(doc, [["Record", label], ["Type", kind], ["Actions", String(rows.length)]], 80);
    y = sectionTitle(doc, "Approval Trail", y);
    table(doc, headers, data.length ? data : [["—", "No actions recorded", "", "", ""]], y);
    addFooter(doc, user?.email ?? undefined);
    doc.save(`${slug}.pdf`);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
        <Button size="sm" variant="outline" onClick={() => downloadCsv(slug, headers, data)}><FileDown className="h-4 w-4 mr-1" /> CSV</Button>
      </div>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">No workflow actions recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r: any) => (
            <li key={r.id} className="flex gap-3 text-sm">
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="font-medium">
                  {r.action && <span className="capitalize">{r.action}: </span>}
                  {r.from_status ? `${r.from_status} → ` : ""}
                  {r.to_status}
                  {r.to_status === "Paid" && <Badge className="ml-2">PAID</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.by_email ?? "System"} · {fmt(r.created_at)}
                </p>
                {r.notes && <p className="text-xs mt-1">{r.notes}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
