export interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  merchant?: string | null;
  note?: string | null;
  date: string;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
}

export interface Summary {
  month: string;
  income: number;
  expense: number;
  net: number;
  by_category: { category: string; total: number }[];
}

export interface TrendPoint {
  month: string;
  income: number;
  expense: number;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
  over_budget: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  charts: { type: string; data: Record<string, unknown>[] }[];
}

export const CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Housing",
  "Utilities",
  "Entertainment",
  "Shopping",
  "Health",
  "Travel",
  "Salary",
  "Other",
];

export function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
