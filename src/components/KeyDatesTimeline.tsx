import { CheckCircle2, Circle } from "lucide-react";
import { fmtDateTime, type Milestone } from "@/lib/eventTimeline";

const KeyDatesTimeline = ({ items }: { items: Milestone[] }) => {
  const now = Date.now();
  const nextIdx = items.findIndex((m) => new Date(m.at).getTime() > now);
  if (!items.length) return <p className="text-sm text-muted-foreground">Dates will be announced soon.</p>;
  return (
    <ol className="space-y-3" aria-label="Key dates">
      {items.map((m, i) => {
        const past = new Date(m.at).getTime() <= now;
        const next = i === nextIdx;
        return (
          <li key={m.key} className={`flex gap-3 rounded-lg p-2 ${next ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}>
            {past ? <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" /> : <Circle size={18} className={`shrink-0 mt-0.5 ${next ? "text-primary" : "text-muted-foreground"}`} />}
            <div className="min-w-0">
              <p className={`text-sm font-medium ${past ? "text-muted-foreground" : "text-foreground"}`}>
                {m.label} {next && <span className="ml-1 text-xs font-semibold text-primary">Next</span>}
              </p>
              <p className="text-xs text-muted-foreground">{fmtDateTime(m.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default KeyDatesTimeline;
