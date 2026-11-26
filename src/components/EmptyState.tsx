import { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

const EmptyState = ({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) => (
  <div
    role="status"
    className={cn(
      "flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border border-dashed border-border bg-muted/30",
      className,
    )}
  >
    <div className="mb-4 h-14 w-14 rounded-full bg-gradient-primary/10 flex items-center justify-center text-primary">
      <Icon className="h-7 w-7" />
    </div>
    <h3 className="font-heading font-semibold text-lg text-foreground">{title}</h3>
    {description && <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;