import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, User } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppLayout } from "@/components/AppLayout";
import { API_BASE, getToken } from "@/lib/api";
import { formatMoney, type ChatMessage } from "@/lib/types";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Assistant — SpendWise" },
      { name: "description", content: "Ask questions about your spending in plain language." },
    ],
  }),
  component: ChatPage,
});

const SESSION_ID = "default";

const SUGGESTIONS = [
  "How much did I spend on groceries this month?",
  "Compare this month to last month",
  "What are my top merchants?",
  "Forecast next month's spending",
  "Set a $400 budget for Dining",
];

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/chat/history?session_id=${SESSION_ID}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) =>
        setMessages(
          (d.messages ?? []).map((m: { role: "user" | "assistant"; content: string }) => ({
            ...m,
            charts: [],
          })),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setInput("");
    setStreaming(true);
    setMessages((m) => [
      ...m,
      { role: "user", content: message, charts: [] },
      { role: "assistant", content: "", charts: [] },
    ]);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ message, session_id: SESSION_ID }),
      });
      if (!res.ok || !res.body) throw new Error("Chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const block of events) {
          const eventLine = block.split("\n").find((l) => l.startsWith("event:"));
          const dataLine = block.split("\n").find((l) => l.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const event = eventLine.slice(6).trim();
          const payload = JSON.parse(dataLine.slice(5).trim());
          if (event === "token") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (!last) return copy;
              copy[copy.length - 1] = { role: last.role, content: last.content + payload.text, charts: last.charts };
              return copy;
            });
          } else if (event === "chart") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (!last) return copy;
              copy[copy.length - 1] = { role: last.role, content: last.content, charts: [...(last.charts ?? []), payload] };
              return copy;
            });
          } else if (event === "error") {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = { role: "assistant", content: payload.message, charts: [] };
              return copy;
            });
          }
        }
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Sorry — I couldn't reach the assistant. Is the backend running?",
          charts: [],
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <AppLayout>
      <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-3xl flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-foreground">Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Ask anything about your spending — powered by gpt-oss-120b
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-sm">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <Bot className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Try one of these:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="whitespace-pre-wrap">
                  {msg.content || (streaming && i === messages.length - 1 ? "…" : "")}
                </p>
                {msg.charts?.map((chart, j) => {
                  const data = chart.data as { category?: string; merchant?: string; total: number }[];
                  const key = data[0]?.category !== undefined ? "category" : "merchant";
                  return (
                    <div key={j} className="mt-3 rounded-lg bg-card p-3">
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey={key} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                          <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                          <Tooltip formatter={(v: number) => formatMoney(v)} />
                          <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
              {msg.role === "user" && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <User className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your spending…"
            className="flex-1 rounded-md border border-input bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            aria-label="Send"
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
