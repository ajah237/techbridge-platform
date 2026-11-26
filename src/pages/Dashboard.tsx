import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Award, Bell, User, ExternalLink, CheckCircle,
  Clock, MapPin, Wifi, ChevronRight, Trash2, Sparkles, Trophy,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useTranslation } from "react-i18next";
import MyMentorBookings from "@/components/MyMentorBookings";

type Event = Tables<"events">;

interface RegWithEvent {
  id: string;
  event_id: string;
  registered_at: string;
  status: string;
  program_id?: string | null;
  program_name?: string | null;
  event?: Event;
}

interface CertWithEvent {
  id: string;
  certificate_number: string;
  recipient_name: string;
  issued_at: string;
  event_id: string;
  event_title?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [registrations, setRegistrations] = useState<RegWithEvent[]>([]);
  const [certificates, setCertificates] = useState<CertWithEvent[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recommended, setRecommended] = useState<Event[]>([]);
  const [points, setPoints] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAll = async () => {
      const [profileRes, regsRes, certsRes, notifsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("event_registrations").select("*, event_programs(name)").eq("user_id", user.id).order("registered_at", { ascending: false }),
        supabase.from("certificates").select("*").eq("user_id", user.id).order("issued_at", { ascending: false }),
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      // Fetch event details for registrations
      const eventIds = [
        ...new Set([
          ...(regsRes.data ?? []).map((r) => r.event_id),
          ...(certsRes.data ?? []).map((c) => c.event_id),
        ]),
      ];
      const { data: eventsData } = eventIds.length > 0
        ? await supabase.from("events").select("*").in("id", eventIds)
        : { data: [] as Event[] };
      const eventMap = new Map((eventsData ?? []).map((e) => [e.id, e]));

      setRegistrations(
        (regsRes.data ?? []).map((r: any) => ({
          ...r,
          program_name: r.event_programs?.name ?? null,
          event: eventMap.get(r.event_id),
        }))
      );
      setCertificates(
        (certsRes.data ?? []).map((c) => ({
          ...c,
          event_title: eventMap.get(c.event_id)?.title,
        }))
      );
      setNotifications((notifsRes.data as Notification[]) ?? []);

      // Recommendations based on profile skills + tags of past events
      const userTags = new Set<string>();
      (profileRes.data?.skills ?? []).forEach((s: string) => userTags.add(s.toLowerCase()));
      (eventsData ?? []).forEach((e) => (e.tags ?? []).forEach((t: string) => userTags.add(t.toLowerCase())));
      const registeredIds = new Set((regsRes.data ?? []).map((r) => r.event_id));
      const { data: upcoming } = await supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .gte("start_date", new Date().toISOString())
        .order("start_date", { ascending: true })
        .limit(20);
      const scored = (upcoming ?? [])
        .filter((e) => !registeredIds.has(e.id))
        .map((e) => {
          const tagMatches = (e.tags ?? []).filter((t: string) => userTags.has(t.toLowerCase())).length;
          return { e, score: tagMatches };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => s.e);
      setRecommended(scored);

      // Points + badges
      const [pointsRes, badgesRes] = await Promise.all([
        supabase.from("points_log").select("points").eq("user_id", user.id),
        supabase.from("user_badges").select("id").eq("user_id", user.id),
      ]);
      setPoints((pointsRes.data ?? []).reduce((s, p) => s + (p.points ?? 0), 0));
      setBadgeCount((badgesRes.data ?? []).length);

      setLoading(false);
    };

    fetchAll();

    // Realtime notifications
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const upcomingEvents = registrations.filter(
    (r) => r.event?.start_date && new Date(r.event.start_date) > new Date()
  );

  if (loading) {
    return (
      <main className="pt-24 min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </main>
    );
  }

  return (
    <main className="pt-20 min-h-dvh">
      <SEO title="Dashboard" noIndex />
      {/* Hero */}
      <section className="py-10 bg-gradient-hero dark">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-heading font-bold text-xl shrink-0">
              {profile?.full_name
                ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                : user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-heading font-bold text-foreground truncate">
                Welcome back, {profile?.full_name?.split(" ")[0] || "there"}!
              </h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: "Registered", value: registrations.length, icon: Calendar },
              { label: "Certificates", value: certificates.length, icon: Award },
              { label: "Points", value: points, icon: Trophy },
              { label: "Badges", value: badgeCount, icon: Sparkles },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-[hsl(220,20%,12%)] border border-[hsl(220,20%,18%)] p-4 text-center">
                <Icon size={20} className="mx-auto text-primary mb-1" aria-hidden />
                <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="container mx-auto px-4 space-y-8 max-w-3xl">

          <MyMentorBookings />

          {/* Recommendations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold flex items-center gap-2">
                <Sparkles size={18} className="text-primary" /> {t("dashboard.recommended")}
              </h2>
            </div>
            {recommended.length === 0 ? (
              <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">{t("dashboard.noRecommendations")}</CardContent></Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {recommended.map((e) => (
                  <Link key={e.id} to={`/events/${e.slug}`}>
                    <Card className="h-full hover:border-primary/40 transition-colors">
                      <CardContent className="p-4">
                        <Badge variant="outline" className="text-xs capitalize mb-2">{e.event_type}</Badge>
                        <p className="font-semibold text-sm line-clamp-2">{e.title}</p>
                        {e.start_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(e.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold flex items-center gap-2">
                <Bell size={18} className="text-primary" />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
                )}
              </h2>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-muted-foreground">
                  Mark all read
                </Button>
              )}
            </div>
            {notifications.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No notifications yet.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {notifications.slice(0, 5).map((n) => (
                  <Card
                    key={n.id}
                    className={`transition-colors ${!n.is_read ? "border-primary/30 bg-primary/5" : ""}`}
                  >
                    <CardContent className="p-4 flex items-start gap-3">
                      <div
                        className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${!n.is_read ? "bg-primary" : "bg-transparent"}`}
                      />
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => !n.is_read && markAsRead(n.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (!n.is_read && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            markAsRead(n.id);
                          }
                        }}
                      >
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(n.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {n.link && (
                          <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                            <Link to={n.link} aria-label="Open notification link">
                              <ExternalLink size={14} />
                            </Link>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" aria-label="Delete notification" onClick={() => deleteNotification(n.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Events */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading font-bold flex items-center gap-2">
                <Calendar size={18} className="text-primary" />
                Your Events
              </h2>
              <Button asChild variant="ghost" size="sm" className="text-xs gap-1">
                <Link to="/events">
                  Browse Events <ChevronRight size={14} />
                </Link>
              </Button>
            </div>
            {registrations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  You haven't registered for any events yet.{" "}
                  <Link to="/events" className="text-primary hover:underline">Browse events</Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {registrations.map((reg) => {
                  const ev = reg.event;
                  if (!ev) return null;
                  const isPast = ev.start_date && new Date(ev.start_date) < new Date();
                  return (
                    <Card key={reg.id} className={isPast ? "opacity-70" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs capitalize">{ev.event_type}</Badge>
                              {isPast ? (
                                <Badge variant="secondary" className="text-xs">Completed</Badge>
                              ) : (
                                <Badge className="text-xs bg-[hsl(150,60%,40%)]/10 text-[hsl(150,60%,40%)] border-[hsl(150,60%,40%)]/30">
                                  Upcoming
                                </Badge>
                              )}
                            </div>
                            <p className="font-semibold text-sm">{ev.title}</p>
                            {reg.program_name && (
                              <p className="text-xs mt-1">
                                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                                  Program: {reg.program_name}
                                </Badge>
                              </p>
                            )}
                            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                              {ev.start_date && (
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {new Date(ev.start_date).toLocaleDateString("en-US", {
                                    month: "short", day: "numeric", year: "numeric",
                                  })}
                                </span>
                              )}
                              {ev.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={12} /> {ev.location}
                                </span>
                              )}
                              {ev.is_virtual && (
                                <span className="flex items-center gap-1">
                                  <Wifi size={12} /> Virtual
                                </span>
                              )}
                            </div>
                          </div>
                          <CheckCircle size={18} className="text-[hsl(150,60%,40%)] shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Certificates */}
          <div>
            <h2 className="text-lg font-heading font-bold flex items-center gap-2 mb-4">
              <Award size={18} className="text-primary" />
              Your Certificates
            </h2>
            {certificates.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No certificates issued yet. Complete events to earn certificates!
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {certificates.map((cert) => (
                  <Card key={cert.id} className="border-primary/20">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{cert.event_title || "Certificate"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{cert.certificate_number}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Issued {new Date(cert.issued_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                          })}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="gap-1 text-xs shrink-0">
                        <Link to={`/verify/${cert.certificate_number}`}>
                          <ExternalLink size={12} /> Verify
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Profile Quick Actions */}
          <div className="flex gap-3 pb-8">
            <Button asChild variant="outline" className="flex-1 gap-2">
              <Link to="/profile">
                <User size={16} /> Edit Profile
              </Link>
            </Button>
            <Button asChild className="flex-1 gap-2 bg-gradient-primary text-primary-foreground hover:opacity-90">
              <Link to="/events">
                <Calendar size={16} /> Browse Events
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Dashboard;
