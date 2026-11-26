import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/auditLog";
import { Plus, Pencil, Trash2, Users, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import ImageUpload from "@/components/ImageUpload";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { Tables } from "@/integrations/supabase/types";
import EventStructuredFields, { type StructuredEventFields } from "@/components/admin/EventStructuredFields";
import EventProgramsEditor from "@/components/admin/EventProgramsEditor";
import EventCategoriesEditor from "@/components/admin/EventCategoriesEditor";

type Event = Tables<"events">;

const eventTypes = ["hackathon", "bootcamp", "workshop", "webinar", "conference", "meetup"] as const;
const eventStatuses = ["draft", "published", "ongoing", "completed", "cancelled"] as const;

const emptyForm = {
  title: "",
  slug: "",
  description: "",
  event_type: "hackathon" as const,
  status: "draft" as const,
  start_date: "",
  end_date: "",
  registration_deadline: "",
  location: "",
  is_virtual: false,
  event_mode: "onsite",
  online_url: "",
  submission_opens_at: "",
  submission_deadline: "",
  judging_starts_at: "",
  judging_ends_at: "",
  results_at: "",
  max_participants: "",
  registration_fee: "0",
  tags: "",
  image_url: "",
  og_image_url: "",
  theme: "",
  venue: "",
  overview: "",
  contact_email: "",
  contact_phone: "",
  registration_open: true,
  payment_instructions: "",
  rules: "",
  timeline: "",
  faqs: "",
};

// Public-page content is stored as JSON so any future event reuses the same page layout.
const parseLines = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);
const parsePairs = (v: string, a: string, b: string) =>
  parseLines(v).map((line) => {
    const [first, ...rest] = line.split("|");
    return { [a]: first.trim(), [b]: rest.join("|").trim() };
  });
const stringifyLines = (v: unknown) => (Array.isArray(v) ? v.map(String).join("\n") : "");
const stringifyPairs = (v: unknown, a: string, b: string) =>
  Array.isArray(v)
    ? v.map((it) => `${(it as Record<string, string>)?.[a] ?? ""} | ${(it as Record<string, string>)?.[b] ?? ""}`).join("\n")
    : "";

const emptyStructured: StructuredEventFields = {
  sponsors: [],
  judges: [],
  prizes: [],
  schedule: [],
};

const AdminEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [structured, setStructured] = useState<StructuredEventFields>(emptyStructured);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setEvents(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSave = async () => {
    const slug = form.slug || generateSlug(form.title);
    const payload = {
      title: form.title,
      slug,
      description: form.description || null,
      event_type: form.event_type,
      status: form.status,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      registration_deadline: form.registration_deadline || null,
      location: form.location || null,
      is_virtual: form.event_mode === "online",
      event_mode: form.event_mode,
      online_url: form.online_url || null,
      submission_opens_at: form.submission_opens_at ? new Date(form.submission_opens_at).toISOString() : null,
      submission_deadline: form.submission_deadline ? new Date(form.submission_deadline).toISOString() : null,
      judging_starts_at: form.judging_starts_at ? new Date(form.judging_starts_at).toISOString() : null,
      judging_ends_at: form.judging_ends_at ? new Date(form.judging_ends_at).toISOString() : null,
      results_at: form.results_at ? new Date(form.results_at).toISOString() : null,
      max_participants: form.max_participants ? parseInt(form.max_participants) : null,
      registration_fee: parseFloat(form.registration_fee) || 0,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
      image_url: form.image_url || null,
      og_image_url: form.og_image_url || null,
      sponsors: structured.sponsors as any,
      judges: structured.judges as any,
      prizes: structured.prizes as any,
      schedule: structured.schedule as any,
      theme: form.theme || null,
      venue: form.venue || null,
      overview: form.overview || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      registration_open: form.registration_open,
      payment_instructions: form.payment_instructions.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]).map(([method, account_name = "", account_number = "", note = ""]) => ({ method, account_name, account_number, note })) as any,
      rules: parseLines(form.rules) as any,
      timeline: parsePairs(form.timeline, "date", "title") as any,
      faqs: parsePairs(form.faqs, "question", "answer") as any,
    };

    if (editingId) {
      const { error } = await supabase.from("events").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
      await logAdminAction("event.updated", "event", editingId, payload.title, { status: payload.status });
      toast.success("Event updated!");
    } else {
      const { data: created, error } = await supabase.from("events").insert(payload).select("id").maybeSingle();
      if (error) return toast.error(error.message);
      await logAdminAction("event.created", "event", created?.id ?? null, payload.title, { status: payload.status });
      toast.success("Event created!");
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setStructured(emptyStructured);
    fetchEvents();
  };

  const handleEdit = (event: Event) => {
    setEditingId(event.id);
    setForm({
      title: event.title,
      slug: event.slug,
      description: event.description ?? "",
      event_type: event.event_type as typeof emptyForm.event_type,
      status: event.status as typeof emptyForm.status,
      start_date: event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : "",
      end_date: event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "",
      registration_deadline: (event as any).registration_deadline ? new Date((event as any).registration_deadline).toISOString().slice(0, 16) : "",
      location: event.location ?? "",
      is_virtual: event.is_virtual ?? false,
      event_mode: (event as any).event_mode ?? (event.is_virtual ? "online" : "onsite"),
      online_url: (event as any).online_url ?? "",
      submission_opens_at: (event as any).submission_opens_at ? new Date((event as any).submission_opens_at).toISOString().slice(0, 16) : "",
      submission_deadline: (event as any).submission_deadline ? new Date((event as any).submission_deadline).toISOString().slice(0, 16) : "",
      judging_starts_at: (event as any).judging_starts_at ? new Date((event as any).judging_starts_at).toISOString().slice(0, 16) : "",
      judging_ends_at: (event as any).judging_ends_at ? new Date((event as any).judging_ends_at).toISOString().slice(0, 16) : "",
      results_at: (event as any).results_at ? new Date((event as any).results_at).toISOString().slice(0, 16) : "",
      max_participants: event.max_participants?.toString() ?? "",
      registration_fee: event.registration_fee?.toString() ?? "0",
      tags: event.tags?.join(", ") ?? "",
      image_url: event.image_url ?? "",
      og_image_url: (event as any).og_image_url ?? "",
      theme: (event as any).theme ?? "",
      venue: (event as any).venue ?? "",
      overview: (event as any).overview ?? "",
      contact_email: (event as any).contact_email ?? "",
      contact_phone: (event as any).contact_phone ?? "",
      registration_open: (event as any).registration_open ?? true,
      payment_instructions: (((event as any).payment_instructions ?? []) as any[]).map((p) => [p.method, p.account_name, p.account_number, p.note].filter((x, i) => i < 3 || x).join(" | ")).join("\n"),
      rules: stringifyLines((event as any).rules),
      timeline: stringifyPairs((event as any).timeline, "date", "title"),
      faqs: stringifyPairs((event as any).faqs, "question", "answer"),
    });
    const e = event as any;
    setStructured({
      sponsors: Array.isArray(e.sponsors) ? e.sponsors : [],
      judges: Array.isArray(e.judges) ? e.judges : [],
      prizes: Array.isArray(e.prizes) ? e.prizes : [],
      schedule: Array.isArray(e.schedule) ? e.schedule : [],
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    const target = events.find((e) => e.id === id);
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      await logAdminAction("event.deleted", "event", id, target?.title ?? null);
      toast.success("Event deleted");
      fetchEvents();
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "published": return "default";
      case "draft": return "secondary";
      case "ongoing": return "default";
      case "completed": return "outline";
      case "cancelled": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Events</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); setStructured(emptyStructured); } }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground gap-2">
              <Plus size={16} /> New Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Event" : "Create Event"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Hackathon 2026" />
              </div>
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated-from-title" />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v as typeof form.event_type })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {eventTypes.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {eventStatuses.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Date</Label>
                  <Input type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>End Date</Label>
                  <Input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Registration Deadline</Label>
                <Input type="datetime-local" value={form.registration_deadline} onChange={(e) => setForm({ ...form, registration_deadline: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Location</Label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Lagos, Nigeria" />
                </div>
                <div className="grid gap-2">
                  <Label>Format</Label>
                  <Select value={form.event_mode} onValueChange={(v) => setForm({ ...form, event_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">On-site</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="hybrid">Hybrid (on-site + online)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.event_mode !== "onsite" && (
                <div className="grid gap-2">
                  <Label>Online link (meeting / livestream)</Label>
                  <Input type="url" value={form.online_url} onChange={(e) => setForm({ ...form, online_url: e.target.value })} placeholder="https://meet.google.com/…" />
                </div>
              )}
              <p className="text-sm font-medium text-foreground pt-2">Submission & judging dates</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Submissions open</Label>
                  <Input type="datetime-local" value={form.submission_opens_at} onChange={(e) => setForm({ ...form, submission_opens_at: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Submission deadline</Label>
                  <Input type="datetime-local" value={form.submission_deadline} onChange={(e) => setForm({ ...form, submission_deadline: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Judging starts</Label>
                  <Input type="datetime-local" value={form.judging_starts_at} onChange={(e) => setForm({ ...form, judging_starts_at: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Judging ends</Label>
                  <Input type="datetime-local" value={form.judging_ends_at} onChange={(e) => setForm({ ...form, judging_ends_at: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Results announced</Label>
                  <Input type="datetime-local" value={form.results_at} onChange={(e) => setForm({ ...form, results_at: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Max Participants</Label>
                  <Input type="number" value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Registration Fee ($)</Label>
                  <Input type="number" step="0.01" value={form.registration_fee} onChange={(e) => setForm({ ...form, registration_fee: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Cover Image</Label>
                <ImageUpload
                  bucket="event-images"
                  folder="covers"
                  value={form.image_url || undefined}
                  onUpload={(url) => setForm({ ...form, image_url: url })}
                  onRemove={() => setForm({ ...form, image_url: "" })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Social Share Image (OG)</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Optional 1200x630 image used for link previews on Twitter/X, LinkedIn, Facebook. If empty, a branded card is generated automatically.
                </p>
                <ImageUpload
                  bucket="event-images"
                  folder="og"
                  value={form.og_image_url || undefined}
                  onUpload={(url) => setForm({ ...form, og_image_url: url })}
                  onRemove={() => setForm({ ...form, og_image_url: "" })}
                />
                {form.slug && (
                  <a
                    href={`/admin/og-preview?slug=${encodeURIComponent(form.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline w-fit"
                  >
                    Preview social card →
                  </a>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Tags (comma separated)</Label>
                <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="AI, Web3, Mobile" />
              </div>
              <div className="grid gap-4 border-t pt-4">
                <Label className="text-base font-heading">Public event page content</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Theme</Label>
                    <Input value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} placeholder="Innovate for Cameroon" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Venue</Label>
                    <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="Palais des Congrès, Yaoundé" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Overview</Label>
                  <Textarea rows={4} value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} placeholder="What this event is about, who it is for, what participants gain." />
                </div>
                <div className="grid gap-2">
                  <Label>Rules (one per line)</Label>
                  <Textarea rows={4} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Timeline (one per line: date | milestone)</Label>
                  <Textarea rows={4} value={form.timeline} onChange={(e) => setForm({ ...form, timeline: e.target.value })} placeholder={"October 2026 | Registration opens\nDecember 2026 | Competition days"} />
                </div>
                <div className="grid gap-2">
                  <Label>FAQs (one per line: question | answer)</Label>
                  <Textarea rows={4} value={form.faqs} onChange={(e) => setForm({ ...form, faqs: e.target.value })} placeholder="Who can participate? | Any registered school team of 3 to 5 students." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Contact email</Label>
                    <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Contact phone</Label>
                    <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={form.registration_open} onCheckedChange={(v) => setForm({ ...form, registration_open: v })} />
                  <Label>Registration open</Label>
                </div>
                <div className="grid gap-2">
                  <Label>Where participants pay (one per line)</Label>
                  <Textarea rows={3} placeholder={"MTN Mobile Money | TechBridge NGO | 6XX XXX XXX | Use your team name as reference\nBank transfer | TechBridge NGO | Account no. | Bank name"} value={form.payment_instructions} onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })} />
                  <p className="text-xs text-muted-foreground">Format: method | account name | number | note. Shown on the registration payment step.</p>
                </div>
              </div>
              <EventStructuredFields value={structured} onChange={setStructured} />
              <EventCategoriesEditor eventId={editingId} />
              <EventProgramsEditor eventId={editingId} />
              <Button onClick={handleSave} className="bg-gradient-primary text-primary-foreground">
                {editingId ? "Update Event" : "Create Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No events yet. Create your first event to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{event.title}</h3>
                    <Badge variant={statusColor(event.status) as any}>{event.status}</Badge>
                    <Badge variant="outline">{event.event_type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {event.start_date ? new Date(event.start_date).toLocaleDateString() : "No date"} 
                    {event.location ? ` · ${event.location}` : ""}
                    {event.is_virtual ? " · Virtual" : ""}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 self-end sm:self-auto">
                  <Button asChild size="icon" variant="ghost" aria-label={`Participants for ${event.title}`}>
                    <Link to={`/admin/events/${event.id}/participants`}><Users size={16} /></Link>
                  </Button>
                  <Button asChild size="icon" variant="ghost" aria-label={`Feedback for ${event.title}`}>
                    <Link to={`/admin/events/${event.id}/feedback`}><MessageSquare size={16} /></Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(event)} aria-label={`Edit ${event.title}`}>
                    <Pencil size={16} />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(event.id)} aria-label={`Delete ${event.title}`}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminEvents;
