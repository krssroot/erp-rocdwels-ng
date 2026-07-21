import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/recently-deleted")({ ssr: false, component: RD });

const TABLES = [
  { table: "projects", label: "Projects" },
  { table: "cost_codes", label: "Cost Codes" },
  { table: "cost_sheets", label: "Cost Sheets" },
  { table: "requisitions", label: "Requisitions" },
  { table: "purchase_orders", label: "Purchase Orders" },
  { table: "suppliers", label: "Suppliers" },
  { table: "documents", label: "Documents" },
  { table: "site_reports", label: "Site Reports" },
  { table: "variation_orders", label: "Variations" },
  { table: "milestones", label: "Milestones" },
  { table: "contacts", label: "Contacts" },
];

function RD() {
  const { roles } = useSession();
  if (!roles.includes("admin")) {
    return (
      <div>
        <PageHeader title="Recently Deleted" description="Admin only" />
        <EmptyState title="Restricted" description="Only administrators can access recently deleted records." />
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Recently Deleted" description="Items are kept for 30 days before being archived permanently" />
      <div className="grid gap-4">
        {TABLES.map((t) => <Section key={t.table} {...t} />)}
      </div>
    </div>
  );
}

function Section({ table, label }: { table: string; label: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["deleted", table],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data } = await supabase.from(table as any).select("*").not("deleted_at", "is", null).gt("deleted_at", cutoff).order("deleted_at", { ascending: false });
      return data ?? [];
    },
  });
  async function restore(id: string) {
    const { error } = await supabase.from(table as any).update({ deleted_at: null, deleted_by: null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Restored");
    qc.invalidateQueries({ queryKey: ["deleted", table] });
    qc.invalidateQueries({ queryKey: [table] });
  }
  if (!data || data.length === 0) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{label} ({data.length})</CardTitle></CardHeader>
      <CardContent>
        <ul className="divide-y">
          {data.map((r: any) => (
            <li key={r.id} className="py-2 flex justify-between items-center text-sm">
              <div>
                <div className="font-medium">{r.name ?? r.number ?? r.title ?? r.id.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">Deleted {new Date(r.deleted_at).toLocaleString()}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => restore(r.id)}><RotateCcw className="h-3 w-3 mr-1" /> Restore</Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
