import { createFileRoute } from "@tanstack/react-router";
import {
  Bot,
  MessageSquare,
  PanelLeft,
  Plus,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
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
import { CustomChartTooltip, formatCompactCurrency } from "@/components/ChartTooltip";
import { MarkdownContent } from "@/components/MarkdownContent";
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

interface ChatSessionItem {
  session_id: string;
  title: string;
  updated_at?: string;
}

const SUGGESTIONS = [
  "How much did I spend on groceries this month?",
  "Compare this month to last month",
  "What are my top merchants?",
  "Forecast next month's spending",
  "Set a ₹4,000 budget for Dining",
];

function generateNewSessionId(): string {
  return `session_${Date.now()}`;
}

function ChatPage() {
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch all user chat sessions on initial mount
  useEffect(() => {
    loadSessions(true);
  }, []);

  async function loadSessions(selectFirst = false) {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list: ChatSessionItem[] = data.sessions ?? [];
        setSessions(list);

        if (selectFirst) {
          if (list.length > 0 && list[0]) {
            const firstId = list[0].session_id;
            setActiveSessionId(firstId);
            loadHistory(firstId);
          } else {
            const newId = generateNewSessionId();
            setActiveSessionId(newId);
            setMessages([]);
          }
        }
      }
    } catch {
      if (selectFirst && !activeSessionId) {
        const newId = generateNewSessionId();
        setActiveSessionId(newId);
        setMessages([]);
      }
    }
  }

  async function loadHistory(sessionId: string) {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_BASE}/chat/history?session_id=${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(
          (data.messages ?? []).map((m: { role: "user" | "assistant"; content: string }) => ({
            ...m,
            charts: [],
          })),
        );
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  function startNewChat() {
    if (streaming) return;
    const newId = generateNewSessionId();
    setActiveSessionId(newId);
    setMessages([]);
    setSidebarOpen(false);
  }

  function selectSession(sessionId: string) {
    if (streaming || sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    loadHistory(sessionId);
    setSidebarOpen(false);
  }

  async function deleteSession(sessionId: string, e: MouseEvent) {
    e.stopPropagation();
    if (streaming) return;

    try {
      await fetch(`${API_BASE}/chat/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const updated = sessions.filter((s) => s.session_id !== sessionId);
      setSessions(updated);

      if (sessionId === activeSessionId) {
        if (updated.length > 0 && updated[0]) {
          const nextId = updated[0].session_id;
          setActiveSessionId(nextId);
          loadHistory(nextId);
        } else {
          startNewChat();
        }
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;

    const currentSession = activeSessionId || generateNewSessionId();
    if (!activeSessionId) setActiveSessionId(currentSession);

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
        body: JSON.stringify({ message, session_id: currentSession }),
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
              copy[copy.length - 1] = {
                role: last.role,
                content: last.content + payload.text,
                charts: last.charts,
              };
              return copy;
            });
          } else if (event === "chart") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (!last) return copy;
              copy[copy.length - 1] = {
                role: last.role,
                content: last.content,
                charts: [...(last.charts ?? []), payload],
              };
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
      // Reload sessions list so the newly created or updated conversation title appears
      loadSessions(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const activeSessionObj = sessions.find((s) => s.session_id === activeSessionId);
  const currentTitle = activeSessionObj ? activeSessionObj.title : "New Conversation";

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-11.5rem)] sm:h-[calc(100vh-8.5rem)] w-full gap-4 max-w-6xl mx-auto">
        {/* Left Sidebar: Previous Conversations (Desktop & Mobile Drawer) */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 flex-col border-r border-border bg-card p-3 shadow-lg transition-transform duration-200 md:static md:z-0 md:flex md:w-64 md:rounded-xl md:border md:shadow-xs lg:w-72 ${
            sidebarOpen ? "flex translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          {/* Sidebar Top: New Chat button */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <button
              onClick={startNewChat}
              disabled={streaming}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity shadow-xs"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted md:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Conversations List */}
          <div className="mt-3 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Previous Conversations</span>
            <span className="text-[10px]">{sessions.length}</span>
          </div>

          <div className="mt-2 flex-1 space-y-1 overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-muted-foreground px-4">
                <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                <p>No previous conversations.</p>
                <p className="mt-1 text-[11px]">Ask anything to begin a chat!</p>
              </div>
            ) : (
              sessions.map((s) => {
                const isActive = s.session_id === activeSessionId;
                return (
                  <div
                    key={s.session_id}
                    onClick={() => selectSession(s.session_id)}
                    className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-colors ${
                      isActive
                        ? "bg-primary/15 text-primary font-medium border border-primary/20 shadow-xs"
                        : "text-foreground/80 hover:bg-muted/70 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{s.title || "Conversation"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteSession(s.session_id, e)}
                      title="Delete conversation"
                      className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs md:hidden"
          />
        )}

        {/* Right Main Chat Container */}
        <main className="flex flex-1 flex-col rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          {/* Chat Header Bar */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
                aria-label="Toggle history"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-sm font-semibold text-foreground flex items-center gap-1.5 truncate max-w-xs sm:max-w-md">
                  <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{currentTitle}</span>
                </h1>
              </div>
            </div>

            <button
              onClick={startNewChat}
              disabled={streaming}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              New Chat
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {loadingHistory ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Loading conversation…
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                  <Bot className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">How can I help you today?</h2>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Ask questions about your transactions, categories, spending patterns, or budget goals.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 max-w-lg mt-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-input bg-background/80 px-3.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent hover:border-primary/40 shadow-xs"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                      <Bot className="h-4 w-4" />
                    </span>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-xs"
                        : "bg-muted/70 text-foreground border border-border/40 rounded-bl-xs"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownContent
                        content={msg.content || (streaming && i === messages.length - 1 ? "…" : "")}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    {msg.charts?.map((chart, j) => {
                      const data = chart.data as { category?: string; merchant?: string; total: number }[];
                      const key = data[0]?.category !== undefined ? "category" : "merchant";
                      return (
                        <div key={j} className="mt-3 rounded-lg bg-card p-3 border border-border/50">
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                              <XAxis dataKey={key} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" tickFormatter={formatCompactCurrency} />
                              <Tooltip content={<CustomChartTooltip />} cursor={{ fill: "var(--accent)", opacity: 0.2 }} />
                              <Bar dataKey="total" name="Total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                  </div>
                  {msg.role === "user" && (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-xs">
                      <User className="h-4 w-4" />
                    </span>
                  )}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Prompt Input Form */}
          <div className="border-t border-border/60 p-3 sm:p-4 bg-muted/10">
            <form onSubmit={onSubmit} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your spending, budgets, or savings…"
                className="flex-1 rounded-xl border border-input bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                aria-label="Send message"
                className="flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity shadow-xs cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
