function esc(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Neutralize spreadsheet formula injection: text cells starting with
  // =, +, -, @, tab or CR are prefixed with a single quote so they are read as text.
  // Real numbers are left untouched (e.g. negative amounts).
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, head: string[], rows: (string | number | null | undefined)[][]) {
  const csv = [head.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
