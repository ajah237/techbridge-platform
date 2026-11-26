import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Save, ListChecks } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Program = Tables<"event_programs">;

interface Draft {
  id?: string;
  name: string;
  description: string;
  capacity: string;
  sort_order: number;
}

const toDraft = (p: Program): Draft => ({
  id: p.id,
  name: p.name,
  description: p.description ?? "",
  capacity: p.capacity?.toString() ?? "",
  sort_order: p.sort_order ?? 0,
});

const EventProgramsEditor = ({ eventId }: { eventId: string | null }) => {
  const [items, setItems] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("event_programs")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });
    setLoading(false);
    if (error) return toast.error(error.message);
    setItems((data ?? []).map(toDraft));
  };

  useEffect(() => { load(); }, [eventId]);

  if (!eventId) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        Save the event first, then you can add programs (tracks) so registrants can pick which one they're joining.
      </div>
    );
  }

  const update = (i: number, patch: Partial<Draft>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const add = () =>
    setItems((arr) => [
      ...arr,
      { name: "", description: "", capacity: "", sort_order: arr.length },
    ]);

  const remove = async (i: number) => {
    const target = items[i];
    if (target.id) {
      if (!confirm(`Delete program "${target.name}"? Registrants linked to it will keep their registration but lose the program tag.`)) return;
      const { error } = await supabase.from("event_programs").delete().eq("id", target.id);
      if (error) return toast.error(error.message);
    }
    setItems((arr) => arr.filter((_, idx) => idx !== i));
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
        description: it.description.trim() || null,
        capacity: it.capacity ? parseInt(it.capacity) : null,
        sort_order: i,
      };
      if (it.id) {
        const { error } = await supabase.from("event_programs").update(payload).eq("id", it.id);
        if (error) { toast.error(`"${it.name}": ${error.message}`); continue; }
      } else {
        const { error } = await supabase.from("event_programs").insert(payload);
        if (error) { toast.error(`"${it.name}": ${error.message}`); continue; }
      }
      ok++;
    }
    setSaving(false);
    toast.success(`Saved ${ok} program${ok === 1 ? "" : "s"}`);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2"><ListChecks size={14}/> Programs / Tracks</Label>
        <Button type="button" size="sm" variant="outline" onClick={add} className="gap-1">
          <Plus size={14} /> Add program
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Optional. When set, registrants pick a program at signup and you can issue certificates per program.
      </p>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">No programs yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map((it, i) => (
            <Card key={it.id ?? `new-${i}`} className="border-dashed">
              <CardContent className="p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
                  <Input
                    placeholder="Program name (e.g. Web Development)"
                    value={it.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                  <Input
                    type="number" min="1" placeholder="Capacity"
                    value={it.capacity}
                    onChange={(e) => update(i, { capacity: e.target.value })}
                  />
                  <Button
                    type="button" size="icon" variant="ghost"
                    className="text-destructive" onClick={() => remove(i)}
                    aria-label="Remove program"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                <Textarea
                  placeholder="Short description (optional)"
                  rows={2}
                  value={it.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <Button type="button" size="sm" onClick={save} disabled={saving} className="gap-1">
          <Save size={14} /> {saving ? "Saving…" : "Save programs"}
        </Button>
      )}
    </div>
  );
};

export default EventProgramsEditor;