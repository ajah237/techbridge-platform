import { useState, useEffect } from "react";
import SEO from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Save, LogOut, Github, Linkedin, Globe, GraduationCap, X, Plus, Camera, Download, Trash2, ShieldAlert } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import type { Tables } from "@/integrations/supabase/types";
import { safeHref } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/account-export`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error || "Export failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `techbridge-data-${user?.id ?? "me"}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
      toast.success("Your data has been downloaded.");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally { setExporting(false); }
  };

  const handleDelete = async () => {
    if (confirmText !== "DELETE") { toast.error("Type DELETE to confirm"); return; }
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("account-delete", {
        body: { confirm: "DELETE" },
      });
      if (error) throw error;
      toast.success("Account deleted. Goodbye.");
      await supabase.auth.signOut();
      navigate("/");
    } catch (e: any) {
      toast.error(e.message || "Deletion failed");
    } finally { setDeleting(false); }
  };

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (data) setProfile(data);
      setLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user || !profile) return;
    if (profile.portfolio_url?.trim() && !safeHref(profile.portfolio_url)) {
      toast.error("Portfolio URL must start with http:// or https://");
      return;
    }
    if (profile.github_url?.trim() && !safeHref(profile.github_url)) {
      toast.error("GitHub URL must start with http:// or https://");
      return;
    }
    if (profile.linkedin_url?.trim() && !safeHref(profile.linkedin_url)) {
      toast.error("LinkedIn URL must start with http:// or https://");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        bio: profile.bio,
        skills: profile.skills,
        university: profile.university,
        portfolio_url: safeHref(profile.portfolio_url) ?? null,
        github_url: safeHref(profile.github_url) ?? null,
        linkedin_url: safeHref(profile.linkedin_url) ?? null,
        avatar_url: profile.avatar_url,
      })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated!");
    }
    setSaving(false);
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || !profile) return;
    if (profile.skills?.includes(trimmed)) return;
    setProfile({ ...profile, skills: [...(profile.skills || []), trimmed] });
    setSkillInput("");
  };

  const removeSkill = (skill: string) => {
    if (!profile) return;
    setProfile({ ...profile, skills: (profile.skills || []).filter((s) => s !== skill) });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <main className="pt-24 min-h-dvh flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  return (
    <main className="pt-20">
      <SEO title="Profile" noIndex />
      <section className="py-12 bg-gradient-hero dark">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="h-16 w-16 rounded-full object-cover border-2 border-primary/30" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-heading font-bold text-2xl">
                    {profile?.full_name
                      ? profile.full_name.split(" ").map((n) => n[0]).join("").toUpperCase()
                      : user?.email?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">
                  {profile?.full_name || "Your Profile"}
                </h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut} className="gap-2 border-border text-foreground hover:bg-muted">
              <LogOut size={16} /> Sign Out
            </Button>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4 max-w-2xl space-y-6">
          {/* Avatar */}
          <Card className="shadow-card border-border/50 bg-card">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-heading font-semibold text-card-foreground">Profile Photo</h2>
              <ImageUpload
                bucket="avatars"
                folder={user?.id || ""}
                value={profile?.avatar_url}
                onUpload={(url) => setProfile(profile ? { ...profile, avatar_url: url } : null)}
                onRemove={() => setProfile(profile ? { ...profile, avatar_url: null } : null)}
              />
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card className="shadow-card border-border/50 bg-card">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-heading font-semibold text-card-foreground">Basic Information</h2>
              <div>
                <label htmlFor="profile-full-name" className="text-sm text-muted-foreground mb-1 block">Full Name</label>
                <input
                  id="profile-full-name"
                  value={profile?.full_name || ""}
                  onChange={(e) => setProfile(profile ? { ...profile, full_name: e.target.value } : null)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
              <div>
                <label htmlFor="profile-bio" className="text-sm text-muted-foreground mb-1 block">Bio</label>
                <textarea
                  id="profile-bio"
                  rows={3}
                  value={profile?.bio || ""}
                  onChange={(e) => setProfile(profile ? { ...profile, bio: e.target.value } : null)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
                  placeholder="Tell us about yourself..."
                />
              </div>
              <div>
                <label htmlFor="profile-university" className="text-sm text-muted-foreground mb-1 block">
                  <GraduationCap size={14} className="inline mr-1" /> University
                </label>
                <input
                  id="profile-university"
                  value={profile?.university || ""}
                  onChange={(e) => setProfile(profile ? { ...profile, university: e.target.value } : null)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="Your university or institution"
                />
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card className="shadow-card border-border/50 bg-card">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-heading font-semibold text-card-foreground">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {(profile?.skills || []).map((skill) => (
                  <span key={skill} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} className="hover:text-destructive" aria-label={`Remove skill ${skill}`}><X size={12} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  placeholder="Add a skill..."
                  aria-label="Add a skill"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  className="flex-1 px-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
                <Button type="button" size="sm" variant="outline" onClick={addSkill} className="gap-1">
                  <Plus size={14} /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Links */}
          <Card className="shadow-card border-border/50 bg-card">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-heading font-semibold text-card-foreground">Links &amp; Portfolio</h2>
              <div>
                <label htmlFor="profile-portfolio" className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Globe size={14} /> Portfolio URL
                </label>
                <input
                  id="profile-portfolio"
                  value={profile?.portfolio_url || ""}
                  onChange={(e) => setProfile(profile ? { ...profile, portfolio_url: e.target.value } : null)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="https://yourportfolio.com"
                />
              </div>
              <div>
                <label htmlFor="profile-github" className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Github size={14} /> GitHub Profile
                </label>
                <input
                  id="profile-github"
                  value={profile?.github_url || ""}
                  onChange={(e) => setProfile(profile ? { ...profile, github_url: e.target.value } : null)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="https://github.com/username"
                />
              </div>
              <div>
                <label htmlFor="profile-linkedin" className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Linkedin size={14} /> LinkedIn Profile
                </label>
                <input
                  id="profile-linkedin"
                  value={profile?.linkedin_url || ""}
                  onChange={(e) => setProfile(profile ? { ...profile, linkedin_url: e.target.value } : null)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 gap-2"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Profile"}
          </Button>

          {/* Privacy & data rights (GDPR/CCPA) */}
          <Card className="shadow-card border-border/50 bg-card">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-heading font-semibold text-card-foreground flex items-center gap-2">
                <ShieldAlert size={18} className="text-primary" /> Privacy & data rights
              </h2>
              <p className="text-sm text-muted-foreground">
                Under GDPR and similar laws, you can download a copy of your data or delete your account at any time.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2">
                  <Download size={16} /> {exporting ? "Preparing…" : "Export my data (JSON)"}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 size={16} /> Delete my account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes your profile, registrations, projects, certificates,
                        messages, badges, and login. This cannot be undone. Type
                        <span className="font-mono font-semibold mx-1">DELETE</span>
                        to confirm.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type DELETE"
                      aria-label="Type DELETE to confirm account deletion"
                      className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setConfirmText("")}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={deleting || confirmText !== "DELETE"}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? "Deleting…" : "Delete forever"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
};

export default Profile;
