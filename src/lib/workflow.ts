import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";

/* ---------------- BUDGET (Job Cost Sheet) WORKFLOW ---------------- */

export const BUDGET_STATUSES = [
  "Draft",
  "Submitted for Vetting",
  "Vetted",
  "Approved",
  "Rejected",
] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

type Step = { to: string; label: string; roles: AppRole[]; hint: string };

const BUDGET_STEPS: Record<string, Step[]> = {
  Draft: [
    {
      to: "Submitted for Vetting",
      label: "Submit for Vetting",
      roles: ["site_manager", "procurement_officer", "admin"],
      hint: "Only a Site Manager or Procurement Officer can submit a budget",
    },
  ],
  "Submitted for Vetting": [
    {
      to: "Vetted",
      label: "Mark as Vetted",
      roles: ["head_quantity_surveyor", "admin"],
      hint: "Only the Head Quantity Surveyor can vet a budget",
    },
  ],
  Vetted: [
    { to: "Approved", label: "Approve", roles: ["admin"], hint: "Only the Managing Director can approve" },
    { to: "Rejected", label: "Reject", roles: ["admin"], hint: "Only the Managing Director can reject" },
  ],
  Approved: [],
  Rejected: [
    {
      to: "Draft",
      label: "Return to Draft",
      roles: ["site_manager", "procurement_officer", "admin"],
      hint: "Only the preparer can reopen a rejected budget",
    },
  ],
};

export function budgetSteps(status: string): Step[] {
  return BUDGET_STEPS[status] ?? BUDGET_STEPS.Draft;
}

/* ---------------- REQUISITION WORKFLOW ---------------- */

export const REQ_STATUSES = [
  "Draft",
  "Pending Vetting",
  "Pending PO",
  "MD Approval",
  "Payment Schedule",
  "Payment Confirmed",
  "Paid",
  "Rejected",
] as const;
export type ReqStatus = (typeof REQ_STATUSES)[number];

export function requisitionSteps(status: string, type: string): Step[] {
  const isLabour = type === "Labour" || type === "Services";
  switch (status) {
    case "Draft":
      return [
        isLabour
          ? {
              to: "Pending Vetting",
              label: "Transmit to Head QS",
              roles: [
                "admin",
                "project_manager",
                "site_manager",
                "accountant",
                "procurement_officer",
                "head_quantity_surveyor",
              ],
              hint: "Any staff member can submit",
            }
          : {
              to: "Pending PO",
              label: "Transmit to Procurement",
              roles: [
                "admin",
                "project_manager",
                "site_manager",
                "accountant",
                "procurement_officer",
                "head_quantity_surveyor",
              ],
              hint: "Any staff member can submit",
            },
      ];
    case "Pending Vetting":
      return [
        {
          to: "MD Approval",
          label: "Vet & send to MD",
          roles: ["head_quantity_surveyor", "admin"],
          hint: "Only the Head Quantity Surveyor can vet this requisition",
        },
      ];
    case "Pending PO":
      return [
        {
          to: "MD Approval",
          label: "Raise PO & send to MD",
          roles: ["procurement_officer", "admin"],
          hint: "Only the Procurement Officer can raise the purchase order",
        },
      ];
    case "MD Approval":
      return [
        {
          to: "Payment Schedule",
          label: "Approve (MD)",
          roles: ["admin"],
          hint: "Only the Managing Director can approve",
        },
        { to: "Rejected", label: "Reject", roles: ["admin"], hint: "Only the Managing Director can reject" },
      ];
    case "Payment Schedule":
      return [
        {
          to: "Payment Confirmed",
          label: "Confirm payment schedule",
          roles: ["accountant", "admin"],
          hint: "Only the Accountant can confirm the schedule",
        },
      ];
    case "Payment Confirmed":
      return [
        {
          to: "Paid",
          label: "Mark as PAID",
          roles: ["accountant", "admin"],
          hint: "Only the Accountant can mark a requisition as paid",
        },
      ];
    default:
      return [];
  }
}

export function allowed(step: Step, roles: AppRole[]) {
  return step.roles.some((r) => roles.includes(r));
}

/* ---------------- APPROVED BUDGET ITEMS ---------------- */

export type BudgetItem = { name: string; uom?: string | null; unit_cost?: number | null; source: string };

/** Items that exist in an APPROVED budget (job cost sheet) for the project. */
export function useApprovedBudgetItems(projectId?: string | null) {
  return useQuery({
    queryKey: ["approved_budget_items", projectId ?? "none"],
    enabled: !!projectId,
    queryFn: async (): Promise<BudgetItem[]> => {
      const { data: sheets } = await supabase
        .from("cost_sheets")
        .select("id")
        .eq("project_id", projectId!)
        .eq("status", "Approved")
        .is("deleted_at", null);
      const ids = (sheets ?? []).map((s: any) => s.id);
      if (!ids.length) return [];
      const [mat, lab, ovh] = await Promise.all([
        supabase.from("cost_sheet_materials").select("product,uom,unit_cost").in("cost_sheet_id", ids).is("deleted_at", null),
        supabase.from("cost_sheet_labour").select("job_type,daily_rate").in("cost_sheet_id", ids).is("deleted_at", null),
        supabase.from("cost_sheet_overhead").select("category,planned_amount").in("cost_sheet_id", ids).is("deleted_at", null),
      ]);
      const out: BudgetItem[] = [];
      (mat.data ?? []).forEach((r: any) => r.product && out.push({ name: r.product, uom: r.uom, unit_cost: r.unit_cost, source: "Materials" }));
      (lab.data ?? []).forEach((r: any) => r.job_type && out.push({ name: r.job_type, uom: "days", unit_cost: r.daily_rate, source: "Labour" }));
      (ovh.data ?? []).forEach((r: any) => r.category && out.push({ name: r.category, unit_cost: r.planned_amount, source: "Overhead" }));
      const seen = new Set<string>();
      return out.filter((i) => {
        const k = i.name.trim().toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    },
  });
}

export function isInBudget(items: BudgetItem[], name?: string | null) {
  if (!name) return true;
  return items.some((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase());
}
