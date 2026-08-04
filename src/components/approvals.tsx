import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Plus, Check, X, AlarmClock } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { logActivity } from "@/lib/activity";
import { exportApprovalHistoryPdf } from "@/lib/pdf-exports";
import { downloadCsv } from "@/lib/csv";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";

const ROLES: AppRole[] = ["admin", "project_manager", "site_manager", "accountant", "procurement_officer"];

export type ApprovalEntity = "requisitions" | "cost_sheets";

const DEFAULT_STAGES: Record<ApprovalEntity, string[]> = {
  requisitions: ["Site Verification", "Project Manager Approval", "Procurement Approval"],
  cost_sheets: ["Confirmation", "Budget Validation", "Final Approval"],
};

function statusTone(s: string) {
  if (s === "Approved") return "text-green-600";
  if (s === "Rejected") return "text-red-600";
  if (s === "Escalated") return "text-amber-600";
  return "text-muted-foreground";
}

export function ApprovalPanel({
  entityType,
  entityId,
  recordLabel,
  projectId,
  meta = [],
}: {
  entityType: ApprovalEntity;
  entityId: string;
  recordLabel: string;
  projectId?: string | null;
  meta?: [string, string][];
}) {
  const qc = useQueryClient();
  const { user, roles } = useSession();
  const [stage, setStage] = useState(DEFAULT_STAGES[entityType][0]);
  const [approver, setApprover] = useState("");
  const [role, setRole] = useState<AppRole>("project_manager");
  const [due, setDue] = useState("");
  const key = ["approval_steps", entityType, entityId];

  const { data: staff = [] } = useQuery({
    queryKey: ["profiles", "approvers"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id,email,full_name").is("deleted_at", null)).data ?? [],
  });

  const { data: steps = [] } = useQuery({
    queryKey: key,
    queryFn: async () =>
      (
        await supabase
          .from("approval_steps")
          .select("*")
          .eq("entity_type", entityType)
          .eq("entity_id", entityId)
          .is("deleted_at", null)
          .order("sequence")
      ).data ?? [],
  });

  const nextStep = steps.find((s: any) => s.status === "Pending" || s.status === "Escalated");
  const canDecide = (s: any) =>
    s.approver_id === user?.id || roles.includes("admin") || (s.approver_role && roles.includes(s.approver_role));

  async function addStep() {
    const chosen = staff.find((p: any) => p.id === approver);
    const seq = (steps.length ? Math.max(...steps.map((s: any) => Number(s.sequence ?? 0))) : 0) + 1;
    const { error } = await supabase.from("approval_steps").insert({
      entity_type: entityType,
      entity_id: entityId,
      project_id: projectId ?? null,
      sequence: seq,
      stage,
      approver_id: approver || null,
      approver_email: chosen?.email ?? null,
      approver_role: role,
      due_at: due ? new Date(due).toISOString() : null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    setApprover("");
    setDue("");
    toast.success("Approval step added");
    qc.invalidateQueries({ queryKey: key });
  }

  async function decide(s: any, decision: "Approved" | "Rejected") {
    const { error } = await supabase
      .from("approval_steps")
      .update({
        status: decision,
        decision,
        decided_at: new Date().toISOString(),
        approver_id: s.approver_id ?? user?.id ?? null,
        approver_email: s.approver_email ?? user?.email ?? null,
      })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    await logActivity(`approval ${decision.toLowerCase()} — ${s.stage}`, entityType, entityId, recordLabel);
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["dash_activity"] });
  }

  async function comment(s: any, value: string) {
    await supabase.from("approval_steps").update({ comments: value }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: key });
  }

  function exportPdf() {
    exportApprovalHistoryPdf({ title: recordLabel, meta, steps, generatedBy: user?.email ?? undefined });
  }
  function exportCsvFile() {
    downloadCsv(
      `approval-history-${recordLabel.replace(/\s+/g, "-").toLowerCase()}`,
      ["Sequence", "Stage", "Approver", "Role", "Status", "Decision", "Due", "Decided", "Comments"],
      steps.map((s: any, i: number) => [
        s.sequence ?? i + 1,
        s.stage,
        s.approver_email ?? "",
        s.approver_role ?? "",
        s.status,
        s.decision ?? "",
        s.due_at ? new Date(s.due_at).toLocaleString("en-NG") : "",
        s.decided_at ? new Date(s.decided_at).toLocaleString("en-NG") : "",
        s.comments ?? "",
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto text-sm">
          {nextStep ? (
            <span className="inline-flex items-center gap-2">
              <AlarmClock className="h-4 w-4 text-primary" />
              Next approver: <b>{nextStep.approver_email ?? ROLE_LABELS[nextStep.approver_role as AppRole] ?? "Unassigned"}</b>
              {nextStep.due_at && (
                <Badge variant={new Date(nextStep.due_at) < new Date() ? "destructive" : "secondary"}>
                  Due {new Date(nextStep.due_at).toLocaleDateString("en-NG")}
                </Badge>
              )}
              {nextStep.status === "Escalated" && <Badge variant="destructive">Escalated</Badge>}
            </span>
          ) : steps.length ? (
            <span className="text-green-600 font-medium">All approval steps completed</span>
          ) : (
            <span className="text-muted-foreground">No approval workflow started</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={exportPdf}>
          <FileDown className="h-4 w-4 mr-1" /> PDF
        </Button>
        <Button size="sm" variant="outline" onClick={exportCsvFile}>
          <FileDown className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Approver</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Decided</TableHead>
              <TableHead className="min-w-56">Comments</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-4">
                  Add the first approval step below.
                </TableCell>
              </TableRow>
            )}
            {steps.map((s: any, i: number) => (
              <TableRow key={s.id}>
                <TableCell>{s.sequence ?? i + 1}</TableCell>
                <TableCell className="font-medium">{s.stage}</TableCell>
                <TableCell className="text-sm">{s.approver_email ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.approver_role ? ROLE_LABELS[s.approver_role as AppRole] : "—"}</TableCell>
                <TableCell className="text-sm">{s.due_at ? new Date(s.due_at).toLocaleDateString("en-NG") : "—"}</TableCell>
                <TableCell className={"text-sm font-medium " + statusTone(s.status)}>{s.status}</TableCell>
                <TableCell className="text-sm">{s.decided_at ? new Date(s.decided_at).toLocaleString("en-NG") : "—"}</TableCell>
                <TableCell className="p-1">
                  <Input
                    className="h-8"
                    defaultValue={s.comments ?? ""}
                    placeholder="Add a comment"
                    onBlur={(e) => e.target.value !== (s.comments ?? "") && comment(s, e.target.value)}
                  />
                </TableCell>
                <TableCell className="p-1">
                  {s.status === "Approved" || s.status === "Rejected" ? (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="text-green-600" disabled={!canDecide(s)} title="Approve" onClick={() => decide(s, "Approved")}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" disabled={!canDecide(s)} title="Reject" onClick={() => decide(s, "Rejected")}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:grid-cols-5 items-end border rounded-lg p-3 bg-card">
        <div className="space-y-1">
          <Label className="text-xs">Stage</Label>
          <Input list={`stages-${entityType}`} value={stage} onChange={(e) => setStage(e.target.value)} />
          <datalist id={`stages-${entityType}`}>
            {DEFAULT_STAGES[entityType].map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Approver</Label>
          <Select value={approver} onValueChange={setApprover}>
            <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
            <SelectContent>
              {staff.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Approver role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Due date</Label>
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <Button onClick={addStep}><Plus className="h-4 w-4 mr-1" /> Add step</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Pending steps past their due date are escalated automatically every hour, notifying admins and project managers.
      </p>
    </div>
  );
}

export function ApprovalCommentBox({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return <Textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)} />;
}
