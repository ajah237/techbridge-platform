import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Save, Users, MoveUp, MoveDown } from "lucide-react";
import { toast } from "sonner";
import ImageUpload from "@/components/ImageUpload";
import { safeHref } from "@/lib/utils";

interface Member {
  id?: string;
  full_name: string;
  role: string;
  bio: string;
  photo_url: string;
  initials: string;
  linkedin_url: string;
  twitter_url: string;
  email: string;
  sort_order: number;
}

const blank = (order: number): Member => ({
  full_name: "", role: "", bio: "", photo_url: "",
  initials: "", linkedin_url: "", twitter_url: "", email: "", sort_order: order,
});

const fromRow = (r: any): Member => ({
  id: r.id,
  full_name: r.full_name ?? "",
  role: r.role ?? "",
  bio: r.bio ?? "",
  photo_url: r.photo_url ?? "",
  initials: r.initials ?? "",
  linkedin_url: r.linkedin_url ?? "",
  twitter_url: r.twitter_url ?? "",
  email: r.email ?? "",
  sort_order: r.sort_order ?? 0,
});

const AboutTeamEditor = () => {
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("about_team_members" as any)
      .select("*")
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems(((data ?? []) as any[]).map(fromRow));
  };

  useEffect(() => { load(); }, []);

  const update = (i: number, patch: Partial<Member>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const add = () =>
    setItems((arr) => [...arr, blank(arr.length)]);

  const move = (i: number, dir: -1 | 1) => {
    setItems((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((m, idx) => ({ ...m, sort_order: idx }));
    });
  };

  const remove = async (i: number) => {
    const target = items[i];
    if (target.id) {
      if (!confirm(`Remove "${target.full_name || "this member"}" from the team?`)) return;
      const { error } = await supabase.from("about_team_members" as any).delete().eq("id", target.id);
      if (error) return toast.error(error.message);
    }
    setItems((arr) => arr.filter((_, idx) => idx !== i).map((m, idx) => ({ ...m, sort_order: idx })));
  };

  const save = async () => {
    setSaving(true);
    let ok = 0;
    for (let i = 0; i < items.length; i++) {
      const it = { ...items[i], sort_order: i };
      if (!it.full_name.trim() || !it.role.trim()) continue;
      if (it.linkedin_url.trim() && !safeHref(it.linkedin_url)) {
        toast.error(`"${it.full_name}": LinkedIn URL must start with https://`);
        continue;
      }
      if (it.twitter_url.trim() && !safeHref(it.twitter_url)) {
        toast.error(`"${it.full_name}": Twitter/X URL must start with https://`);
        continue;
      }
      const payload: any = {
        full_name: it.full_name.trim(),
        role: it.role.trim(),
        bio: it.bio.trim() || null,
        photo_url: it.photo_url.trim() || null,
        initials: it.initials.trim() || it.full_name.trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(),
        linkedin_url: safeHref(it.linkedin_url) ?? null,
        twitter_url: safeHref(it.twitter_url) ?? null,
        email: it.email.trim() || null,
        sort_order: i,
      };
      if (it.id) {
        const { error } = await supabase.from("about_team_members" as any).update(payload).eq("id", it.id);
        if (error) { toast.error(`"${it.full_name}": ${error.message}`); continue; }
      } else {
        const { error } = await supabase.from("about_team_members" as any).insert(payload);
        if (error) { toast.error(`"${it.full_name}": ${error.message}`); continue; }
      }
      ok++;
    }
    setSaving(false);
    toast.success(`Saved ${ok} member${ok === 1 ? "" : "s"}`);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-base"><Users size={16} /> Leadership Team</Label>
        <Button type="button" size="sm" variant="outline" onClick={add} className="gap-1">
          <Plus size={14} /> Add member
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">Shown on the public About page. Order here matches the display order.</p>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground italic border border-dashed rounded-md p-4">No team members yet — add your first lead above.</div>
      ) : (
        <div className="space-y-3">
          {items.map((it, i) => (
            <Card key={it.id ?? `new-${i}`} className="border-dashed">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      <MoveUp size={14} />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
                      <MoveDown size={14} />
                    </Button>
                    <span className="text-xs text-muted-foreground ml-1">#{i + 1}</span>
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(i)} aria-label="Remove">
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input placeholder="Full name" value={it.full_name} onChange={(e) => update(i, { full_name: e.target.value })} />
                  <Input placeholder="Role (e.g. Founder & CEO)" value={it.role} onChange={(e) => update(i, { role: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2">
                  <Input placeholder="Initials" maxLength={3} value={it.initials} onChange={(e) => update(i, { initials: e.target.value.toUpperCase() })} />
                  <ImageUpload
                    bucket="avatars"
                    folder="team"
                    value={it.photo_url || null}
                    onUpload={(url) => update(i, { photo_url: url })}
                    onRemove={() => update(i, { photo_url: "" })}
                    maxSizeMB={3}
                  />
                </div>
                <Textarea placeholder="Short bio (optional)" rows={2} value={it.bio} onChange={(e) => update(i, { bio: e.target.value })} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input placeholder="LinkedIn URL" value={it.linkedin_url} onChange={(e) => update(i, { linkedin_url: e.target.value })} />
                  <Input placeholder="Twitter/X URL" value={it.twitter_url} onChange={(e) => update(i, { twitter_url: e.target.value })} />
                  <Input placeholder="Email" type="email" value={it.email} onChange={(e) => update(i, { email: e.target.value })} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <Button type="button" size="sm" onClick={save} disabled={saving} className="gap-1">
          <Save size={14} /> {saving ? "Saving…" : "Save team"}
        </Button>
      )}
    </div>
  );
};

export default AboutTeamEditor;