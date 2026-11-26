import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Calendar, MessageCircle, LayoutDashboard, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Fixed bottom navigation shown on small screens for signed-in users.
 * Hidden on admin routes and when the user is signed out.
 */
const MobileBottomNav = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const active = !!user && !pathname.startsWith("/admin");

  useEffect(() => {
    document.body.classList.toggle("has-bottom-nav", active);
    return () => { document.body.classList.remove("has-bottom-nav"); };
  }, [active]);

  if (!active) return null;

  const items = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/events", icon: Calendar, label: t("nav.events") },
    { to: "/messages", icon: MessageCircle, label: t("nav.messages") },
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/profile", icon: User, label: t("nav.profile") },
  ];

  return (
    <nav
      aria-label="Primary mobile"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t border-border/50 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, icon: Icon, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate max-w-full px-1">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default MobileBottomNav;