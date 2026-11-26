import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/auditLog";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Shield, ShieldOff, Eye, Users, UserCheck, ShieldCheck, UserCog } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type UserRole = Tables<"user_roles">;

interface UserWithRole extends Profile {
  roles: UserRole[];
  registrationCount: number;
  certificateCount: number;
}

const AdminUsers = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<"admin" | "moderator" | "user">("moderator");
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);

    const [profilesRes, rolesRes, regsRes, certsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("event_registrations").select("user_id"),
      supabase.from("certificates").select("user_id"),
    ]);

    if (profilesRes.error) { toast.error(profilesRes.error.message); setLoading(false); return; }

    const roles = rolesRes.data ?? [];
    const regs = regsRes.data ?? [];
    const certs = certsRes.data ?? [];

    const roleMap = new Map<string, UserRole[]>();
    roles.forEach((r) => {
      const arr = roleMap.get(r.user_id) || [];
      arr.push(r);
      roleMap.set(r.user_id, arr);
    });

    const regCount = new Map<string, number>();
    regs.forEach((r) => regCount.set(r.user_id, (regCount.get(r.user_id) || 0) + 1));

    const certCount = new Map<string, number>();
    certs.forEach((c) => certCount.set(c.user_id, (certCount.get(c.user_id) || 0) + 1));

    const enriched: UserWithRole[] = (profilesRes.data ?? []).map((p) => ({
      ...p,
      roles: roleMap.get(p.user_id) || [],
      registrationCount: regCount.get(p.user_id) || 0,
      certificateCount: certCount.get(p.user_id) || 0,
    }));

    setUsers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleOne = (uid: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
  };
  const toggleAllVisible = (visible: UserWithRole[]) => {
    setSelected((prev) => {
      const all = visible.every((u) => prev.has(u.user_id));
      const n = new Set(prev);
      visible.forEach((u) => (all ? n.delete(u.user_id) : n.add(u.user_id)));
      return n;
    });
  };

  const bulkAssignRole = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Assign "${bulkRole}" role to ${selected.size} user(s)?`)) return;
    setBulkBusy(true);
    const rows = Array.from(selected).map((uid) => ({ user_id: uid, role: bulkRole }));
    const { error } = await supabase.from("user_roles").upsert(rows, { onConflict: "user_id,role", ignoreDuplicates: true });
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    await logAdminAction("role.bulk_assigned", "user", null, null, {
      role: bulkRole,
      count: rows.length,
      user_ids: rows.map((r) => r.user_id),
    });
    toast.success(`Assigned "${bulkRole}" to ${rows.length} user(s)`);
    setSelected(new Set());
    fetchUsers();
  };

  const bulkRemoveRole = async () => {
    if (selected.size === 0) return;
    if (bulkRole === "admin" && currentUser && selected.has(currentUser.id)) {
      toast.error("You cannot remove your own admin role.");
      return;
    }
    if (!confirm(`Remove "${bulkRole}" role from ${selected.size} user(s)? This action is logged.`)) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .in("user_id", ids)
      .eq("role", bulkRole);
    setBulkBusy(false);
    if (error) return toast.error(error.message);
    await logAdminAction("role.bulk_removed", "user", null, null, {
      role: bulkRole,
      count: ids.length,
      user_ids: ids,
    });
    toast.success(`Removed "${bulkRole}" role`);
    setSelected(new Set());
    fetchUsers();
  };

  const handleAssignRole = async (userId: string, role: "admin" | "moderator" | "user") => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      if (error.message.includes("duplicate")) toast.error("User already has this role");
      else toast.error(error.message);
    } else {
      const target = users.find((u) => u.user_id === userId);
      await logAdminAction("role.assigned", "user", userId, target?.full_name || target?.email || null, { role });
      toast.success(`Role "${role}" assigned successfully`);
      fetchUsers();
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    const target = users.find((u) => u.roles?.some((r: any) => r.id === roleId));
    const removed = target?.roles?.find((r: any) => r.id === roleId);
    if (removed?.role === "admin" && target?.user_id === currentUser?.id) {
      toast.error("You cannot remove your own admin role.");
      return;
    }
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) toast.error(error.message);
    else {
      await logAdminAction("role.removed", "user", target?.user_id ?? null, target?.full_name || target?.email || null, { role: removed?.role });
      toast.success("Role removed");
      fetchUsers();
    }
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.university?.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "no-role" && u.roles.length === 0) ||
      u.roles.some((r) => r.role === roleFilter);

    return matchesSearch && matchesRole;
  });

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.roles.some((r) => r.role === "admin")).length;
  const activeUsers = users.filter((u) => u.registrationCount > 0).length;

  const activeSelectedUser = selectedUser
    ? users.find((u) => u.id === selectedUser.id) ?? selectedUser
    : null;

  const openDetail = (user: UserWithRole) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

  const initials = (name: string | null) =>
    name ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-heading font-bold">User Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Users", value: totalUsers, icon: Users, color: "text-primary" },
          { label: "Active Users", value: activeUsers, icon: UserCheck, color: "text-[hsl(150,60%,40%)]" },
          { label: "Admins", value: adminCount, icon: ShieldCheck, color: "text-[hsl(280,60%,50%)]" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                <s.icon size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selected.size > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <Select value={bulkRole} onValueChange={(v) => setBulkRole(v as any)}>
              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="moderator">moderator</SelectItem>
                <SelectItem value="user">user</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" disabled={bulkBusy} onClick={bulkAssignRole} className="gap-1">
              <Shield size={14} /> Assign role
            </Button>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={bulkRemoveRole} className="gap-1">
              <ShieldOff size={14} /> Remove role
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or university..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="moderator">Moderators</SelectItem>
            <SelectItem value="user">Users (role)</SelectItem>
            <SelectItem value="no-role">No Role</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No users found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every((u) => selected.has(u.user_id))}
                        onCheckedChange={() => toggleAllVisible(filtered)}
                      />
                    </TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden sm:table-cell">University</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="hidden sm:table-cell text-center">Events</TableHead>
                    <TableHead className="hidden sm:table-cell text-center">Certs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="w-8">
                        <Checkbox
                          checked={selected.has(user.user_id)}
                          onCheckedChange={() => toggleOne(user.user_id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {initials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{user.full_name || "No name"}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {user.university || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles.length === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                          ) : (
                            user.roles.map((r) => (
                              <Badge
                                key={r.id}
                                variant={r.role === "admin" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {r.role}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-center text-sm">
                        {user.registrationCount}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-center text-sm">
                        {user.certificateCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              to={`/admin/impersonate/${user.user_id}`}
                              title="View as user"
                              aria-label={`Inspect ${user.full_name || user.email || "user"}`}
                            >
                              <UserCog size={14} />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetail(user)}
                            aria-label={`Manage ${user.full_name || user.email || "user"}`}
                          >
                            <Eye size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={activeSelectedUser?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {initials(activeSelectedUser?.full_name || null)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p>{activeSelectedUser?.full_name || "No name"}</p>
                <p className="text-sm font-normal text-muted-foreground">{activeSelectedUser?.email}</p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {activeSelectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">University</p>
                  <p className="font-medium">{activeSelectedUser.university || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Joined</p>
                  <p className="font-medium">
                    {new Date(activeSelectedUser.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Events Registered</p>
                  <p className="font-medium">{activeSelectedUser.registrationCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Certificates</p>
                  <p className="font-medium">{activeSelectedUser.certificateCount}</p>
                </div>
              </div>

              {activeSelectedUser.skills && activeSelectedUser.skills.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {activeSelectedUser.skills.map((s) => (
                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {activeSelectedUser.bio && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Bio</p>
                  <p className="text-sm">{activeSelectedUser.bio}</p>
                </div>
              )}

              {/* Role Management */}
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium mb-3">Manage Roles</p>
                <div className="space-y-2">
                  {activeSelectedUser.roles.length > 0 && (
                    <div className="space-y-2">
                      {activeSelectedUser.roles.map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Shield size={14} className="text-primary" />
                            <span className="text-sm font-medium capitalize">{r.role}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={r.role === "admin" && activeSelectedUser.user_id === currentUser?.id}
                            className="text-destructive hover:text-destructive h-7 text-xs"
                            onClick={() => handleRemoveRole(r.id)}
                          >
                            <ShieldOff size={12} className="mr-1" /> Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    {(["admin", "moderator", "user"] as const)
                      .filter((role) => !activeSelectedUser.roles.some((r) => r.role === role))
                      .map((role) => (
                        <Button
                          key={role}
                          variant="outline"
                          size="sm"
                          className="text-xs capitalize"
                          onClick={() => handleAssignRole(activeSelectedUser.user_id, role)}
                        >
                          <Shield size={12} className="mr-1" /> Add {role}
                        </Button>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
