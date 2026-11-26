import { useEffect, useState, forwardRef } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const NotificationBell = forwardRef<HTMLAnchorElement>((_, ref) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return;
    }

    const fetchCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      setUnread(count ?? 0);
    };
    fetchCount();

    const channel = supabase
      .channel(`notif-bell:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          fetchCount();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!user) return null;

  return (
    <Button asChild variant="ghost" size="sm" className="relative gap-1">
      <Link to="/dashboard" ref={ref} aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}>
        <Bell size={16} aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
});

NotificationBell.displayName = "NotificationBell";

export default NotificationBell;
