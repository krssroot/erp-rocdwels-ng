import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/staff")({ ssr: false, component: Staff });

function Staff() {
  const { data } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*, user_roles(role)").is("deleted_at", null)).data ?? [],
  });
  return (
    <div>
      <PageHeader title="Staff" description="Team members and their roles" />
      {(data ?? []).length === 0 ? <EmptyState title="No staff yet" description="Team members appear here after they sign up." /> : (
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Job title</TableHead><TableHead>Department</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{p.job_title ?? "—"}</TableCell>
                  <TableCell>{p.department ?? "—"}</TableCell>
                  <TableCell>{(p.user_roles ?? []).map((r: { role: AppRole }) => ROLE_LABELS[r.role]).join(", ") || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{p.status ?? "Active"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
