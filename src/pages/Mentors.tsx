import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, MessageCircle, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import MentorReviews from "@/components/MentorReviews";
import SEO from "@/components/SEO";
import BookMentorDialog from "@/components/BookMentorDialog";
import { cn } from "@/lib/utils";

type Mentor = {
  id: string;
  user_id: string;
  expertise: string[];
  bio: string | null;
  availability: string | null;
  profile?: { full_name: string | null; avatar_url: string | null };
};
type Rating = { mentor_id: string; avg_rating: number; review_count: number };

const Mentors = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [mySkills, setMySkills] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("mentor_profiles").select("*").eq("is_active", true);
      const list = (data ?? []) as Mentor[];
      const ids = list.map((m) => m.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.rpc("get_public_profiles", { _user_ids: ids });
        const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
        list.forEach((m) => (m.profile = map.get(m.user_id) as any));
        const { data: rData } = await supabase.rpc("get_mentor_ratings", { _mentor_ids: ids });
        const rMap: Record<string, Rating> = {};
        (rData ?? []).forEach((r) => (rMap[r.mentor_id] = r));
        setRatings(rMap);
      }
      setMentors(list);
    })();
  }, []);

  useEffect(() => {
    if (!user) {
      setMySkills([]);
      return;
    }
    (async () => {
      const { data } = await supabase.from("profiles").select("skills").eq("user_id", user.id).maybeSingle();
      setMySkills((data?.skills ?? []) as string[]);
    })();
  }, [user]);

  const norm = (s: string) => s.trim().toLowerCase();
  const mySkillSet = new Set(mySkills.map(norm));
  const scoreFor = (m: Mentor) => {
    if (!mySkillSet.size || !m.expertise?.length) return 0;
    return m.expertise.filter((e) => mySkillSet.has(norm(e))).length;
  };
  const recommended = mySkillSet.size
    ? mentors
        .map((m) => ({ m, score: scoreFor(m) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((x) => x.m)
    : [];
  const recommendedIds = new Set(recommended.map((m) => m.id));
  const others = mentors.filter((m) => !recommendedIds.has(m.id));

  const startChat = async (mentorUserId: string) => {
    if (!user) {
      toast.error("Please sign in to message mentors");
      return;
    }
    if (user.id === mentorUserId) {
      toast.info("You cannot message yourself");
      return;
    }
    const a = user.id < mentorUserId ? user.id : mentorUserId;
    const b = user.id < mentorUserId ? mentorUserId : user.id;
    const { data: existing } = await supabase.from("conversations").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data: created, error } = await supabase.from("conversations").insert({ user_a: a, user_b: b }).select("id").single();
      if (error) {
        toast.error(error.message);
        return;
      }
      convId = created.id;
    }
    navigate(`/messages?c=${convId}`);
  };

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4 max-w-5xl">
      <SEO
        title="Find a Mentor — 1:1 Tech Mentorship"
        description="Browse vetted mentors across software, design, data, and entrepreneurship. Book reviews, get career guidance, and grow faster with 1:1 mentorship."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "TechBridge Mentors",
          itemListElement: mentors.slice(0, 20).map((m, i) => ({
            "@type": "Person",
            position: i + 1,
            name: m.profile?.full_name || "Mentor",
            description: m.bio || undefined,
            knowsAbout: m.expertise,
          })),
        }}
      />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
            <GraduationCap size={14} /> Mentorship
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold">{t("mentors.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("mentors.subtitle")}</p>
        </div>
        {user && (
          <Button asChild className="gap-2 bg-gradient-primary text-primary-foreground">
            <Link to="/mentors/become">
              <Plus size={16} /> {t("mentors.becomeMentor")}
            </Link>
          </Button>
        )}
      </div>

      {mentors.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No mentors yet — be the first!</CardContent></Card>
      ) : (
        <>
          {recommended.length > 0 && (
            <section className="mb-8">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-heading font-bold text-xl">Recommended for you</h2>
                <p className="text-xs text-muted-foreground">Matched on your skills</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recommended.map((m) => (
                  <MentorCard
                    key={m.id}
                    m={m}
                    ratings={ratings}
                    startChat={startChat}
                    t={t}
                    matchCount={scoreFor(m)}
                    highlighted
                  />
                ))}
              </div>
            </section>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((m) => (
              <MentorCard
                key={m.id}
                m={m}
                ratings={ratings}
                startChat={startChat}
                t={t}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
};

function MentorCard({
  m,
  ratings,
  startChat,
  t,
  matchCount,
  highlighted,
}: {
  m: Mentor;
  ratings: Record<string, Rating>;
  startChat: (id: string) => void;
  t: (k: string) => string;
  matchCount?: number;
  highlighted?: boolean;
}) {
  return (
    <Card className={cn(highlighted && "border-primary/40")}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          {m.profile?.avatar_url ? (
            <img src={m.profile.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
              {(m.profile?.full_name || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{m.profile?.full_name || "Mentor"}</p>
            {matchCount ? (
              <p className="text-xs text-primary font-medium">{matchCount} matching skill{matchCount > 1 ? "s" : ""}</p>
            ) : m.availability ? (
              <p className="text-xs text-muted-foreground">{m.availability}</p>
            ) : null}
          </div>
        </div>
        {m.bio && <p className="text-sm text-muted-foreground line-clamp-3">{m.bio}</p>}
        {m.expertise?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {m.expertise.slice(0, 5).map((e) => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1 text-xs">
            {ratings[m.user_id] ? (
              <>
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{Number(ratings[m.user_id].avg_rating).toFixed(1)}</span>
                <span className="text-muted-foreground">({ratings[m.user_id].review_count})</span>
              </>
            ) : (
              <span className="text-muted-foreground italic">No reviews yet</span>
            )}
          </div>
          <MentorReviews mentorUserId={m.user_id} mentorName={m.profile?.full_name || "Mentor"} />
        </div>
        <Button onClick={() => startChat(m.user_id)} className="w-full gap-2" variant="outline">
          <MessageCircle size={14} /> {t("mentors.message")}
        </Button>
        <BookMentorDialog mentorUserId={m.user_id} mentorName={m.profile?.full_name || "Mentor"} />
      </CardContent>
    </Card>
  );
}

export default Mentors;
