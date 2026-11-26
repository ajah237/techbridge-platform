import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Mail, CheckCircle2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { logAdminAction } from "@/lib/auditLog";
import { downloadCsv } from "@/lib/registration";

type Profile = Tables<"profiles">;

interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  registered_at: string;
  attended: boolean;
  participant_id: string | null;
  events: { title: string; event_type: string } | null;
  profiles: { full_name: string | null; email: string | null; university: string | null } | null;
}

type EventOpt = { id: string; title: string };

const AdminParticipants = () => {
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"registrations" | "users">("registrations");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    if (view === "registrations") {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("id,event_id,user_id,status,registered_at,attended,participant_id, events(title, event_type)")
        .order("registered_at", { ascending: false });
      if (error) toast.error(error.message);
      else {
        const userIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
        const { data: profileData } = userIds.length > 0
          ? await supabase.from("profiles").select("user_id, full_name, email, university").in("user_id", userIds)
          : { data: [] as any[] };
        const profileMap = new Map((profileData ?? []).map((p: any) => [p.user_id, p]));
        setRegistrations(
          ((data ?? []) as any[]).map((r) => ({
            ...r,
            events: r.events as any,
            profiles: profileMap.get(r.user_id) ?? null,
          }))
        );
      }
      const { data: evs } = await supabase.from("events").select("id,title").order("created_at", { ascending: false });
      setEvents(((evs ?? []) as any[]).map((e) => ({ id: e.id, title: e.title })));
    } else {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setProfiles(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [view]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations.filter((r) => {
      if (eventFilter !== "all" && r.event_id !== eventFilter) return false;
      if (!q) return true;
      return [r.profiles?.full_name, r.profiles?.email, r.profiles?.university, r.events?.title]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [registrations, eventFilter, search]);

  const exportCsv = () => {
    if (filtered.length === 0) return toast.info("Nothing to export");
    const ev = events.find((e) => e.id === eventFilter);
    downloadCsv(
      `participants${ev ? "-" + ev.title.toLowerCase().replace(/\s+/g, "-") : ""}.csv`,
      filtered.map((r) => ({
        "Participant ID": String(r.participant_id ?? "").slice(0, 8).toUpperCase(),
        Name: r.profiles?.full_name ?? "",
        Email: r.profiles?.email ?? "",
        University: r.profiles?.university ?? "",
        Event: r.events?.title ?? "",
        Status: r.status,
        Attended: r.attended ? "Yes" : "No",
        Registered: new Date(r.registered_at).toISOString(),
      })),
    );
    logAdminAction("participants.export", "event", eventFilter === "all" ? null : eventFilter, `participants (${filtered.length})`, { rows: filtered.length, scope: eventFilter });
  };

  const emailAll = () => {
    const emails = [...new Set(filtered.map((r) => r.profiles?.email).filter(Boolean) as string[])];
    if (emails.length === 0) return toast.info("No emails to message");
    const ev = events.find((e) => e.id === eventFilter);
    const subject = encodeURIComponent(ev ? `${ev.title} — update` : "TechBridge update");
    const bcc = encodeURIComponent(emails.join(","));
    window.location.href = `mailto:?bcc=${bcc}&subject=${subject}`;
  };

  const markAttended = async (regId: string) => {
    if (!confirm("Mark attended and auto-issue a certificate for this participant?")) return;
    setBusyId(regId);
    const { error } = await supabase.rpc("mark_attendance_and_issue", {
      _registration_id: regId,
      _issue_certificate: true,
    });
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Attendance recorded and certificate issued");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-heading font-bold">Participants</h1>
        <Select value={view} onValueChange={(v) => setView(v as typeof view)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="registrations">Event Registrations</SelectItem>
            <SelectItem value="users">All Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {view === "registrations" && (
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Filter by event" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search name, email, university…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1">
            <Download size={14} /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={emailAll} className="gap-1">
            <Mail size={14} /> Email all ({filtered.length})
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : view === "registrations" ? (
        filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No registrations match.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((reg) => (
              <Card key={reg.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {reg.profiles?.full_name || reg.profiles?.email || "Unknown User"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {reg.events?.title ?? "Unknown Event"}
                      {reg.profiles?.university ? ` · ${reg.profiles.university}` : ""}
                    </p>
                    {reg.participant_id && (
                      <p className="text-[10px] font-mono text-muted-foreground mt-1">
                        PID: {String(reg.participant_id).slice(0, 8).toUpperCase()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 items-center">
                    <Badge variant="outline">{reg.events?.event_type}</Badge>
                    <Badge variant={reg.attended ? "default" : "secondary"}>
                      {reg.attended ? "Attended" : reg.status}
                    </Badge>
                    {!reg.attended && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === reg.id}
                        onClick={() => markAttended(reg.id)}
                        className="gap-1"
                      >
                        <CheckCircle2 size={14} />
                        {busyId === reg.id ? "Marking…" : "Mark attended"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        profiles.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No users registered yet.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {profiles.map((profile) => (
              <Card key={profile.id}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{profile.full_name || "No name"}</p>
                    <p className="text-sm text-muted-foreground">
                      {profile.email}
                      {profile.university ? ` · ${profile.university}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap shrink-0">
                    {profile.skills?.slice(0, 3).map((skill) => (
                      <Badge key={skill} variant="outline">{skill}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default AdminParticipants;
