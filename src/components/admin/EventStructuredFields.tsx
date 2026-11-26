import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

export type Sponsor = { name: string; logo_url?: string; url?: string };
export type Judge = { name: string; role?: string; avatar_url?: string; bio?: string };
export type Prize = { place: string; title: string; description?: string; value?: string };
export type ScheduleItem = { time: string; title: string; description?: string };

export interface StructuredEventFields {
  sponsors: Sponsor[];
  judges: Judge[];
  prizes: Prize[];
  schedule: ScheduleItem[];
}

interface Props {
  value: StructuredEventFields;
  onChange: (v: StructuredEventFields) => void;
}

function Section<T>({
  title, items, blank, onChange, render,
}: {
  title: string;
  items: T[];
  blank: T;
  onChange: (next: T[]) => void;
  render: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-heading">{title}</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, { ...blank }])}>
          <Plus size={14} className="mr-1" /> Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">None added yet.</p>
      ) : (
        items.map((item, i) => (
          <Card key={i}>
            <CardContent className="p-3 space-y-2">
              <div className="flex justify-end">
                <Button type="button" size="icon" variant="ghost" className="text-destructive h-7 w-7"
                  aria-label={`Remove ${title} item`}
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
                  <Trash2 size={14} />
                </Button>
              </div>
              {render(item, (patch) => {
                const next = [...items];
                next[i] = { ...item, ...patch };
                onChange(next);
              })}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

const EventStructuredFields = ({ value, onChange }: Props) => {
  return (
    <div className="grid gap-6 border-t pt-4">
      <Section<Sponsor>
        title="Sponsors"
        items={value.sponsors}
        blank={{ name: "", logo_url: "", url: "" }}
        onChange={(sponsors) => onChange({ ...value, sponsors })}
        render={(s, set) => (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Name" value={s.name} onChange={(e) => set({ name: e.target.value })} />
            <Input placeholder="Logo URL" value={s.logo_url ?? ""} onChange={(e) => set({ logo_url: e.target.value })} />
            <Input placeholder="Website" value={s.url ?? ""} onChange={(e) => set({ url: e.target.value })} />
          </div>
        )}
      />
      <Section<Judge>
        title="Judges"
        items={value.judges}
        blank={{ name: "", role: "", avatar_url: "", bio: "" }}
        onChange={(judges) => onChange({ ...value, judges })}
        render={(j, set) => (
          <div className="grid gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="Name" value={j.name} onChange={(e) => set({ name: e.target.value })} />
              <Input placeholder="Role" value={j.role ?? ""} onChange={(e) => set({ role: e.target.value })} />
              <Input placeholder="Avatar URL" value={j.avatar_url ?? ""} onChange={(e) => set({ avatar_url: e.target.value })} />
            </div>
            <Textarea placeholder="Short bio" rows={2} value={j.bio ?? ""} onChange={(e) => set({ bio: e.target.value })} />
          </div>
        )}
      />
      <Section<Prize>
        title="Prizes"
        items={value.prizes}
        blank={{ place: "", title: "", description: "", value: "" }}
        onChange={(prizes) => onChange({ ...value, prizes })}
        render={(p, set) => (
          <div className="grid gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="Place (1st, 2nd...)" value={p.place} onChange={(e) => set({ place: e.target.value })} />
              <Input placeholder="Title" value={p.title} onChange={(e) => set({ title: e.target.value })} />
              <Input placeholder="Value (e.g. $1,000)" value={p.value ?? ""} onChange={(e) => set({ value: e.target.value })} />
            </div>
            <Textarea placeholder="Description" rows={2} value={p.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
          </div>
        )}
      />
      <Section<ScheduleItem>
        title="Schedule"
        items={value.schedule}
        blank={{ time: "", title: "", description: "" }}
        onChange={(schedule) => onChange({ ...value, schedule })}
        render={(s, set) => (
          <div className="grid gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input placeholder="Time (e.g. Day 1, 09:00)" value={s.time} onChange={(e) => set({ time: e.target.value })} />
              <Input placeholder="Title" value={s.title} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <Textarea placeholder="Description" rows={2} value={s.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
          </div>
        )}
      />
    </div>
  );
};

export default EventStructuredFields;