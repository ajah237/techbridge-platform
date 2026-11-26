import { useEffect, useState } from "react";
import SEO from "@/components/SEO";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BecomeMentor = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState("");
  const [availability, setAvailability] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("mentor_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBio(data.bio || "");
          setExpertise((data.expertise || []).join(", "));
          setAvailability(data.availability || "");
          setIsActive(Boolean(data.is_active));
        }
      });
  }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const payload = {
      user_id: user.id,
      bio: bio.trim(),
      expertise: expertise
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      availability: availability.trim(),
      is_active: isActive,
    };
    const { error } = await supabase.from("mentor_profiles").upsert(payload, { onConflict: "user_id" });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        isActive
          ? "Your mentor profile has been updated!"
          : "Mentor profile submitted! It will appear publicly once approved by an admin.",
      );
      navigate("/mentors");
    }
  };

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4 max-w-2xl">
      <SEO title="Become a mentor" noIndex />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-heading font-bold">Become a mentor</h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/mentors/availability">Manage availability</Link>
        </Button>
      </div>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="mentor-bio" className="text-sm font-medium">
                Short bio
              </label>
              <textarea
                id="mentor-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                required
                className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="mentor-expertise" className="text-sm font-medium">
                Expertise (comma-separated)
              </label>
              <input
                id="mentor-expertise"
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
                placeholder="React, Python, Product"
                className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="mentor-availability" className="text-sm font-medium">
                Availability
              </label>
              <input
                id="mentor-availability"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="Weekends, 2 hours/week"
                className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm"
              />
            </div>
            <Button type="submit" disabled={loading} className="bg-gradient-primary text-primary-foreground">
              {loading ? "Saving…" : "Save mentor profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default BecomeMentor;
