import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const AIAssistant = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    if (!user) {
      setMessages((m) => [
        ...m,
        { role: "user", content: text },
        { role: "assistant", content: "Please sign in to chat with the assistant." },
      ]);
      setInput("");
      return;
    }
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? SUPABASE_KEY;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({ messages: next }),
      });
      if (!resp.ok || !resp.body) {
        setMessages((m) => [...m, { role: "assistant", content: "Sorry, I couldn't reach the AI service." }]);
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let lineBuffer = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              acc += delta;
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            /* ignore partial or non-JSON comment frames */
          }
        }
      }
    } catch {
      setMessages((m) => [
        ...m.filter((msg, idx) => !(idx === m.length - 1 && msg.role === "assistant" && !msg.content)),
        { role: "assistant", content: "Sorry, a network error interrupted the response. Please try again." },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed right-6 z-40 h-14 w-14 rounded-full bg-gradient-primary text-primary-foreground shadow-elevated flex items-center justify-center hover:scale-105 transition-transform",
          user ? "bottom-20 lg:bottom-6" : "bottom-6",
        )}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
      {open && (
        <div
          className={cn(
            "fixed right-4 z-40 w-[calc(100vw-2rem)] max-w-sm h-[28rem] bg-card border border-border rounded-2xl shadow-elevated flex flex-col overflow-hidden animate-fade-in",
            user ? "bottom-36 lg:bottom-24" : "bottom-24",
          )}
        >
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-primary text-primary-foreground">
            <Sparkles size={16} />
            <span className="font-heading font-semibold text-sm">{t("ai.assistantTitle")}</span>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-muted-foreground text-center py-6 px-2">{t("ai.greeting")}</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-border p-2 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("ai.placeholder")}
              aria-label={t("ai.placeholder")}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              disabled={streaming}
            />
            <Button type="submit" size="icon" disabled={streaming || !input.trim()} aria-label="Send message">
              <Send size={16} />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
