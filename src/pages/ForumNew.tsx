import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

type Category = { id: string; name: string };

const ForumNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(params.get("category") ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  useEffect(() => {
    supabase
      .from("forum_categories" as any)
      .select("id,name")
      .order("sort_order")
      .then(({ data }) => {
        const list = ((data as any) ?? []) as Category[];
        setCategories(list);
        if (!categoryId && list[0]) setCategoryId(list[0].id);
      });
  }, []);

  const submit = async () => {
    if (!user || !categoryId || title.trim().length < 3 || content.trim().length < 1) {
      toast.error("Pick a category, add a title (3+ chars) and content.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("forum_threads" as any)
      .insert({ category_id: categoryId, user_id: user.id, title: title.trim(), content: content.trim() })
      .select("id")
      .maybeSingle();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Thread posted! +5 points");
    navigate(`/forum/t/${(data as any).id}`);
  };

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4 max-w-2xl">
      <SEO title="Start a new thread" description="Post a new discussion in the TechBridge community forum." noIndex />
      <Link to="/forum" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to forum
      </Link>

      <h1 className="text-2xl font-heading font-bold mb-6">Start a new thread</h1>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Give your thread a clear title" />
          </div>
          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={20000}
              rows={10}
              placeholder="Share details, code snippets, links — markdown not yet rendered, just plain text."
            />
            <p className="text-xs text-muted-foreground text-right">{content.length}/20000</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={submit} disabled={submitting} className="bg-gradient-primary text-primary-foreground">
              {submitting ? "Posting…" : "Post thread"}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/forum")}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default ForumNew;