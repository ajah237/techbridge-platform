import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUpload from "@/components/ImageUpload";
import SEO from "@/components/SEO";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { isHttpUrl } from "@/lib/utils";

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((u) => isHttpUrl(u), "URL must start with http:// or https://")
  .optional()
  .or(z.literal(""));

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(4000),
  repo_url: httpUrlSchema,
  demo_url: httpUrlSchema,
  tech_tags: z.string().max(300),
  event_id: z.string().optional(),
});

const ProjectSubmit = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    repo_url: "",
    demo_url: "",
    tech_tags: "",
    event_id: "none",
    cover_image_url: "",
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    supabase
      .from("events")
      .select("id,title")
      .in("status", ["published", "ongoing", "completed"])
      .order("start_date", { ascending: false })
      .then(({ data }) => setEvents(data ?? []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    const tags = form.tech_tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);

    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      repo_url: parsed.data.repo_url || null,
      demo_url: parsed.data.demo_url || null,
      tech_tags: tags,
      event_id: form.event_id !== "none" ? form.event_id : null,
      cover_image_url: form.cover_image_url || null,
    });

    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Project submitted! It will appear once an admin approves it.");
    navigate("/dashboard");
  };

  return (
    <main className="pt-20">
      <SEO title="Submit a Project" description="Submit your project for the TechBridge showcase." />
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="mb-4 -ml-2">
            <ArrowLeft size={16} /> All projects
          </Button>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold mb-2">Submit your project</h1>
          <p className="text-muted-foreground mb-8">Share what you built. Submissions are reviewed before going public.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} required />
            </div>
            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea id="description" rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={4000} required />
              <p className="text-xs text-muted-foreground mt-1">{form.description.length}/4000</p>
            </div>
            <div>
              <Label>Cover image</Label>
              <ImageUpload
                bucket="event-images"
                folder={`projects/${user?.id ?? "anon"}`}
                value={form.cover_image_url}
                onUpload={(url) => setForm({ ...form, cover_image_url: url })}
                onRemove={() => setForm({ ...form, cover_image_url: "" })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="repo">Repository URL</Label>
                <Input id="repo" type="url" placeholder="https://github.com/…" value={form.repo_url} onChange={(e) => setForm({ ...form, repo_url: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="demo">Live demo URL</Label>
                <Input id="demo" type="url" placeholder="https://…" value={form.demo_url} onChange={(e) => setForm({ ...form, demo_url: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="tech">Tech stack (comma-separated)</Label>
              <Input id="tech" placeholder="React, TypeScript, Postgres" value={form.tech_tags} onChange={(e) => setForm({ ...form, tech_tags: e.target.value })} />
            </div>
            <div>
              <Label>Linked event (optional)</Label>
              <Select value={form.event_id} onValueChange={(v) => setForm({ ...form, event_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin mr-2" size={16} />}
              Submit project
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default ProjectSubmit;