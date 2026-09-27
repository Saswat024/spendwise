import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Scale } from "lucide-react";
import { useEffect } from "react";
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
import { api, getToken } from "@/lib/api";
import { currentMonth, formatMoney, type Summary, type TrendPoint } from "@/lib/types";

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
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function Dashboard() {
  const navigate = useNavigate();
  const month = currentMonth();

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

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <p className="mt-2 text-2xl font-semibold text-card-foreground">{formatMoney(value)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-card-foreground">Spending by category</h2>
          {s.by_category.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No expenses yet this month.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={s.by_category}
                  dataKey="total"
                  nameKey="category"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {s.by_category.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-card-foreground">Income vs expenses</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Line type="monotone" dataKey="income" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expense" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {s.by_category.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-card-foreground">Top categories</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={s.by_category.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis type="category" dataKey="category" width={100} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Bar dataKey="total" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </AppLayout>
  );
}
