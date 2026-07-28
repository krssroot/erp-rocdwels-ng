import { addFooter, createBrandedDoc, fmtNGN, keyValueBlock, sectionTitle, table } from "./pdf";

function safe(v: any) { return v == null || v === "" ? "—" : String(v); }
function n(v: any) { return Number(v ?? 0); }

export function exportCostSheetPdf(args: {
  sheet: any;
  projectName?: string;
  materials: any[];
  labour: any[];
  overhead: any[];
  budgetLines: any[];
  totals: { matPlan: number; matAct: number; labPlan: number; labAct: number; ovhPlan: number; ovhAct: number; grandPlan: number; grandAct: number; utilPct: number };
  generatedBy?: string;
}) {
  const { sheet, projectName, materials, labour, overhead, budgetLines, totals, generatedBy } = args;
  const doc = createBrandedDoc("Job Cost Sheet");

  let y = 80;
  y = keyValueBlock(doc, [
    ["Sheet No.", safe(sheet.number)],
    ["Job Name", safe(sheet.title)],
    ["Project", safe(projectName)],
    ["Customer", safe(sheet.customer)],
    ["Date", safe(sheet.sheet_date)],
    ["Status", safe(sheet.status)],
    ["Analytic Account", safe(sheet.analytic_account)],
    ["Job Order", safe(sheet.job_order)],
    ["Sale Reference", safe(sheet.sale_reference)],
    ["Currency", safe(sheet.currency ?? "NGN")],
  ], y);

  if (sheet.description) {
    y = sectionTitle(doc, "Description", y);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(String(sheet.description), 515);
    doc.text(lines, 40, y + 8);
    y += 8 + lines.length * 12 + 6;
  }

  y = sectionTitle(doc, "Materials", y);
  y = table(doc,
    ["Date", "Product", "Qty", "UoM", "Unit ₦", "Planned ₦", "Purch ₦", "Bill ₦"],
    materials.length ? materials.map((r) => [
      safe(r.line_date), safe(r.product), n(r.planned_qty), safe(r.uom),
      fmtNGN(r.unit_cost), fmtNGN(r.planned_amount),
      fmtNGN(r.actual_purchased_cost), fmtNGN(r.vendor_bill_cost),
    ]) : [["—", "No materials", "", "", "", "", "", ""]],
    y);

  y = sectionTitle(doc, "Labour", y);
  y = table(doc,
    ["Date", "Job Type", "Worker", "Days", "Rate ₦", "Planned ₦", "Actual Days", "Actual ₦", "Variance"],
    labour.length ? labour.map((r) => [
      safe(r.line_date), safe(r.job_type), safe(r.worker),
      n(r.planned_days), fmtNGN(r.daily_rate), fmtNGN(r.planned_cost),
      n(r.actual_days), fmtNGN(r.actual_cost), fmtNGN(r.variance),
    ]) : [["—", "No labour lines", "", "", "", "", "", "", ""]],
    y);

  y = sectionTitle(doc, "Overhead", y);
  y = table(doc,
    ["Date", "Category", "Description", "Planned ₦", "Actual ₦", "Variance"],
    overhead.length ? overhead.map((r) => [
      safe(r.line_date), safe(r.category), safe(r.description),
      fmtNGN(r.planned_amount), fmtNGN(r.actual_amount), fmtNGN(r.variance),
    ]) : [["—", "No overhead lines", "", "", "", ""]],
    y);

  y = sectionTitle(doc, "Budget Breakdown", y);
  y = table(doc,
    ["Code", "Category", "Budgeted ₦", "Committed ₦", "Actual ₦", "Remaining ₦"],
    budgetLines.length ? budgetLines.map((c) => {
      const b = n(c.budgeted_amount), cm = n(c.committed_amount), a = n(c.actual_amount);
      return [safe(c.code), safe(c.category), fmtNGN(b), fmtNGN(cm), fmtNGN(a), fmtNGN(b - cm - a)];
    }) : [["—", "No budget lines", "", "", "", ""]],
    y);

  y = sectionTitle(doc, "Grand Totals", y);
  y = table(doc,
    ["Section", "Planned ₦", "Actual ₦"],
    [
      ["Materials", fmtNGN(totals.matPlan), fmtNGN(totals.matAct)],
      ["Labour", fmtNGN(totals.labPlan), fmtNGN(totals.labAct)],
      ["Overhead", fmtNGN(totals.ovhPlan), fmtNGN(totals.ovhAct)],
      ["GRAND TOTAL", fmtNGN(totals.grandPlan), fmtNGN(totals.grandAct)],
      ["Variance", fmtNGN(totals.grandPlan - totals.grandAct), ""],
      ["Budget Utilisation", `${totals.utilPct.toFixed(1)}%`, ""],
    ], y);

  addFooter(doc, generatedBy);
  doc.save(`${sheet.number ?? "cost-sheet"}.pdf`);
}

export function exportBudgetPdf(args: {
  project: any;
  costCodes: any[];
  generatedBy?: string;
}) {
  const { project, costCodes, generatedBy } = args;
  const doc = createBrandedDoc("Budget Summary");

  let y = 80;
  y = keyValueBlock(doc, [
    ["Project", safe(project.name)],
    ["Client", safe(project.client)],
    ["Location", safe(project.location)],
    ["Contract Value", fmtNGN(project.contract_value)],
    ["Status", safe(project.status)],
    ["Timeline", `${safe(project.start_date)} → ${safe(project.end_date)}`],
  ], y);

  let totalB = 0, totalC = 0, totalA = 0;
  const rows = costCodes.map((c) => {
    const b = n(c.budgeted_amount), cm = n(c.committed_amount), a = n(c.actual_amount);
    totalB += b; totalC += cm; totalA += a;
    return [safe(c.code), safe(c.category), safe(c.description), fmtNGN(b), fmtNGN(cm), fmtNGN(a), fmtNGN(b - cm - a)];
  });

  y = sectionTitle(doc, "Cost Codes", y);
  y = table(doc,
    ["Code", "Category", "Description", "Budgeted ₦", "Committed ₦", "Actual ₦", "Remaining ₦"],
    rows.length ? rows : [["—", "No cost codes", "", "", "", "", ""]],
    y);

  const util = totalB > 0 ? ((totalC + totalA) / totalB) * 100 : 0;
  y = sectionTitle(doc, "Summary", y);
  y = table(doc,
    ["Metric", "Value"],
    [
      ["Total Budgeted", fmtNGN(totalB)],
      ["Total Committed", fmtNGN(totalC)],
      ["Total Actual", fmtNGN(totalA)],
      ["Total Remaining", fmtNGN(totalB - totalC - totalA)],
      ["Overall Utilisation", `${util.toFixed(1)}%`],
    ], y);

  addFooter(doc, generatedBy);
  doc.save(`budget-${(project.name ?? "project").replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

export function exportSiteReportPdf(args: {
  report: any;
  projectName?: string;
  generatedBy?: string;
}) {
  const { report, projectName, generatedBy } = args;
  const doc = createBrandedDoc("Daily Site Report");

  let y = 80;
  y = keyValueBlock(doc, [
    ["Project", safe(projectName)],
    ["Date", safe(report.report_date)],
    ["Weather", safe(report.weather)],
    ["Workers on site", safe(report.workers_count)],
    ["Status", safe(report.status)],
  ], y);

  const workDone: any[] = Array.isArray(report.work_done) ? report.work_done : [];
  const materials: any[] = Array.isArray(report.materials_used) ? report.materials_used : [];
  const issues: any[] = Array.isArray(report.issues) ? report.issues : [];

  y = sectionTitle(doc, "Workforce", y);
  y = table(doc, ["Metric", "Count"], [["Workers on site", String(report.workers_count ?? 0)]], y);

  y = sectionTitle(doc, "Work Done", y);
  y = table(doc,
    ["Task", "Location", "Notes"],
    workDone.length ? workDone.map((w) => [safe(w.task ?? w.name), safe(w.location), safe(w.notes)])
      : [["—", "No entries", ""]],
    y);

  y = sectionTitle(doc, "Materials Used", y);
  y = table(doc,
    ["Material", "Qty", "UoM"],
    materials.length ? materials.map((m) => [safe(m.material ?? m.name), safe(m.qty), safe(m.uom)])
      : [["—", "No entries", ""]],
    y);

  y = sectionTitle(doc, "Issues", y);
  y = table(doc,
    ["Issue", "Severity", "Status"],
    issues.length ? issues.map((i) => [safe(i.issue ?? i.description), safe(i.severity), safe(i.status)])
      : [["—", "No issues", ""]],
    y);

  y = sectionTitle(doc, "Tomorrow's Plan", y);
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(String(report.tomorrow_plan ?? "—"), 515);
  doc.text(lines, 40, y + 8);

  addFooter(doc, generatedBy);
  doc.save(`site-report-${report.report_date ?? Date.now()}.pdf`);
}
