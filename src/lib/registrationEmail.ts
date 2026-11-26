import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

/** Emails the team leader the current status of their registration. Never blocks the UI on failure. */
export async function sendRegistrationEmail(registrationId: string): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("send-notification", {
      body: {
        type: "team_registration",
        data: {
          registrationId,
          origin: typeof window !== "undefined" ? window.location.origin : "https://techbridgehub.lovable.app",
        },
      },
    });
    if (error) {
      const details =
        error instanceof FunctionsHttpError
          ? await error.context.text().catch(() => error.message)
          : error.message;
      console.error("Registration email failed:", details);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Registration email exception:", err);
    return false;
  }
}
