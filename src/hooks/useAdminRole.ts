import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export const useAdminRole = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const checkAdmin = async () => {
      if (!userId) {
        if (active) {
          setIsAdmin(false);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!active) return;

      if (error || !data) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(data.some(({ role }) => role === "admin"));
      setLoading(false);
    };

    checkAdmin();

    return () => {
      active = false;
    };
  }, [userId]);

  return { isAdmin, loading };
};
