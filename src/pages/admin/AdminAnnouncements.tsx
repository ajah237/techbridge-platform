import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Megaphone, Send } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { EventCategory } from "@/lib/registration";

const AdminAnnouncements = () => {
  const [events, setEvents] = useState<Tables<"events">[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [sent, setSent] = useState<Tables<"event_announcements">[]>([]);
  const [eventId, setEventId] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSent = async () => {
    const { data } = await supabase.from("event_announcements").select("*").order("created_at", { ascending: false }).limit(25);
    setSent(data ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("events").select("*").order("start_date", { ascending: false });
      setEvents(data ?? []);
      loadSent();
    })();
  }, []);

  useEffect(() => {
    if (!eventId) { setCategories([]); return; }
    (async () => {
      const { data } = await supabase.from("event_categories").select("*").eq("event_id", eventId).order("sort_order");
      setCategories(data ?? []);
      setCategoryId("all");
    })();
  }, [eventId]);

  const send = async () => {
    if (!eventId) return toast.error("Choose an event");
    if (!title.trim() || !body.trim()) return toast.error("Add a title and a message");
    setBusy(true);
    const { data, error } = await supabase.rpc("send_event_announcement", {
      _event_id: eventId,
      _title: title.trim(),
      _body: body.trim(),
      _category_id: categoryId === "all" ? null : categoryId,
      _statuses: null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Sent to ${data ?? 0} team${data === 1 ? "" : "s"}`);
    setTitle("");
    setBody("");
    loadSent();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Announcements</h1>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Event</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Audience</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={!categories.length}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All registered teams</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Challenge released" />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Message</Label>
            <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <Button className="gap-2 bg-gradient-primary text-primary-foreground" onClick={send} disabled={busy}>
            <Send size={15} /> {busy ? "Sending…" : "Send announcement"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold"><Megaphone size={16} /> Recently sent</h2>
        {sent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing sent yet.</p>
        ) : sent.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{a.title}</span>
                <Badge variant="outline">{a.recipient_count} recipients</Badge>
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminAnnouncements;
