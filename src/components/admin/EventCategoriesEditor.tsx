import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Save, Layers } from "lucide-react";
import { toast } from "sonner";
import type { EventCategory, FeeTier } from "@/lib/registration";

interface TierDraft {
  id?: string;
  label: string;
  amount: string;
  opens_at: string;
  closes_at: string;
}

interface CategoryDraft {
  id?: string;
  name: string;
  slug: string;
  description: string;
  eligibility: string;
  competition_date: string;
  challenge_release_at: string;
  registration_deadline: string;
  min_team_size: string;
  max_team_size: string;
  institution_label: string;
  requires_institution: boolean;
  requires_teacher_mentor: boolean;
  requires_class_level: boolean;
  currency: string;
  is_active: boolean;
  tiers: TierDraft[];
}

const dt = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const blankTier = (i: number): TierDraft => ({
  label: ["Early", "Normal", "Late"][i] ?? "Tier",
  amount: "0",
  opens_at: "",
  closes_at: "",
});

const blankCategory = (): CategoryDraft => ({
  name: "",
  slug: "",
  description: "",
  eligibility: "",
  competition_date: "",
  challenge_release_at: "",
  registration_deadline: "",
  min_team_size: "3",
  max_team_size: "5",
  institution_label: "Institution",
  requires_institution: true,
  requires_teacher_mentor: false,
  requires_class_level: false,
  currency: "FCFA",
  is_active: true,
  tiers: [blankTier(0), blankTier(1), blankTier(2)],
});

const toDraft = (c: EventCategory, tiers: FeeTier[]): CategoryDraft => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  description: c.description ?? "",
  eligibility: c.eligibility ?? "",
  competition_date: dt(c.competition_date),
  challenge_release_at: dt(c.challenge_release_at),
  registration_deadline: dt(c.registration_deadline),
  min_team_size: String(c.min_team_size ?? 1),
  max_team_size: String(c.max_team_size ?? 5),
  institution_label: c.institution_label ?? "Institution",
  requires_institution: c.requires_institution,
  requires_teacher_mentor: c.requires_teacher_mentor,
  requires_class_level: c.requires_class_level,
  currency: c.currency ?? "FCFA",
  is_active: c.is_active,
  tiers: tiers
    .filter((t) => t.category_id === c.id)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((t) => ({
      id: t.id,
      label: t.label,
      amount: String(t.amount ?? 0),
      opens_at: dt(t.opens_at),
      closes_at: dt(t.closes_at),
    })),
});

const EventCategoriesEditor = ({ eventId }: { eventId: string | null }) => {
  const [items, setItems] = useState<CategoryDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    const { data: cats, error } = await supabase
      .from("event_categories")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order");
    if (error) { setLoading(false); return toast.error(error.message); }
    const ids = (cats ?? []).map((c) => c.id);
    let tiers: FeeTier[] = [];
    if (ids.length) {
      const { data } = await supabase.from("category_fee_tiers").select("*").in("category_id", ids);
      tiers = data ?? [];
    }
    setItems((cats ?? []).map((c) => toDraft(c, tiers)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventId]);

  if (!eventId) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        Save the event first, then add registration categories (age group, school level, track…) with their own dates,
        team sizes and fee tiers.
      </div>
    );
  }

  const update = (i: number, patch: Partial<CategoryDraft>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const updateTier = (ci: number, ti: number, patch: Partial<TierDraft>) =>
    setItems((arr) =>
      arr.map((it, idx) =>
        idx === ci ? { ...it, tiers: it.tiers.map((t, j) => (j === ti ? { ...t, ...patch } : t)) } : it,
      ),
    );

  const removeCategory = async (i: number) => {
    const target = items[i];
    if (target.id) {
      if (!confirm(`Delete category "${target.name}"? Existing registrations keep their data but lose the category link.`)) return;
      const { error } = await supabase.from("event_categories").delete().eq("id", target.id);
      if (error) return toast.error(error.message);
    }
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  };

  const removeTier = async (ci: number, ti: number) => {
    const t = items[ci].tiers[ti];
    if (t.id) {
      const { error } = await supabase.from("category_fee_tiers").delete().eq("id", t.id);
      if (error) return toast.error(error.message);
    }
    setItems((arr) => arr.map((it, idx) => (idx === ci ? { ...it, tiers: it.tiers.filter((_, j) => j !== ti) } : it)));
  };

  const save = async () => {
    setSaving(true);
    let ok = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.name.trim()) continue;
      const payload = {
        event_id: eventId,
        name: it.name.trim(),
        slug: it.slug.trim() || slugify(it.name),
        description: it.description.trim() || null,
        eligibility: it.eligibility.trim() || null,
        competition_date: it.competition_date || null,
        challenge_release_at: it.challenge_release_at || null,
        registration_deadline: it.registration_deadline || null,
        min_team_size: parseInt(it.min_team_size) || 1,
        max_team_size: parseInt(it.max_team_size) || 1,
        institution_label: it.institution_label.trim() || "Institution",
        requires_institution: it.requires_institution,
        requires_teacher_mentor: it.requires_teacher_mentor,
        requires_class_level: it.requires_class_level,
        currency: it.currency.trim() || "FCFA",
        is_active: it.is_active,
        sort_order: i,
      };
      let categoryId = it.id;
      if (categoryId) {
        const { error } = await supabase.from("event_categories").update(payload).eq("id", categoryId);
        if (error) { toast.error(`"${it.name}": ${error.message}`); continue; }
      } else {
        const { data, error } = await supabase.from("event_categories").insert(payload).select("id").maybeSingle();
        if (error) { toast.error(`"${it.name}": ${error.message}`); continue; }
        categoryId = data?.id;
      }
      if (!categoryId) continue;

      for (let j = 0; j < it.tiers.length; j++) {
        const t = it.tiers[j];
        if (!t.label.trim()) continue;
        const tierPayload = {
          category_id: categoryId,
          label: t.label.trim(),
          amount: parseFloat(t.amount) || 0,
          currency: payload.currency,
          opens_at: t.opens_at || null,
          closes_at: t.closes_at || null,
          sort_order: j,
        };
        if (t.id) await supabase.from("category_fee_tiers").update(tierPayload).eq("id", t.id);
        else await supabase.from("category_fee_tiers").insert(tierPayload);
      }
      ok++;
    }
    setSaving(false);
    toast.success(`Saved ${ok} categor${ok === 1 ? "y" : "ies"}`);
    load();
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-base font-heading"><Layers size={15} /> Registration categories</Label>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setItems((a) => [...a, blankCategory()])}>
          <Plus size={14} /> Add category
        </Button>
      </div>
      <p className="-mt-1 text-xs text-muted-foreground">
        Each category drives the public registration form: its own competition date, team size limits, required details and fee tiers.
      </p>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm italic text-muted-foreground">No categories yet.</div>
      ) : (
        <div className="space-y-4">
          {items.map((it, i) => (
            <Card key={it.id ?? `new-${i}`} className="border-dashed">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start gap-2">
                  <Input className="flex-1" placeholder="Category name (e.g. Secondary School Innovation Challenge)"
                    value={it.name} onChange={(e) => update(i, { name: e.target.value })} />
                  <Button type="button" size="icon" variant="ghost" className="text-destructive"
                    aria-label="Remove category" onClick={() => removeCategory(i)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
                <Textarea rows={2} placeholder="Short description shown on the event page"
                  value={it.description} onChange={(e) => update(i, { description: e.target.value })} />
                <Textarea rows={2} placeholder="Eligibility (who can enter)"
                  value={it.eligibility} onChange={(e) => update(i, { eligibility: e.target.value })} />

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Competition date</Label>
                    <Input type="datetime-local" value={it.competition_date} onChange={(e) => update(i, { competition_date: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Challenge released</Label>
                    <Input type="datetime-local" value={it.challenge_release_at} onChange={(e) => update(i, { challenge_release_at: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Registration deadline</Label>
                    <Input type="datetime-local" value={it.registration_deadline} onChange={(e) => update(i, { registration_deadline: e.target.value })} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Min team size</Label>
                    <Input type="number" min="1" value={it.min_team_size} onChange={(e) => update(i, { min_team_size: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Max team size</Label>
                    <Input type="number" min="1" value={it.max_team_size} onChange={(e) => update(i, { max_team_size: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Institution label</Label>
                    <Input placeholder="School / University" value={it.institution_label} onChange={(e) => update(i, { institution_label: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Currency</Label>
                    <Input value={it.currency} onChange={(e) => update(i, { currency: e.target.value })} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={it.requires_institution} onCheckedChange={(v) => update(i, { requires_institution: v })} />
                    Institution required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={it.requires_teacher_mentor} onCheckedChange={(v) => update(i, { requires_teacher_mentor: v })} />
                    Teacher / mentor required
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={it.requires_class_level} onCheckedChange={(v) => update(i, { requires_class_level: v })} />
                    Ask class / level
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={it.is_active} onCheckedChange={(v) => update(i, { is_active: v })} />
                    Open for registration
                  </label>
                </div>

                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wide">Fee tiers</Label>
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1"
                      onClick={() => update(i, { tiers: [...it.tiers, blankTier(it.tiers.length)] })}>
                      <Plus size={13} /> Add tier
                    </Button>
                  </div>
                  {it.tiers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Free entry — no tiers configured.</p>
                  ) : (
                    it.tiers.map((t, ti) => (
                      <div key={t.id ?? `t-${ti}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                        <Input placeholder="Label" value={t.label} onChange={(e) => updateTier(i, ti, { label: e.target.value })} />
                        <Input type="number" placeholder="Amount" value={t.amount} onChange={(e) => updateTier(i, ti, { amount: e.target.value })} />
                        <Input type="datetime-local" aria-label="Opens at" value={t.opens_at} onChange={(e) => updateTier(i, ti, { opens_at: e.target.value })} />
                        <Input type="datetime-local" aria-label="Closes at" value={t.closes_at} onChange={(e) => updateTier(i, ti, { closes_at: e.target.value })} />
                        <Button type="button" size="icon" variant="ghost" className="text-destructive" aria-label="Remove tier" onClick={() => removeTier(i, ti)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <Button type="button" size="sm" className="gap-1" onClick={save} disabled={saving}>
          <Save size={14} /> {saving ? "Saving…" : "Save categories & fees"}
        </Button>
      )}
    </div>
  );
};

export default EventCategoriesEditor;
