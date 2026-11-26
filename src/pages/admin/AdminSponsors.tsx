import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Handshake, Copy } from "lucide-react";
import { formatMoney } from "@/lib/registration";
import { escapeIlike } from "@/lib/utils";
import SponsorTeamsView from "@/components/sponsor/SponsorTeamsView";
import type { Tables } from "@/integrations/supabase/types";

type Sp = Tables<"sponsorships">;
const STATUSES = ["prospect", "pledged", "confirmed", "paid", "cancelled"] as const;
const TIERS = ["platinum", "gold", "silver", "bronze", "partner", "in-kind"];
const blank = { sponsor_name: "", tier: "partner", amount: "0", currency: "XAF", status: "prospect", contact_name: "", contact_email: "", website_url: "", logo_url: "", can_review: true, notes: "", login_email: "" };

const AdminSponsors = () => {
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [eventId, setEventId] = useState("");
  const [list, setList] = useState<Sp[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sp | null>(null);
  const [form, setForm] = useState(blank);

  useEffect(() => {
    supabase.from("events").select("id,title").order("start_date", { ascending: false }).then(({ data }) => {
      setEvents(data ?? []);
      if (data?.length) setEventId(data[0].id);
    });
  }, []);
  const load = () => eventId && supabase.from("sponsorships").select("*").eq("event_id", eventId).order("amount", { ascending: false }).then(({ data }) => setList(data ?? []));
  useEffect(() => { load(); }, [eventId]);

  const edit = async (s?: Sp) => {
    setEditing(s ?? null);
    let login_email = "";
    if (s?.sponsor_user_id) {
      const { data } = await supabase.from("profiles").select("email").eq("user_id", s.sponsor_user_id).maybeSingle();
      login_email = data?.email ?? "";
    }
    setForm(s ? { ...blank, ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ?? ""])), amount: String(s.amount), can_review: s.can_review, login_email } as any : blank);
    setOpen(true);
  };

  const save = async () => {
    if (!form.sponsor_name.trim()) return toast.error("Sponsor name is required");
    let sponsor_user_id: string | null = null;
    if (form.login_email.trim()) {
      const { data } = await supabase.from("profiles").select("user_id").ilike("email", escapeIlike(form.login_email.trim())).maybeSingle();
      if (!data) return toast.error("No account found with that login email — ask the sponsor to sign up first.");
      sponsor_user_id = data.user_id;
    }
    const payload = {
      event_id: eventId, sponsor_name: form.sponsor_name.trim().slice(0, 150), tier: form.tier,
      amount: Number(form.amount) || 0, currency: form.currency || "XAF", status: form.status,
      contact_name: form.contact_name || null, contact_email: form.contact_email || null,
      website_url: form.website_url || null, logo_url: form.logo_url || null,
      can_review: form.can_review, notes: form.notes || null, sponsor_user_id,
    };
    const { error } = editing
      ? await supabase.from("sponsorships").update(payload).eq("id", editing.id)
      : await supabase.from("sponsorships").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Sponsorship saved");
    setOpen(false); load();
  };

  const remove = async (s: Sp) => {
    if (!confirm(`Remove ${s.sponsor_name}?`)) return;
    const { error } = await supabase.from("sponsorships").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    load();
  };

  const active = list.filter((s) => s.status !== "cancelled");
  const committed = active.filter((s) => ["confirmed", "paid"].includes(s.status)).reduce((a, s) => a + Number(s.amount), 0);
  const received = active.filter((s) => s.status === "paid").reduce((a, s) => a + Number(s.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2"><Handshake className="text-primary" /> Sponsor Portal</h1>
          <p className="text-sm text-muted-foreground">Manage sponsorships, view registered teams and approve submissions.</p>
        </div>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="w-full sm:w-80"><SelectValue placeholder="Select event" /></SelectTrigger>
          <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active sponsors</p><p className="text-2xl font-bold text-foreground">{active.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Committed</p><p className="text-2xl font-bold text-foreground">{formatMoney(committed, "XAF")}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Received</p><p className="text-2xl font-bold text-foreground">{formatMoney(received, "XAF")}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="sponsors">
        <TabsList><TabsTrigger value="sponsors">Sponsorships</TabsTrigger><TabsTrigger value="teams">Teams & submissions</TabsTrigger></TabsList>
        <TabsContent value="sponsors" className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/sponsor-portal`); toast.success("Sponsor portal link copied"); }}>
              <Copy size={14} className="mr-1" /> Copy sponsor login link
            </Button>
            <Button onClick={() => edit()} disabled={!eventId}><Plus size={16} className="mr-1" /> Add sponsor</Button>
          </div>
          {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No sponsors for this event yet.</p>}
          {list.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{s.sponsor_name} <Badge variant="outline" className="ml-1 capitalize">{s.tier}</Badge></p>
                  <p className="text-xs text-muted-foreground">{formatMoney(Number(s.amount), s.currency)} · {s.contact_email || "no contact"} · {s.sponsor_user_id ? (s.can_review ? "Portal access" : "Portal (view-only off)") : "No portal login"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={s.status === "paid" ? "default" : s.status === "cancelled" ? "destructive" : "secondary"} className="capitalize">{s.status}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => edit(s)} aria-label="Edit"><Pencil size={14} /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(s)} aria-label="Delete"><Trash2 size={14} /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="teams">{eventId && <SponsorTeamsView eventId={eventId} mode="admin" />}</TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit sponsorship" : "Add sponsor"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label>Sponsor name</Label><Input value={form.sponsor_name} onChange={(e) => setForm({ ...form, sponsor_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Tier</Label>
                <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIERS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="grid gap-1"><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="grid gap-1"><Label>Amount</Label><Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="grid gap-1"><Label>Currency</Label><Input value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
              <div className="grid gap-1"><Label>Contact name</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
              <div className="grid gap-1"><Label>Contact email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            </div>
            <div className="grid gap-1"><Label>Website</Label><Input type="url" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Sponsor portal login email</Label><Input type="email" value={form.login_email} onChange={(e) => setForm({ ...form, login_email: e.target.value })} placeholder="Email of their TechBridge account" />
              <p className="text-xs text-muted-foreground">Gives this account access to the sponsor portal for this event.</p></div>
            <div className="flex items-center gap-3"><Switch checked={form.can_review} onCheckedChange={(v) => setForm({ ...form, can_review: v })} /><Label>Can view teams & approve submissions</Label></div>
            <div className="grid gap-1"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button onClick={save}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSponsors;
