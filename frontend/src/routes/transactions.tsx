import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { AppLayout } from "@/components/AppLayout";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { DatePicker, formatDateDisplay } from "@/components/ui/date-picker";
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
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [form, setForm] = useState<TxFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  function handleSort(field: "date" | "amount") {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  }

  const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  if (category) params.set("category", category);
  if (type) params.set("type", type);
  if (search) params.set("search", search);
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  params.set("sort_by", sortBy);
  params.set("sort_order", sortOrder);

  const query = useQuery({
    queryKey: ["transactions", page, category, type, search, start, end, sortBy, sortOrder],
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

  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const removeAll = useMutation({
    mutationFn: () => api<{ deleted_count: number }>("/transactions/all", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["trend"] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setConfirmDeleteAll(false);
      setPage(1);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError(null);
    save.mutate(form);
  }

  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} records</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setCsvOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-xs sm:text-sm font-medium text-foreground transition-colors hover:bg-accent cursor-pointer"
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setForm({ ...emptyForm })}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs sm:text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 cursor-pointer"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Add transaction</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDeleteAll(true)}
            disabled={!data || data.total === 0 || removeAll.isPending}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs sm:text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title="Delete all transactions"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span>Delete all</span>
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search merchant, note, category…"
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring sm:max-w-sm"
        />

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto rounded-md border border-input bg-card px-2.5 py-1.5 text-xs sm:text-sm text-foreground"
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
            className="w-full sm:w-auto rounded-md border border-input bg-card px-2.5 py-1.5 text-xs sm:text-sm text-foreground"
          >
            <option value="">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [b, o] = e.target.value.split("-") as ["date" | "amount", "asc" | "desc"];
              setSortBy(b);
              setSortOrder(o);
              setPage(1);
            }}
            className="w-full sm:w-auto rounded-md border border-input bg-card px-2.5 py-1.5 text-xs sm:text-sm text-foreground font-medium"
            aria-label="Sort transactions"
          >
            <option value="date-desc">Sort: Date (Newest first)</option>
            <option value="date-asc">Sort: Date (Oldest first)</option>
            <option value="amount-desc">Sort: Amount (High to Low)</option>
            <option value="amount-asc">Sort: Amount (Low to High)</option>
          </select>

          <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:flex sm:w-auto">
            <DatePicker
              placeholder="dd-mm-yyyy"
              value={start}
              onChange={(v) => {
                setStart(v);
                setPage(1);
              }}
              className="w-full sm:w-44"
            />
            <DatePicker
              placeholder="dd-mm-yyyy"
              value={end}
              onChange={(v) => {
                setEnd(v);
                setPage(1);
              }}
              className="w-full sm:w-44"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {query.isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : query.isError ? (
          <p className="p-8 text-center text-sm text-destructive">Failed to load transactions.</p>
        ) : data!.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No transactions found.</p>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="block sm:hidden divide-y divide-border/60">
              {data!.items.map((tx) => (
                <div key={tx.id} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-card-foreground text-sm">{tx.category}</span>
                        {tx.merchant && (
                          <span className="text-xs text-muted-foreground truncate">• {tx.merchant}</span>
                        )}
                      </div>
                      {tx.note && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{tx.note}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-semibold shrink-0 font-mono",
                        tx.type === "income"
                          ? "text-emerald-500"
                          : "text-rose-500 dark:text-rose-400",
                      )}
                    >
                      {tx.type === "income" ? "+" : "−"}
                      {formatMoney(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                    <span className="font-mono text-[11px] bg-muted/60 px-1.5 py-0.5 rounded">
                      {formatDateDisplay(tx.date)}
                    </span>
                    <div className="flex items-center gap-1">
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
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label="Delete"
                        onClick={() => remove.mutate(tx.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Full Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort("date")}
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer group select-none font-medium"
                      >
                        <span>Date</span>
                        {sortBy === "date" ? (
                          sortOrder === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Merchant</th>
                    <th className="px-4 py-3 font-medium">Note</th>
                    <th className="px-4 py-3 text-right font-medium">
                      <button
                        type="button"
                        onClick={() => handleSort("amount")}
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer group ml-auto select-none font-medium"
                      >
                        <span>Amount</span>
                        {sortBy === "amount" ? (
                          sortOrder === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data!.items.map((tx) => (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-card-foreground font-mono text-xs">
                        {formatDateDisplay(tx.date)}
                      </td>
                      <td className="px-4 py-3 text-card-foreground">{tx.category}</td>
                      <td className="px-4 py-3 text-muted-foreground">{tx.merchant ?? "—"}</td>
                      <td className="max-w-40 truncate px-4 py-3 text-muted-foreground">{tx.note ?? "—"}</td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right font-medium font-mono",
                          tx.type === "income"
                            ? "text-emerald-500"
                            : "text-rose-500 dark:text-rose-400",
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
                            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            aria-label="Delete"
                            onClick={() => remove.mutate(tx.id)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
          className="rounded-md border border-input bg-card px-3 py-1.5 disabled:opacity-40 cursor-pointer"
        >
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-md border border-input bg-card px-3 py-1.5 disabled:opacity-40 cursor-pointer"
        >
          Next
        </button>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xl"
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
                <DatePicker
                  required
                  placeholder="dd-mm-yyyy"
                  value={form.date}
                  onChange={(d) => setForm({ ...form, date: d })}
                  className="w-full [&>input]:w-full"
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

      <CsvImportDialog
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["transactions"] });
          qc.invalidateQueries({ queryKey: ["summary"] });
          qc.invalidateQueries({ queryKey: ["trend"] });
          qc.invalidateQueries({ queryKey: ["budgets"] });
        }}
      />

      {/* Confirmation Modal for Delete All */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-card-foreground">Delete All Transactions?</h2>
                <p className="text-xs text-muted-foreground">Permanent and irreversible action</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete all{" "}
              <span className="font-semibold text-foreground">{data?.total ?? 0}</span> transactions? This
              will completely clear your spending history and reset your analytics and budget tracking.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(false)}
                disabled={removeAll.isPending}
                className="rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => removeAll.mutate()}
                disabled={removeAll.isPending}
                className="flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {removeAll.isPending ? (
                  <span>Deleting…</span>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Yes, delete all</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
