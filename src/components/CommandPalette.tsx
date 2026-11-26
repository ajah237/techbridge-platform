import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Calendar, FileText, Trophy, Users, MessageCircle, Layers, GraduationCap, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { escapeIlike } from "@/lib/utils";

type SearchResult = {
  type: "event" | "blog" | "project" | "thread" | "mentor";
  id: string;
  title: string;
  slug?: string;
};

export const useCommandPalette = () => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  return { open, setOpen };
};

const CommandPalette = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    const handle = setTimeout(async () => {
      const q = `%${escapeIlike(trimmed)}%`;
      const [ev, bp, pr, ft, mp] = await Promise.all([
        supabase
          .from("events")
          .select("id,title,slug")
          .in("status", ["published", "ongoing", "completed"])
          .ilike("title", q)
          .limit(5),
        supabase
          .from("blog_posts")
          .select("id,title,slug")
          .eq("status", "published")
          .ilike("title", q)
          .limit(5),
        supabase
          .from("projects")
          .select("id,title")
          .eq("status", "approved")
          .ilike("title", q)
          .limit(5),
        supabase
          .from("forum_threads")
          .select("id,title")
          .ilike("title", q)
          .limit(5),
        supabase
          .from("mentor_profiles")
          .select("user_id,title,bio")
          .eq("is_active", true)
          .ilike("bio", q)
          .limit(5),
      ]);
      if (!active) return;

      const r: SearchResult[] = [
        ...(ev.data ?? []).map((e) => ({ type: "event" as const, id: e.id, title: e.title, slug: e.slug })),
        ...(bp.data ?? []).map((b) => ({ type: "blog" as const, id: b.id, title: b.title, slug: b.slug })),
        ...(pr.data ?? []).map((p) => ({ type: "project" as const, id: p.id, title: p.title })),
        ...(ft.data ?? []).map((th) => ({ type: "thread" as const, id: th.id, title: th.title })),
        ...(mp.data ?? []).map((m) => ({
          type: "mentor" as const,
          id: m.user_id,
          title: m.title || (m.bio ? m.bio.slice(0, 60) : "Mentor"),
        })),
      ];
      setResults(r);
    }, 200);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  const go = (path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("search.placeholder")} value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{t("search.noResults")}</CommandEmpty>

        {query.trim().length >= 2 && (
          <CommandGroup heading="Full search">
            <CommandItem onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}>
              <Search className="mr-2 h-4 w-4" /> See all results for "{query.trim()}"
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Quick navigation">
          <CommandItem onSelect={() => go("/events")}><Calendar className="mr-2 h-4 w-4" /> {t("nav.events")}</CommandItem>
          <CommandItem onSelect={() => go("/blog")}><FileText className="mr-2 h-4 w-4" /> {t("nav.blog")}</CommandItem>
          <CommandItem onSelect={() => go("/projects")}><Layers className="mr-2 h-4 w-4" /> {t("nav.projects")}</CommandItem>
          <CommandItem onSelect={() => go("/mentors")}><Users className="mr-2 h-4 w-4" /> {t("nav.mentors")}</CommandItem>
          <CommandItem onSelect={() => go("/forum")}><MessageCircle className="mr-2 h-4 w-4" /> Forum</CommandItem>
          <CommandItem onSelect={() => go("/leaderboard")}><Trophy className="mr-2 h-4 w-4" /> {t("nav.leaderboard")}</CommandItem>
          <CommandItem onSelect={() => go("/messages")}><MessageCircle className="mr-2 h-4 w-4" /> {t("nav.messages")}</CommandItem>
        </CommandGroup>

        {results.filter((r) => r.type === "event").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("search.events")}>
              {results.filter((r) => r.type === "event").map((r) => (
                <CommandItem key={r.id} onSelect={() => go(`/events/${r.slug}`)}>
                  <Calendar className="mr-2 h-4 w-4" /> {r.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {results.filter((r) => r.type === "blog").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("search.blog")}>
              {results.filter((r) => r.type === "blog").map((r) => (
                <CommandItem key={r.id} onSelect={() => go(`/blog/${r.slug}`)}>
                  <FileText className="mr-2 h-4 w-4" /> {r.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {results.filter((r) => r.type === "project").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("search.projects")}>
              {results.filter((r) => r.type === "project").map((r) => (
                <CommandItem key={r.id} onSelect={() => go(`/projects/${r.id}`)}>
                  <Layers className="mr-2 h-4 w-4" /> {r.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {results.filter((r) => r.type === "thread").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Forum threads">
              {results.filter((r) => r.type === "thread").map((r) => (
                <CommandItem key={r.id} onSelect={() => go(`/forum/t/${r.id}`)}>
                  <MessageCircle className="mr-2 h-4 w-4" /> {r.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {results.filter((r) => r.type === "mentor").length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Mentors">
              {results.filter((r) => r.type === "mentor").map((r) => (
                <CommandItem key={r.id} onSelect={() => go("/mentors")}>
                  <GraduationCap className="mr-2 h-4 w-4" /> {r.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
