import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtNGN } from "@/lib/roles";

const PURPLE: [number, number, number] = [107, 33, 168]; // brand purple

export function createBrandedDoc(title: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, pageWidth, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Rocdwels Nigeria Ltd", 40, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Construction ERP", 40, 44);

  doc.setFontSize(11);
  doc.text(title, pageWidth - 40, 34, { align: "right" });

  doc.setTextColor(0, 0, 0);
  return doc;
}

export function addFooter(doc: jsPDF, generatedBy?: string) {
  const pageCount = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const stamp = new Date().toLocaleString("en-NG");
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PURPLE);
    doc.setLineWidth(0.5);
    doc.line(40, ph - 40, pw - 40, ph - 40);
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(
      `Generated ${stamp}${generatedBy ? " by " + generatedBy : ""}`,
      40,
      ph - 25,
    );
    doc.text(`Page ${i} of ${pageCount}`, pw - 40, ph - 25, { align: "right" });
  }
}

export function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setTextColor(...PURPLE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(text, 40, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y + 8;
}

export function keyValueBlock(
  doc: jsPDF,
  pairs: [string, string][],
  startY: number,
): number {
  const rows = pairs.map(([k, v]) => [k, v ?? "—"]);
  autoTable(doc, {
    startY,
    body: rows,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 130, textColor: [80, 80, 80] },
      1: { cellWidth: "auto" },
    },
  });
  // @ts-ignore
  return (doc as any).lastAutoTable.finalY + 10;
}

export function table(
  doc: jsPDF,
  head: string[],
  body: (string | number)[][],
  startY: number,
): number {
  autoTable(doc, {
    startY,
    head: [head],
    body,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: PURPLE, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 240, 250] },
    theme: "grid",
  });
  // @ts-ignore
  return (doc as any).lastAutoTable.finalY + 12;
}

export { fmtNGN };
