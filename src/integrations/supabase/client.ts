import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { brokeredPreviewStorage } from './previewAuthStorage';
import { resilientSupabaseFetch } from './localBackend';

const DEFAULT_PROJECT_ID = "rmtusfikecejennwrkxr";
const DEFAULT_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtdHVzZmlrZWNlamVubndya3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDI4MjcsImV4cCI6MjA5MDMxODgyN30.MsOFzqEyrZkcSVf4_qjaIV0mnDuWbpxZuEThPcLwyB0";

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

export const SUPABASE_PUBLISHABLE_KEY = !isPlaceholderKey(rawKey)
  ? rawKey
  : DEFAULT_PUBLISHABLE_KEY;

export const isSupabaseConfigured = true;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: resilientSupabaseFetch,
  },
});
