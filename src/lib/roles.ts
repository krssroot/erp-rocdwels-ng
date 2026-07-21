export type AppRole =
  | "admin"
  | "project_manager"
  | "site_manager"
  | "accountant"
  | "procurement_officer";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  project_manager: "Project Manager",
  site_manager: "Site Manager",
  accountant: "Accountant",
  procurement_officer: "Procurement Officer",
};

export function fmtNGN(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!isFinite(n)) return "₦0.00";
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
