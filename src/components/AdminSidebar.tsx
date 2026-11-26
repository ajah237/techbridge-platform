import {
  Handshake,
  LayoutDashboard,
  Calendar,
  FileText,
  Users,
  Award,
  ArrowLeft,
  UserCog,
  BarChart3,
  Lightbulb,
  MessageSquare,
  Mail,
  Settings,
  Activity,
  Search,
  Gavel,
  ScanLine,
  LineChart,
  Image as ImageIcon,
  ShieldAlert,
  ClipboardList,
  Megaphone,
  UsersRound,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const groups: { label: string; items: { title: string; url: string; icon: typeof Calendar }[] }[] = [
  { label: "Overview", items: [
    { title: "Overview", url: "/admin", icon: LayoutDashboard },
    { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  ]},
  { label: "Events", items: [
    { title: "Events", url: "/admin/events", icon: Calendar },
    { title: "Registrations", url: "/admin/registrations", icon: ClipboardList },
    { title: "Announcements", url: "/admin/announcements", icon: Megaphone },
    { title: "Check-In Scanner", url: "/admin/checkin", icon: ScanLine },
    { title: "Event Analytics", url: "/admin/event-analytics", icon: LineChart },
    { title: "Projects", url: "/admin/projects", icon: Lightbulb },
    { title: "Judging", url: "/admin/judging", icon: Gavel },
    { title: "Judge Invitations", url: "/admin/judging/invitations", icon: Gavel },
  ]},
  { label: "People", items: [
    { title: "Participants", url: "/admin/participants", icon: Users },
    { title: "Event People", url: "/admin/event-people", icon: UsersRound },
    { title: "Sponsor Portal", url: "/admin/sponsors", icon: Handshake },
    { title: "User Management", url: "/admin/users", icon: UserCog },
  ]},
  { label: "Certificates", items: [
    { title: "Certificates", url: "/admin/certificates", icon: Award },
    { title: "Template", url: "/admin/certificates/template", icon: Award },
    { title: "Bulk Actions", url: "/admin/certificates/bulk", icon: Award },
    { title: "Audit Log", url: "/admin/certificates/audit", icon: Activity },
  ]},
  { label: "Content", items: [
    { title: "Blog Posts", url: "/admin/blog", icon: FileText },
    { title: "Comments", url: "/admin/comments", icon: MessageSquare },
    { title: "Moderation", url: "/admin/moderation", icon: ShieldAlert },
    { title: "Newsletter", url: "/admin/newsletter", icon: Mail },
  ]},
  { label: "System", items: [
    { title: "Settings", url: "/admin/settings", icon: Settings },
    { title: "Activity Log", url: "/admin/activity", icon: Activity },
    { title: "Auth Audit Log", url: "/admin/auth-audit", icon: Activity },
    { title: "Meta Checker", url: "/admin/meta-checker", icon: Search },
    { title: "OG Preview", url: "/admin/og-preview", icon: ImageIcon },
  ]},
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/admin" || item.url === "/admin/certificates" || item.url === "/admin/judging"}
                        className="hover:bg-muted/50"
                        activeClassName="bg-primary/10 text-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" className="hover:bg-muted/50 text-muted-foreground">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {!collapsed && <span>Back to Site</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
