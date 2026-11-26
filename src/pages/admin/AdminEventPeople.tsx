import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Person = Tables<"event_people">;

const KINDS = ["judge", "mentor", "sponsor", "partner", "volunteer"] as const;

interface Draft {
  id?: string;
  kind: string;
  full_name: string;
  organisation: string;
  role_title: string;
  email: string;
  phone: string;
  website_url: string;
  is_public: boolean;
}

const toDraft = (p: Person): Draft => ({
  id: p.id,
  kind: p.kind,
  full_name: p.full_name,
  organisation: p.organisation ?? "",
  role_title: p.role_title ?? "",
  email: p.email ?? "",
  phone: p.phone ?? "",
  website_url: p.website_url ?? "",
  is_public: p.is_public,
});

const AdminEventPeople = () => {
  const [events, setEvents] = useState<Tables<"events">[]>([]);
  const [eventId, setEventId] = useState("");
  const [items, setItems] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("events").select("*").order("start_date", { ascending: false });
      setEvents(data ?? []);
      if (data?.length) setEventId(data[0].id);
    })();
  }, []);

  const load = async (id: string) => {
    const { data, error } = await supabase.from("event_people").select("*").eq("event_id", id).order("sort_order");
    if (error) return toast.error(error.message);
    setItems((data ?? []).map(toDraft));
  };

  useEffect(() => { if (eventId) load(eventId); }, [eventId]);

  const update = (i: number, patch: Partial<Draft>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const remove = async (i: number) => {
    const t = items[i];
    if (t.id) {
      const { error } = await supabase.from("event_people").delete().eq("id", t.id);
      if (error) return toast.error(error.message);
    }
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!eventId) return;
    setSaving(true);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.full_name.trim()) continue;
      const payload = {
        event_id: eventId,
        kind: it.kind,
        full_name: it.full_name.trim(),
        organisation: it.organisation.trim() || null,
        role_title: it.role_title.trim() || null,
        email: it.email.trim() || null,
        phone: it.phone.trim() || null,
        website_url: it.website_url.trim() || null,
        is_public: it.is_public,
        sort_order: i,
      };
      if (it.id) await supabase.from("event_people").update(payload).eq("id", it.id);
      else await supabase.from("event_people").insert(payload);
    }
    setSaving(false);
    toast.success("Saved");
    load(eventId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Judges, mentors, sponsors & volunteers</h1>
        <Button size="sm" variant="outline" className="gap-1"
          onClick={() => setItems((a) => [...a, { kind: "judge", full_name: "", organisation: "", role_title: "", email: "", phone: "", website_url: "", is_public: true }])}>
          <Plus size={14} /> Add person
        </Button>
      </div>

      <div className="grid max-w-sm gap-1.5">
        <Label className="text-xs">Event</Label>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
          <SelectContent>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No people added for this event yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {items.map((it, i) => (
            <Card key={it.id ?? `new-${i}`}>
              <CardContent className="space-y-3 p-4">
                <div className="grid gap-2 sm:grid-cols-[150px_1fr_1fr_auto]">
                  <Select value={it.kind} onValueChange={(v) => update(i, { kind: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => <SelectItem key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Full name / organisation name" value={it.full_name} onChange={(e) => update(i, { full_name: e.target.value })} />
                  <Input placeholder="Organisation" value={it.organisation} onChange={(e) => update(i, { organisation: e.target.value })} />
                  <Button size="icon" variant="ghost" className="text-destructive" aria-label="Remove" onClick={() => remove(i)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <Input placeholder="Role / title" value={it.role_title} onChange={(e) => update(i, { role_title: e.target.value })} />
                  <Input placeholder="Email" value={it.email} onChange={(e) => update(i, { email: e.target.value })} />
                  <Input placeholder="Phone" value={it.phone} onChange={(e) => update(i, { phone: e.target.value })} />
                  <Input placeholder="Website" value={it.website_url} onChange={(e) => update(i, { website_url: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={it.is_public} onCheckedChange={(v) => update(i, { is_public: v })} />
                  Show on public event page
                  {!it.is_public && <Badge variant="secondary">Internal</Badge>}
                </label>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <Button className="gap-1" onClick={save} disabled={saving}>
          <Save size={15} /> {saving ? "Saving…" : "Save people"}
        </Button>
      )}
    </div>
  );
};

export default AdminEventPeople;
