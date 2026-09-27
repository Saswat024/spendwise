import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { AppLayout } from "@/components/AppLayout";
import { api } from "@/lib/api";
import { CATEGORIES, formatMoney, type Budget } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets — SpendWise" },
      { name: "description", content: "Set per-category spending limits and track progress." },
    ],
  }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [limit, setLimit] = useState("");

  const query = useQuery({
    queryKey: ["budgets"],
    queryFn: () => api<Budget[]>("/budgets"),
  });

  const add = useMutation({
    mutationFn: () =>
      api<Budget>("/budgets", {
        method: "POST",
        body: JSON.stringify({ category, limit: parseFloat(limit) }),
      }),
    onSuccess: () => {
      setLimit("");
      qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/budgets/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!limit || parseFloat(limit) <= 0) return;
    add.mutate();
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Budgets</h1>
        <p className="text-sm text-muted-foreground">Monthly limits per category</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-card-foreground">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="block rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-card-foreground">Monthly limit</label>
          <input
            type="number"
            step="0.01"
            min="1"
            required
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="500"
            className="block w-36 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={add.isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Set budget
        </button>
      </form>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading budgets…</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive">Failed to load budgets.</p>
      ) : query.data!.length === 0 ? (
        <p className="text-sm text-muted-foreground">No budgets yet — set one above.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {query.data!.map((b) => {
            const pct = Math.min(100, (b.spent / b.limit) * 100);
            return (
              <div key={b.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-card-foreground">{b.category}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatMoney(b.spent)} of {formatMoney(b.limit)}
                    </p>
                  </div>
                  <button
                    aria-label={`Delete ${b.category} budget`}
                    onClick={() => remove.mutate(b.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", b.over_budget ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {b.over_budget && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Over budget by {formatMoney(b.spent - b.limit)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
