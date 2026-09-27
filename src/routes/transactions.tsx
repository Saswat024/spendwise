import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { AppLayout } from "@/components/AppLayout";
import { api } from "@/lib/api";
import {
  CATEGORIES,
  formatMoney,
  type Transaction,
  type TransactionPage,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — SpendWise" },
      { name: "description", content: "Browse, filter, add, edit and import transactions." },
    ],
  }),
  component: TransactionsPage,
});

const PAGE_SIZE = 15;

interface TxFormState {
  id?: string;
  amount: string;
  type: "income" | "expense";
  category: string;
  merchant: string;
  note: string;
  date: string;
}

const emptyForm: TxFormState = {
  amount: "",
  type: "expense",
  category: "Groceries",
  merchant: "",
  note: "",
  date: new Date().toISOString().slice(0, 10),
};

function TransactionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [form, setForm] = useState<TxFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  if (category) params.set("category", category);
  if (type) params.set("type", type);
  if (search) params.set("search", search);
  if (start) params.set("start", start);
  if (end) params.set("end", end);

  const query = useQuery({
    queryKey: ["transactions", page, category, type, search, start, end],
    queryFn: () => api<TransactionPage>(`/transactions?${params}`),
  });

  const save = useMutation({
    mutationFn: (f: TxFormState) => {
      const body = JSON.stringify({
        amount: parseFloat(f.amount),
        type: f.type,
        category: f.category,
        merchant: f.merchant || null,
        note: f.note || null,
        date: f.date,
      });
      return f.id
        ? api<Transaction>(`/transactions/${f.id}`, { method: "PUT", body })
        : api<Transaction>("/transactions", { method: "POST", body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["trend"] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setForm(null);
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : "Save failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError(null);
    save.mutate(form);
  }

  async function onCsvImport(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    // Expected header: date,amount,type,category,merchant,note
    const rows = lines.slice(1);
    let imported = 0;
    for (const line of rows) {
      const [date, amount, txType, cat, merchant, note] = line.split(",").map((s) => s.trim());
      if (!date || !amount || !txType || !cat) continue;
      try {
        await api("/transactions", {
          method: "POST",
          body: JSON.stringify({
            date,
            amount: parseFloat(amount),
            type: txType === "income" ? "income" : "expense",
            category: cat,
            merchant: merchant || null,
            note: note || null,
          }),
        });
        imported++;
      } catch {
        /* skip bad rows */
      }
    }
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
    alert(`Imported ${imported} of ${rows.length} rows.`);
  }

  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} records</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Upload className="h-4 w-4" /> Import CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCsvImport(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => setForm({ ...emptyForm })}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add transaction
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search merchant, note, category…"
          className="w-56 rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="">All types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        <input
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
        />
        <input
          type="date"
          value={end}
          onChange={(e) => {
            setEnd(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {query.isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : query.isError ? (
          <p className="p-8 text-center text-sm text-destructive">Failed to load transactions.</p>
        ) : data!.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No transactions found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Merchant</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data!.items.map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-card-foreground">{tx.date}</td>
                  <td className="px-4 py-3 text-card-foreground">{tx.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{tx.merchant ?? "—"}</td>
                  <td className="max-w-40 truncate px-4 py-3 text-muted-foreground">{tx.note ?? "—"}</td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-medium",
                      tx.type === "income" ? "text-emerald-500" : "text-card-foreground",
                    )}
                  >
                    {tx.type === "income" ? "+" : "−"}
                    {formatMoney(tx.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        aria-label="Edit"
                        onClick={() =>
                          setForm({
                            id: tx.id,
                            amount: String(tx.amount),
                            type: tx.type,
                            category: tx.category,
                            merchant: tx.merchant ?? "",
                            note: tx.note ?? "",
                            date: tx.date,
                          })
                        }
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Delete"
                        onClick={() => remove.mutate(tx.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-md border border-input bg-card px-3 py-1.5 disabled:opacity-40"
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-md border border-input bg-card px-3 py-1.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {form && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">
                {form.id ? "Edit transaction" : "Add transaction"}
              </h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Close">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-card-foreground">Amount</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-card-foreground">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-card-foreground">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-card-foreground">Date</label>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-card-foreground">Merchant</label>
              <input
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-card-foreground">Note</label>
              <input
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <button
              type="submit"
              disabled={save.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          </form>
        </div>
      )}
    </AppLayout>
  );
}
