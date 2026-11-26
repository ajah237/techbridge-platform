import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, User, LogOut, Shield, LayoutDashboard, Search, MessageCircle, ShieldCheck, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import NotificationBell from "@/components/NotificationBell";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";
import CommandPalette, { useCommandPalette } from "@/components/CommandPalette";
import { useTranslation } from "react-i18next";
import logo from "@/assets/logo.png";

const navItems = [
  { key: "home", path: "/" },
  { key: "events", path: "/events" },
  { key: "programs", path: "/programs" },
  { key: "projects", path: "/projects" },
  { key: "mentors", path: "/mentors" },
  { key: "forum", path: "/forum" },
  { key: "leaderboard", path: "/leaderboard" },
  { key: "blog", path: "/blog" },
  { key: "contact", path: "/contact" },
];

const COMMUNITY = new Set(["projects", "mentors", "forum", "leaderboard"]);

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const { t } = useTranslation();
  const palette = useCommandPalette();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <>
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
      <nav className="fixed top-0 left-0 right-0 z-50 glass" aria-label="Main navigation">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={logo} alt="TechBridge logo" className="h-9 w-9 rounded-lg object-cover" />
            <span className="font-heading font-bold text-xl text-foreground hidden sm:inline">
              TECH<span className="text-gradient">BRIDGE</span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navItems.filter((l) => !COMMUNITY.has(l.key)).slice(0, 3).map((l) => (
              <Link
                key={l.path}
                to={l.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === l.path
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {t(`nav.${l.key}`)}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  navItems.some((l) => COMMUNITY.has(l.key) && location.pathname.startsWith(l.path))
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                Community <ChevronDown size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {navItems.filter((l) => COMMUNITY.has(l.key)).map((l) => (
                  <DropdownMenuItem key={l.path} asChild>
                    <Link to={l.path}>{t(`nav.${l.key}`)}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {navItems.filter((l) => !COMMUNITY.has(l.key)).slice(3).map((l) => (
              <Link
                key={l.path}
                to={l.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === l.path
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {t(`nav.${l.key}`)}
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => palette.setOpen(true)}
              className="gap-2 text-muted-foreground"
              aria-label="Search (Ctrl+K)"
            >
              <Search size={14} /> <span className="text-xs">⌘K</span>
            </Button>
            <LanguageSwitcher />
            <ThemeToggle />
            {user ? (
              <>
                {isAdmin && (
                  <Button asChild variant="ghost" size="sm" className="gap-2">
                    <Link to="/admin">
                      <Shield size={16} /> {t("nav.admin")}
                    </Link>
                  </Button>
                )}
                <Button asChild variant="ghost" size="icon">
                  <Link to="/messages" aria-label="Messages">
                    <MessageCircle size={16} />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/team-portal">My Team</Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="gap-2">
                  <Link to="/dashboard">
                    <LayoutDashboard size={16} /> {t("nav.dashboard")}
                  </Link>
                </Button>
                <NotificationBell />
                <Button asChild variant="ghost" size="sm" className="gap-2">
                  <Link to="/profile">
                    <User size={16} /> {t("nav.profile")}
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="icon">
                  <Link to="/account/security" title="Account security" aria-label="Account security">
                    <ShieldCheck size={16} />
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={handleSignOut} className="gap-2">
                  <LogOut size={16} /> {t("nav.signOut")}
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">{t("nav.signIn")}</Link>
                </Button>
                <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-90">
                  <Link to="/auth">{t("nav.getStarted")}</Link>
                </Button>
              </>
            )}
          </div>

          <div className="lg:hidden flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => palette.setOpen(true)} aria-label="Search">
              <Search size={18} />
            </Button>
            <LanguageSwitcher />
            <ThemeToggle />
            <button
              type="button"
              className="text-foreground p-1"
              onClick={() => setOpen(!open)}
              aria-label="Toggle menu"
              aria-expanded={open}
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden glass border-t border-border/50 animate-fade-in">
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2 max-h-[80vh] overflow-y-auto">
              {navItems.map((l) => (
                <Link
                  key={l.path}
                  to={l.path}
                  onClick={() => setOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === l.path
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`nav.${l.key}`)}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-3 border-t border-border/50 mt-2">
                {user ? (
                  <>
                    {isAdmin && (
                      <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
                        <Link to="/admin" onClick={() => setOpen(false)}>
                          <Shield size={16} /> {t("nav.admin")}
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
                      <Link to="/messages" onClick={() => setOpen(false)}>
                        <MessageCircle size={16} /> {t("nav.messages")}
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
                      <Link to="/dashboard" onClick={() => setOpen(false)}>
                        <LayoutDashboard size={16} /> {t("nav.dashboard")}
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
                      <Link to="/profile" onClick={() => setOpen(false)}>
                        <User size={16} /> {t("nav.profile")}
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
                      <Link to="/account/security" onClick={() => setOpen(false)}>
                        <ShieldCheck size={16} /> Security
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        handleSignOut();
                        setOpen(false);
                      }}
                      className="w-full justify-start gap-2"
                    >
                      <LogOut size={16} /> {t("nav.signOut")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="ghost" size="sm" className="w-full">
                      <Link to="/auth" onClick={() => setOpen(false)}>
                        {t("nav.signIn")}
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="w-full bg-gradient-primary text-primary-foreground">
                      <Link to="/auth" onClick={() => setOpen(false)}>
                        {t("nav.getStarted")}
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
};

export default Navbar;
