import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Sparkles, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { levelFromPoints, levelLabel } from "@/lib/level";

type Row = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_points: number;
  badge_count?: number;
};

const Leaderboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [weeklyRows, setWeeklyRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"all" | "weekly">("all");

  useEffect(() => {
    (async () => {
      const [allTime, weekly] = await Promise.all([
        supabase.rpc("get_leaderboard", { limit_n: 50 }),
        supabase.rpc("get_weekly_leaderboard" as any, { limit_n: 50 }),
      ]);
      setRows((allTime.data as Row[]) ?? []);
      setWeeklyRows((weekly.data as Row[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy className="text-yellow-500" />;
    if (i === 1) return <Medal className="text-zinc-400" />;
    if (i === 2) return <Award className="text-amber-700" />;
    return <span className="text-muted-foreground font-mono">{i + 1}</span>;
  };

  const activeRows = scope === "weekly" ? weeklyRows : rows;
  const myIndex = user ? activeRows.findIndex((r) => r.user_id === user.id) : -1;
  const me = myIndex >= 0 ? activeRows[myIndex] : null;
  const myLevel = me ? levelFromPoints(me.total_points) : null;

  const shareRank = async () => {
    if (!me) return;
    const text = `I'm ranked #${myIndex + 1} on TechBridge with ${me.total_points} points! 🏆`;
    const url = `${window.location.origin}/leaderboard`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "TechBridge Leaderboard", text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Copied to clipboard!");
      }
    } catch (e) {
      // user cancelled
    }
  };

  const podium = activeRows.slice(0, 3);
  const rest = activeRows.slice(3);

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4 max-w-3xl">
      <SEO title="Community Leaderboard — Top Builders" description="See the top contributors on TechBridge ranked by points and badges earned through hackathons, projects, and community activity." />
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
          <Sparkles size={14} /> Gamification
        </div>
        <h1 className="text-3xl sm:text-4xl font-heading font-bold">{t("leaderboard.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("leaderboard.subtitle")}</p>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as "all" | "weekly")} className="mb-6">
        <TabsList className="grid grid-cols-2 w-full max-w-xs mx-auto">
          <TabsTrigger value="all">All time</TabsTrigger>
          <TabsTrigger value="weekly">This week</TabsTrigger>
        </TabsList>
        <TabsContent value={scope} />
      </Tabs>

      {me && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <div className="text-2xl font-bold text-primary">#{myIndex + 1}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                Your rank {myLevel && <span className="ml-1 text-xs text-muted-foreground">· Lvl {myLevel.level} {levelLabel(myLevel.level)}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {me.total_points} points{me.badge_count != null ? ` · ${me.badge_count} badges` : ""}
              </p>
              {myLevel && (
                <div className="mt-2 h-1.5 rounded-full bg-primary/15 overflow-hidden">
                  <div className="h-full bg-gradient-primary" style={{ width: `${myLevel.progress * 100}%` }} />
                </div>
              )}
            </div>
            <Button onClick={shareRank} size="sm" variant="outline" className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-center text-muted-foreground">…</p>
      ) : activeRows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {scope === "weekly" ? "No points earned in the last 7 days yet." : "No contributors yet."}
        </CardContent></Card>
      ) : (
        <>
          {podium.length === 3 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8 items-end">
              {[1, 0, 2].map((idx) => {
                const r = podium[idx];
                const heights = ["h-24 sm:h-28", "h-32 sm:h-40", "h-20 sm:h-24"];
                const colors = ["from-zinc-300 to-zinc-400", "from-yellow-300 to-yellow-500", "from-amber-500 to-amber-700"];
                const place = idx + 1;
                return (
                  <div key={r.user_id} className="flex flex-col items-center text-center">
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover ring-2 ring-primary/30 mb-2" />
                    ) : (
                      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold mb-2">
                        {(r.full_name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <p className="text-xs sm:text-sm font-semibold truncate w-full px-1">{r.full_name || "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground mb-2">{r.total_points} pts</p>
                    <div className={cn("w-full rounded-t-lg bg-gradient-to-b flex items-start justify-center pt-2", heights[idx], colors[idx])}>
                      <span className="text-xl sm:text-2xl font-bold text-white drop-shadow">#{place}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            {(podium.length === 3 ? rest : activeRows).map((r, idx) => {
              const i = (podium.length === 3 ? 3 : 0) + idx;
              const isMe = user?.id === r.user_id;
              const lv = levelFromPoints(r.total_points).level;
              return (
                <Card key={r.user_id} className={cn(isMe && "border-primary ring-2 ring-primary/30", i < 3 && "border-primary/30")}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 flex items-center justify-center text-lg font-bold">{rankIcon(i)}</div>
                    {r.avatar_url ? (
                      <img src={r.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-semibold">
                        {(r.full_name || "?").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {r.full_name || "Anonymous"} {isMe && <span className="text-xs text-primary">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Lvl {lv} · {levelLabel(lv)}
                        {r.badge_count != null && ` · ${r.badge_count} ${t("leaderboard.badges")}`}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-base font-bold">{r.total_points} {t("leaderboard.points")}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
};

export default Leaderboard;