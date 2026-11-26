import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';

const DEFAULT_PROJECT_ID = "rmtusfikecejennwrkxr";
const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const rawKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

const isPlaceholderUrl = (value: string) =>
  !value ||
  value.includes("your-project-ref") ||
  value.includes("your-supabase-project-ref") ||
  value.includes("<");

const isPlaceholderKey = (value: string) =>
  !value ||
  value.includes("your-anon-public-key") ||
  value.includes("your-supabase-anon-public-key") ||
  value.includes("PASTE_YOUR_ANON_KEY_HERE") ||
  value.endsWith(".placeholder");

const isValidHttpUrl = (value: string) => {
  if (isPlaceholderUrl(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

export const SUPABASE_URL = isValidHttpUrl(rawUrl)
  ? rawUrl
  : `https://${
      !isPlaceholderUrl(import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "")
        ? import.meta.env.VITE_SUPABASE_PROJECT_ID
        : DEFAULT_PROJECT_ID
    }.supabase.co`;

export const isSupabaseConfigured = isValidHttpUrl(rawUrl) && !isPlaceholderKey(rawKey);

const SUPABASE_PUBLISHABLE_KEY = !isPlaceholderKey(rawKey)
  ? rawKey
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

if (!isSupabaseConfigured) {
  console.warn(
    "[TechBridge] Supabase is not fully configured in .env (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). " +
    "The UI will render, but Sign Up / Sign In and live database queries require a valid Supabase URL and anon key in .env."
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});