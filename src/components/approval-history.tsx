import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

export function ApprovalHistory({
  requisitionId,
  budgetId,
}: {
  requisitionId?: string;
  budgetId?: string;
}) {
  const { data: rows = [] } = useQuery({
    queryKey: ["approval_history", requisitionId ?? budgetId ?? "none"],
    enabled: !!(requisitionId || budgetId),
    queryFn: async () => {
      let q = supabase.from("approval_history").select("*").order("created_at", { ascending: false });
      q = requisitionId ? q.eq("requisition_id", requisitionId) : q.eq("budget_id", budgetId!);
      return (await q).data ?? [];
    },
  });

  if (!rows.length)
    return <p className="text-sm text-muted-foreground">No workflow actions recorded yet.</p>;

  return (
    <ol className="space-y-3">
      {rows.map((r: any) => (
        <li key={r.id} className="flex gap-3 text-sm">
          <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <div>
            <p className="font-medium">
              {r.from_status ? `${r.from_status} → ` : ""}
              {r.to_status}
              {r.to_status === "Paid" && <Badge className="ml-2">PAID</Badge>}
            </p>
            <p className="text-xs text-muted-foreground">
              {r.by_email ?? "System"} · {new Date(r.created_at).toLocaleString("en-NG")}
            </p>
            {r.notes && <p className="text-xs mt-1">{r.notes}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
