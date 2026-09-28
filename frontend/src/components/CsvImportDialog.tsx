import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  UploadCloud,
  X,
} from "lucide-react";
import React, { useRef, useState } from "react";

import { api } from "@/lib/api";
import { formatDateDisplay, parseDate } from "@/components/ui/date-picker";

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  date: string;
  amount: string;
  type: string;
  category: string;
  merchant: string;
  note: string;
  valid: boolean;
  error?: string | undefined;
}

const SAMPLE_CSV = `date,amount,type,category,merchant,note
01-09-2026,3500.00,income,Salary,Tech Corp,Monthly salary paycheck
02-09-2026,1200.00,expense,Housing,City View Apartments,Monthly rent payment
03-09-2026,84.50,expense,Groceries,Trader Joe's,Weekly grocery shopping
04-09-2026,45.20,expense,Dining,Blue Bottle Coffee,Team coffee & snacks
05-09-2026,65.00,expense,Utilities,City Power & Electric,Electric bill
06-09-2026,28.75,expense,Transport,Shell Gas,Fuel refill
08-09-2026,129.99,expense,Shopping,Amazon,Electronics cables and adapter
10-09-2026,55.00,expense,Dining,Chipotle,Dinner with friends
12-09-2026,95.40,expense,Groceries,Whole Foods Market,Organic pantry restock
15-09-2026,15.99,expense,Entertainment,Netflix,Monthly subscription
18-09-2026,250.00,income,Freelance,Upwork,Website design consultation
20-09-2026,42.00,expense,Health,CVS Pharmacy,Vitamins and medicine
22-09-2026,38.50,expense,Transport,Uber,Ride to airport
25-09-2026,110.00,expense,Dining,Olive Garden,Family dinner
28-09-2026,76.30,expense,Groceries,Costco,Household supplies`;

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

export function CsvImportDialog({ open, onClose, onSuccess }: CsvImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [summary, setSummary] = useState<{ imported: number; failed: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  if (!open) return null;

  function resetState() {
    setFile(null);
    setRows([]);
    setHeaderError(null);
    setImporting(false);
    setProgress(null);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function downloadSampleFile() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sample_transactions.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function copyHeaderFormat() {
    navigator.clipboard.writeText("date,amount,type,category,merchant,note");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function processFile(selectedFile: File) {
    resetState();
    setFile(selectedFile);

    const text = await selectedFile.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      setHeaderError("The CSV file must contain a header row and at least one transaction row.");
      return;
    }

    const rawHeaders = parseCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
    const dateIdx = rawHeaders.indexOf("date");
    const amountIdx = rawHeaders.indexOf("amount");
    const typeIdx = rawHeaders.indexOf("type");
    const categoryIdx = rawHeaders.indexOf("category");
    const merchantIdx = rawHeaders.indexOf("merchant");
    const noteIdx = rawHeaders.indexOf("note");

    if (dateIdx === -1 || amountIdx === -1 || typeIdx === -1 || categoryIdx === -1) {
      setHeaderError(
        "Missing required header columns. Expected: date,amount,type,category,merchant,note",
      );
      return;
    }

    const parsed: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i] ?? "");
      const date = cols[dateIdx] ?? "";
      const amount = cols[amountIdx] ?? "";
      const type = (cols[typeIdx] ?? "").toLowerCase();
      const category = cols[categoryIdx] ?? "";
      const merchant = merchantIdx !== -1 ? cols[merchantIdx] ?? "" : "";
      const note = noteIdx !== -1 ? cols[noteIdx] ?? "" : "";

      let valid = true;
      let error: string | undefined;

      const parsedDate = parseDate(date);
      if (!parsedDate) {
        valid = false;
        error = `Invalid date '${date}' (format must be DD-MM-YYYY)`;
      } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        valid = false;
        error = `Invalid amount '${amount}' (must be > 0)`;
      } else if (type !== "income" && type !== "expense") {
        valid = false;
        error = `Invalid type '${type}' (must be 'income' or 'expense')`;
      } else if (!category.trim()) {
        valid = false;
        error = "Category is required";
      }

      parsed.push({
        date,
        amount,
        type,
        category,
        merchant,
        note,
        valid,
        error,
      });
    }

    setRows(parsed);
  }

  async function handleImport() {
    const validRows = rows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setImporting(true);
    let imported = 0;
    let failed = rows.length - validRows.length;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i]!;
      setProgress({ current: i + 1, total: validRows.length });
      try {
        await api("/transactions", {
          method: "POST",
          body: JSON.stringify({
            date: row.date,
            amount: parseFloat(row.amount),
            type: row.type as "income" | "expense",
            category: row.category,
            merchant: row.merchant || null,
            note: row.note || null,
          }),
        });
        imported++;
      } catch {
        failed++;
      }
    }

    setSummary({ imported, failed });
    setImporting(false);
    onSuccess();
  }

  const validCount = rows.filter((r) => r.valid).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-card-foreground truncate">Import Transactions</h2>
              <p className="text-xs text-muted-foreground truncate">Upload your spending records via CSV file</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Format Specification Banner */}
          <div className="rounded-xl border border-border/80 bg-muted/40 p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Required CSV Format
              </span>
              <button
                type="button"
                onClick={copyHeaderFormat}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Header"}
              </button>
            </div>

            <div className="rounded-md bg-background px-3 py-2 font-mono text-xs text-foreground border border-border select-all overflow-x-auto">
              date,amount,type,category,merchant,note
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-[11px] text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">date:</span> DD-MM-YYYY (e.g. 15-09-2026)
              </div>
              <div>
                <span className="font-semibold text-foreground">amount:</span> Number &gt; 0 (e.g. 45.50)
              </div>
              <div>
                <span className="font-semibold text-foreground">type:</span> expense or income
              </div>
              <div>
                <span className="font-semibold text-foreground">category:</span> Category name
              </div>
              <div>
                <span className="font-semibold text-foreground">merchant:</span> Optional store name
              </div>
              <div>
                <span className="font-semibold text-foreground">note:</span> Optional description
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between border-t border-border/50">
              <span className="text-xs text-muted-foreground">Need a starting template?</span>
              <button
                type="button"
                onClick={downloadSampleFile}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                Download Sample CSV
              </button>
            </div>
          </div>

          {/* Upload Dropzone */}
          {!summary && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile && droppedFile.name.endsWith(".csv")) {
                  processFile(droppedFile);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) processFile(f);
                }}
              />
              <UploadCloud className="h-9 w-9 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">
                {file ? file.name : "Click to select or drag and drop a .csv file"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "Supports standard UTF-8 encoded CSV files"}
              </p>
            </div>
          )}

          {/* Header Error Message */}
          {headerError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{headerError}</span>
            </div>
          )}

          {/* Preview & Row Status */}
          {rows.length > 0 && !summary && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  Found {rows.length} total {rows.length === 1 ? "row" : "rows"}:
                </span>
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" /> {validCount} valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600">
                      <AlertCircle className="h-3 w-3" /> {invalidCount} invalid (will skip)
                    </span>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 text-foreground/90">
                    {rows.slice(0, 4).map((r, idx) => (
                      <tr key={idx} className={r.valid ? "" : "bg-destructive/5"}>
                        <td className="px-3 py-2">
                          {r.valid ? (
                            <span className="text-emerald-500 font-medium">Ready</span>
                          ) : (
                            <span className="text-destructive font-medium" title={r.error}>
                              Error
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">{formatDateDisplay(r.date) || "—"}</td>
                        <td className="px-3 py-2 capitalize">{r.type || "—"}</td>
                        <td className="px-3 py-2">{r.category || "—"}</td>
                        <td className="px-3 py-2 text-right font-medium">₹{r.amount || "0"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 4 && (
                <p className="text-center text-[11px] text-muted-foreground">
                  + {rows.length - 4} more transactions in this file
                </p>
              )}
            </div>
          )}

          {/* Import Result Summary */}
          {summary && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Import Complete!</h3>
              <p className="text-xs text-muted-foreground">
                Successfully imported <span className="font-semibold text-emerald-600">{summary.imported}</span>{" "}
                transactions.
                {summary.failed > 0 && ` (${summary.failed} invalid rows skipped)`}
              </p>
            </div>
          )}

          {/* Progress Bar */}
          {importing && progress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Importing transactions…</span>
                <span>
                  {progress.current} of {progress.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-border px-6 py-4 bg-muted/20">
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            className="rounded-lg border border-input bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {summary ? "Done" : "Cancel"}
          </button>
          {!summary && (
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {importing ? "Importing…" : `Import ${validCount} Transactions`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
