import { useCallback, useEffect, useRef, useState } from "react";
import SEO from "@/components/SEO";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Paperclip, X, Loader2, Check, CheckCheck, FileText, Download, Pencil, Trash2, SmilePlus, History } from "lucide-react";
import { toast } from "sonner";

type Conversation = { id: string; user_a: string; user_b: string; last_message_at: string };
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  edited_at: string | null;
  deleted_at: string | null;
};
type Profile = { user_id: string; full_name: string | null; avatar_url: string | null };
type Reaction = { id: string; message_id: string; user_id: string; emoji: string };
type EditRow = {
  id: string;
  message_id: string;
  actor_id: string;
  action: string;
  previous_content: string | null;
  new_content: string | null;
  created_at: string;
};

const MAX_MB = 10;
const REACTIONS = ["👍", "❤️", "😂", "🎉", "🙏", "👀"] as const;

const formatSize = (bytes?: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const Attachment = ({ message }: { message: Message }) => {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = (message.attachment_type ?? "").startsWith("image/");

  useEffect(() => {
    if (!message.attachment_path) return;
    let active = true;
    (async () => {
      const { data } = await supabase.storage
        .from("message-attachments")
        .createSignedUrl(message.attachment_path!, 3600);
      if (active) setUrl(data?.signedUrl ?? null);
    })();
    return () => { active = false; };
  }, [message.attachment_path]);

  if (!message.attachment_path) return null;

  if (isImage) {
    return url ? (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-1">
        <img
          src={url}
          alt={message.attachment_name ?? "Attachment"}
          loading="lazy"
          className="rounded-lg max-h-56 w-auto object-cover"
        />
      </a>
    ) : (
      <div className="mt-1 h-24 w-40 rounded-lg bg-background/20 animate-pulse" />
    );
  }

  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="mt-1 flex items-center gap-2 rounded-lg bg-background/20 px-2 py-1.5 text-xs hover:bg-background/30 transition-colors"
    >
      <FileText size={14} className="shrink-0" />
      <span className="truncate max-w-[10rem]">{message.attachment_name ?? "File"}</span>
      <span className="opacity-70">{formatSize(message.attachment_size)}</span>
      <Download size={12} className="shrink-0 opacity-70" />
    </a>
  );
};

const Messages = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(params.get("c"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [edits, setEdits] = useState<EditRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingSentAt = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load conversations
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order("last_message_at", { ascending: false });
      const list = (data ?? []) as Conversation[];
      setConversations(list);
      const ids = Array.from(new Set(list.flatMap((c) => [c.user_a, c.user_b])));
      if (ids.length) {
        const { data: profs } = await supabase.rpc("get_public_profiles", { _user_ids: ids });
        setProfiles(new Map((profs ?? []).map((p) => [p.user_id, p as Profile])));
      }
    })();
  }, [user]);

  // Load active conversation messages + realtime (inserts, read receipts, typing)
  useEffect(() => {
    if (!activeId || !user) { setMessages([]); return; }
    setParams({ c: activeId });
    setPeerTyping(false);
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at");
      setMessages((data ?? []) as Message[]);
    })();
    (async () => {
      const [{ data: reacts }, { data: hist }] = await Promise.all([
        supabase.from("message_reactions").select("id,message_id,user_id,emoji").eq("conversation_id", activeId),
        supabase
          .from("message_edits")
          .select("id,message_id,actor_id,action,previous_content,new_content,created_at")
          .eq("conversation_id", activeId)
          .order("created_at"),
      ]);
      setReactions((reacts ?? []) as Reaction[]);
      setEdits((hist ?? []) as EditRow[]);
    })();
    const ch = supabase
      .channel(`msgs:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => setMessages((m) => [...m, payload.new as Message]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => setMessages((m) => m.map((msg) => (msg.id === (payload.new as Message).id ? (payload.new as Message) : msg))))
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setReactions((r) => [...r.filter((x) => x.id !== (payload.new as Reaction).id), payload.new as Reaction]);
          } else if (payload.eventType === "DELETE") {
            setReactions((r) => r.filter((x) => x.id !== (payload.old as Reaction).id));
          }
        })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.userId === user.id) return;
        setPeerTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setPeerTyping(false), 3000);
      })
      .subscribe();
    channelRef.current = ch;
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      channelRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [activeId, user, setParams]);

  // Mark incoming messages as read
  useEffect(() => {
    if (!user || !activeId) return;
    const unread = messages.filter((m) => m.sender_id !== user.id && !m.read_at).map((m) => m.id);
    if (!unread.length) return;
    supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => {});
  }, [messages, user, activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, peerTyping]);

  // Keep the audit trail in sync when a peer edits or deletes a message
  const editSignature = messages.map((m) => `${m.id}:${m.edited_at ?? ""}:${m.deleted_at ?? ""}`).join("|");
  useEffect(() => {
    if (!activeId) return;
    supabase
      .from("message_edits")
      .select("id,message_id,actor_id,action,previous_content,new_content,created_at")
      .eq("conversation_id", activeId)
      .order("created_at")
      .then(({ data }) => setEdits((data ?? []) as EditRow[]));
  }, [editSignature, activeId]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!user || !channelRef.current || now - typingSentAt.current < 1500) return;
    typingSentAt.current = now;
    channelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: user.id } });
  }, [user]);

  const refreshEdits = useCallback(async () => {
    if (!activeId) return;
    const { data } = await supabase
      .from("message_edits")
      .select("id,message_id,actor_id,action,previous_content,new_content,created_at")
      .eq("conversation_id", activeId)
      .order("created_at");
    setEdits((data ?? []) as EditRow[]);
  }, [activeId]);

  const saveEdit = async (id: string) => {
    const next = editDraft.trim();
    if (!next) return;
    const { error } = await supabase.from("messages").update({ content: next }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setEditingId(null);
    setEditDraft("");
    refreshEdits();
  };

  const deleteMessage = async (id: string) => {
    if (!confirm(t("chat.confirmDelete"))) return;
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    refreshEdits();
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user || !activeId) return;
    const existing = reactions.find(
      (r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji
    );
    if (existing) {
      setReactions((r) => r.filter((x) => x.id !== existing.id));
      const { error } = await supabase.from("message_reactions").delete().eq("id", existing.id);
      if (error) { toast.error(error.message); setReactions((r) => [...r, existing]); }
    } else {
      const { data, error } = await supabase
        .from("message_reactions")
        .insert({ message_id: messageId, conversation_id: activeId, user_id: user.id, emoji })
        .select("id,message_id,user_id,emoji")
        .single();
      if (error) { toast.error(error.message); return; }
      setReactions((r) => [...r, data as Reaction]);
    }
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(t("chat.fileTooLarge", { size: MAX_MB }));
      e.target.value = "";
      return;
    }
    setFile(f);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeId || sending || (!input.trim() && !file)) return;
    const content = input.trim();
    const attachment = file;
    setSending(true);
    setInput("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";

    let attachmentPath: string | null = null;
    if (attachment) {
      const ext = attachment.name.split(".").pop();
      const path = `${activeId}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;
      const { error } = await supabase.storage.from("message-attachments").upload(path, attachment, {
        cacheControl: "3600",
        upsert: false,
        contentType: attachment.type || undefined,
      });
      if (error) {
        toast.error(t("chat.uploadFailed"));
        setSending(false);
        setInput(content);
        return;
      }
      attachmentPath = path;
    }

    const { error } = await supabase.from("messages").insert({
      conversation_id: activeId,
      sender_id: user.id,
      content,
      attachment_path: attachmentPath,
      attachment_name: attachment?.name ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_size: attachment?.size ?? null,
    });
    if (error) {
      toast.error(error.message);
      setInput(content);
    } else {
      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", activeId);
    }
    setSending(false);
  };

  const otherUserId = (c: Conversation) => (c.user_a === user?.id ? c.user_b : c.user_a);
  const activeConversation = conversations.find((c) => c.id === activeId);
  const peer = activeConversation ? profiles.get(otherUserId(activeConversation)) : undefined;

  return (
    <main className="pt-24 pb-6 min-h-dvh container mx-auto px-4 max-w-5xl">
      <SEO title="Messages" noIndex />
      <h1 className="text-2xl font-heading font-bold mb-4">{t("chat.title")}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[70vh]">
        <Card className="md:col-span-1 overflow-hidden">
          <CardContent className="p-0 h-full overflow-y-auto">
            {conversations.length === 0 && (
              <p className="text-sm text-muted-foreground p-6 text-center">{t("chat.noConversations")}</p>
            )}
            {conversations.map((c) => {
              const other = profiles.get(otherUserId(c));
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)}
                  className={`w-full flex items-center gap-3 p-3 text-left hover:bg-muted ${activeId === c.id ? "bg-muted" : ""}`}>
                  <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
                    {(other?.full_name || "?").slice(0,1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{other?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.last_message_at).toLocaleString()}</p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
        <Card className="md:col-span-2 flex flex-col overflow-hidden">
          {!activeId ? (
            <CardContent className="flex-1 flex items-center justify-center text-muted-foreground text-sm">{t("chat.selectConversation")}</CardContent>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  const removed = !!m.deleted_at;
                  const msgReactions = reactions.filter((r) => r.message_id === m.id);
                  const grouped = Array.from(
                    msgReactions.reduce((acc, r) => {
                      acc.set(r.emoji, [...(acc.get(r.emoji) ?? []), r]);
                      return acc;
                    }, new Map<string, Reaction[]>())
                  );
                  const msgEdits = edits.filter((e) => e.message_id === m.id);
                  return (
                    <div key={m.id} className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${removed ? "bg-muted/60 text-muted-foreground italic" : mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {removed ? (
                          <p>{t("chat.deletedMessage")}</p>
                        ) : editingId === m.id ? (
                          <div className="flex flex-col gap-2 min-w-[12rem]">
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={2}
                              aria-label={t("chat.edit")}
                              className="rounded-lg border border-border bg-background text-foreground px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <div className="flex gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditDraft(""); }}>
                                {t("common.cancel")}
                              </Button>
                              <Button size="sm" onClick={() => saveEdit(m.id)} disabled={!editDraft.trim()}>
                                {t("chat.save")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                            <Attachment message={m} />
                          </>
                        )}
                        <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] opacity-80">
                          {m.edited_at && !removed && <span>{t("chat.edited")}</span>}
                          {mine && !removed && (
                            <>
                              {m.read_at ? <CheckCheck size={12} aria-hidden /> : <Check size={12} aria-hidden />}
                              <span className="sr-only">{m.read_at ? t("chat.read") : t("chat.sent")}</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Reactions */}
                      {grouped.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {grouped.map(([emoji, list]) => {
                            const isMine = list.some((r) => r.user_id === user?.id);
                            return (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(m.id, emoji)}
                                aria-pressed={isMine}
                                aria-label={`${t("chat.reactWith")} ${emoji}`}
                                className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${isMine ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted"}`}
                              >
                                {emoji} <span className="tabular-nums">{list.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-1 flex items-center gap-1 opacity-0 focus-within:opacity-100 group-hover:opacity-100 transition-opacity">
                        {!removed && (
                          <div className="flex items-center gap-0.5" role="group" aria-label={t("chat.reactWith")}>
                            <SmilePlus size={12} className="text-muted-foreground" aria-hidden />
                            {REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(m.id, emoji)}
                                aria-label={`${t("chat.reactWith")} ${emoji}`}
                                className="rounded p-0.5 text-sm hover:bg-muted"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                        {mine && !removed && (
                          <>
                            <button
                              onClick={() => { setEditingId(m.id); setEditDraft(m.content); }}
                              aria-label={t("chat.edit")}
                              className="rounded p-1 text-muted-foreground hover:bg-muted"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => deleteMessage(m.id)}
                              aria-label={t("chat.delete")}
                              className="rounded p-1 text-destructive hover:bg-muted"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                        {msgEdits.length > 0 && (
                          <button
                            onClick={() => setHistoryFor(historyFor === m.id ? null : m.id)}
                            aria-expanded={historyFor === m.id}
                            className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted"
                          >
                            <History size={11} /> {t("chat.history", { count: msgEdits.length })}
                          </button>
                        )}
                      </div>

                      {/* Audit trail — visible to both participants */}
                      {historyFor === m.id && msgEdits.length > 0 && (
                        <ul className="mt-1 w-full max-w-[80%] space-y-1 rounded-lg border border-border bg-background/60 p-2 text-[11px] text-muted-foreground">
                          {msgEdits.map((e) => (
                            <li key={e.id}>
                              <span className="font-medium text-foreground">
                                {(profiles.get(e.actor_id)?.full_name) || t("chat.someone")}
                              </span>{" "}
                              {e.action === "deleted" ? t("chat.auditDeleted") : t("chat.auditEdited")} ·{" "}
                              {new Date(e.created_at).toLocaleString()}
                              {e.action === "edited" && e.previous_content ? (
                                <div className="mt-0.5 line-through break-words opacity-80">{e.previous_content}</div>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {peerTyping && (
                  <div className="flex justify-start" aria-live="polite">
                    <div className="rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                      {t("chat.typing", { name: peer?.full_name || t("chat.someone") })}
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={send} className="border-t border-border p-2 space-y-2">
                {file && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-2 py-1.5 text-xs">
                    <FileText size={14} className="shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-muted-foreground">{formatSize(file.size)}</span>
                    <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                      aria-label={t("common.cancel")} className="p-1 rounded hover:bg-background">
                      <X size={12} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input ref={fileRef} type="file" onChange={pickFile} className="hidden"
                    accept="image/*,application/pdf,.doc,.docx,.txt,.zip,.csv" />
                  <Button type="button" size="icon" variant="ghost" onClick={() => fileRef.current?.click()}
                    disabled={sending} aria-label={t("chat.attach")}>
                    <Paperclip size={16} />
                  </Button>
                  <input value={input}
                    onChange={(e) => { setInput(e.target.value); notifyTyping(); }}
                    placeholder={t("chat.newMessage")}
                    aria-label={t("chat.newMessage")}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  <Button type="submit" size="icon" disabled={sending || (!input.trim() && !file)} aria-label={t("common.send")}>
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </Button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </main>
  );
};

export default Messages;