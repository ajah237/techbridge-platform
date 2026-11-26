import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EMOJIS = ["👍", "❤️", "🚀", "💡", "🎉"] as const;
type Emoji = (typeof EMOJIS)[number];

interface Props {
  projectId: string;
}

const ProjectReactions = ({ projectId }: Props) => {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data } = await supabase
      .from("project_reactions" as any)
      .select("emoji,user_id")
      .eq("project_id", projectId);
    const list = ((data as any) ?? []) as { emoji: string; user_id: string }[];
    const c: Record<string, number> = {};
    const m = new Set<string>();
    list.forEach((r) => {
      c[r.emoji] = (c[r.emoji] ?? 0) + 1;
      if (user && r.user_id === user.id) m.add(r.emoji);
    });
    setCounts(c);
    setMine(m);
  };

  useEffect(() => {
    load();
  }, [projectId, user?.id]);

  const toggle = async (emoji: Emoji) => {
    if (!user) return toast.error("Sign in to react");
    if (mine.has(emoji)) {
      const { error } = await supabase
        .from("project_reactions" as any)
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("project_reactions" as any)
        .insert({ project_id: projectId, user_id: user.id, emoji });
      if (error) return toast.error(error.message);
    }
    load();
  };

  return (
    <div className="flex flex-wrap gap-2">
      {EMOJIS.map((e) => {
        const isMine = mine.has(e);
        const count = counts[e] ?? 0;
        return (
          <button
            type="button"
            key={e}
            onClick={() => toggle(e)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm transition-all hover:scale-110 active:scale-95",
              isMine
                ? "bg-primary/10 border-primary text-primary font-semibold"
                : "bg-background border-border hover:bg-muted/50"
            )}
            aria-label={`React with ${e}`}
            aria-pressed={isMine}
          >
            <span className="mr-1">{e}</span>
            <span className="tabular-nums">{count}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ProjectReactions;