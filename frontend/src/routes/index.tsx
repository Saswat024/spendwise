import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLayout } from "@/components/AppLayout";
import { CustomChartTooltip, formatCompactCurrency } from "@/components/ChartTooltip";
import { api, getToken } from "@/lib/api";
import { currentMonth, formatMoney, type Summary, type TrendPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SpendWise" },
      { name: "description", content: "Your monthly spending at a glance: category breakdown, income vs expense trends, and budgets." },
      { property: "og:title", content: "SpendWise — Personal finance tracker" },
      { property: "og:description", content: "Track spending, budgets, and ask questions about your money with an AI assistant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const PIE_COLORS = [
  "oklch(0.65 0.16 195)", // teal
  "oklch(0.70 0.16 150)", // emerald
  "oklch(0.65 0.18 260)", // indigo
  "oklch(0.72 0.17 65)",  // amber
  "oklch(0.65 0.20 25)",  // coral / rose
  "oklch(0.68 0.17 310)", // purple
  "oklch(0.72 0.15 110)", // lime
  "oklch(0.62 0.16 220)", // sky blue
  "oklch(0.68 0.19 350)", // pink
  "oklch(0.65 0.14 45)",  // orange
];

function Dashboard() {
  const navigate = useNavigate();
  const month = currentMonth();
  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  useEffect(() => {
    if (!getToken()) navigate({ to: "/login" });
  }, [navigate]);

  const summary = useQuery({
    queryKey: ["summary", month],
    queryFn: () => api<Summary>(`/transactions/summary?month=${month}`),
  });
  const trend = useQuery({
    queryKey: ["trend"],
    queryFn: () => api<TrendPoint[]>("/transactions/trend?months=6"),
  });

  if (summary.isLoading || trend.isLoading) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Loading your dashboard…</p>
      </AppLayout>
    );
  }
  if (summary.isError || trend.isError) {
    return (
      <AppLayout>
        <p className="text-destructive">
          Couldn't load your data. Is the backend running at your configured API URL?
        </p>
      </AppLayout>
    );
  }

  const s = summary.data!;
  const totalCategorySpend = s.by_category.reduce((acc, c) => acc + c.total, 0);
  const activeCategory = activeCategoryIndex !== null ? s.by_category[activeCategoryIndex] : null;
  const activePct =
    activeCategory && totalCategorySpend > 0
      ? ((activeCategory.total / totalCategorySpend) * 100).toFixed(0)
      : null;

  const cards = [
    { label: "Income", value: s.income, icon: ArrowUpRight, tone: "text-emerald-500" },
    { label: "Expenses", value: s.expense, icon: ArrowDownRight, tone: "text-destructive" },
    { label: "Net", value: s.net, icon: Scale, tone: "text-primary" },
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview for {month}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <p className="mt-2 text-2xl font-semibold text-card-foreground">{formatMoney(value)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-card-foreground">Spending by category</h2>
              <p className="text-xs text-muted-foreground">Tap a category to inspect details</p>
            </div>
            {activeCategoryIndex !== null && (
              <button
                type="button"
                onClick={() => setActiveCategoryIndex(null)}
                className="text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {s.by_category.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No expenses yet this month.
            </p>
          ) : (
            <>
              {/* Donut Chart with Centered Dynamic Stats */}
              <div className="relative flex items-center justify-center my-1">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={s.by_category}
                      dataKey="total"
                      nameKey="category"
                      innerRadius={68}
                      outerRadius={96}
                      paddingAngle={2.5}
                      stroke="var(--card)"
                      strokeWidth={2}
                      onClick={(_, index) =>
                        setActiveCategoryIndex(activeCategoryIndex === index ? null : index)
                      }
                    >
                      {s.by_category.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                          opacity={activeCategoryIndex === null || activeCategoryIndex === i ? 1 : 0.35}
                          style={{
                            transition: "opacity 0.2s ease",
                            outline: "none",
                            cursor: "pointer",
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate max-w-[125px]">
                    {activeCategory ? activeCategory.category : "Total Spent"}
                  </span>
                  <span className="text-base sm:text-lg font-bold font-mono text-card-foreground mt-0.5">
                    {formatCompactCurrency(activeCategory ? activeCategory.total : totalCategorySpend)}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {activeCategory ? `${activePct}% of expenses` : `${s.by_category.length} categories`}
                  </span>
                </div>
              </div>

              {/* Touch-Friendly Category Legend & Breakdown List */}
              <div className="mt-2 space-y-1.5 pt-3 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(showAllCategories ? s.by_category : s.by_category.slice(0, 4)).map((cat, i) => {
                    const pct = totalCategorySpend > 0 ? ((cat.total / totalCategorySpend) * 100).toFixed(0) : "0";
                    const color = PIE_COLORS[i % PIE_COLORS.length];
                    const isSelected = activeCategoryIndex === i;
                    return (
                      <button
                        key={cat.category}
                        type="button"
                        onClick={() => setActiveCategoryIndex(isSelected ? null : i)}
                        className={cn(
                          "flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-all cursor-pointer text-left border",
                          isSelected
                            ? "bg-accent/80 border-primary/40 text-accent-foreground shadow-2xs"
                            : "border-transparent hover:bg-muted/60 text-card-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-background"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate font-medium">{cat.category}</span>
                          <span className="text-[11px] text-muted-foreground">({pct}%)</span>
                        </div>
                        <span className="font-mono font-semibold text-card-foreground shrink-0 ml-2">
                          {formatMoney(cat.total)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {s.by_category.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCategories((v) => !v)}
                    className="mt-1 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground py-1 transition-colors cursor-pointer"
                  >
                    {showAllCategories
                      ? "Show fewer categories"
                      : `Show all ${s.by_category.length} categories (${s.by_category.length - 4} more)`}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-card-foreground">Income vs expenses</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend.data ?? []} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickFormatter={formatCompactCurrency}
              />
              <Tooltip
                content={<CustomChartTooltip />}
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
              />
              <Line type="monotone" dataKey="income" name="Income" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-2)" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="expense" name="Expense" stroke="var(--chart-5)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-5)" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {s.by_category.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-card-foreground">Top categories</h2>
              <span className="text-xs text-muted-foreground">This month's expenses</span>
            </div>
          </div>
          <ResponsiveContainer
            width="100%"
            height={Math.max(260, Math.min(s.by_category.slice(0, 8).length * 36 + 48, 360))}
          >
            <BarChart
              data={s.by_category.slice(0, 8)}
              layout="vertical"
              margin={{ top: 4, right: 16, left: -6, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickFormatter={formatCompactCurrency}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={105}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                interval={0}
              />
              <Tooltip
                content={<CustomChartTooltip />}
                cursor={{ fill: "var(--accent)", opacity: 0.2 }}
              />
              <Bar dataKey="total" name="Total" fill="var(--chart-1)" radius={[0, 6, 6, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </AppLayout>
  );
}
