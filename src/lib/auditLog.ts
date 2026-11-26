import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { isUuid } from "@/lib/utils";

export type AuditResource =
  | "user"
  | "event"
  | "blog"
  | "project"
  | "comment"
  | "newsletter"
  | "mentor"
  | "certificate"
  | "content_report"
  | "registration"
  | "settings";

/**
 * Record an admin action in the site-wide audit log.
 * Fails silently (logged to console) so UI flows are never blocked.
 */
export async function logAdminAction(
  action: string,
  resourceType: AuditResource,
  resourceId?: string | null,
  resourceLabel?: string | null,
  metadata: Record<string, unknown> = {},
) {
  try {
    const validUuid = isUuid(resourceId) ? resourceId : undefined;
    const { error } = await supabase.rpc("log_admin_action", {
      _action: action,
      _resource_type: resourceType,
      _resource_id: validUuid,
      _resource_label: resourceLabel ?? (resourceId && !validUuid ? resourceId : undefined),
      _metadata: metadata as Json,
    });
    if (error) console.warn("[audit] failed to log", action, error.message);
  } catch (e) {
    console.warn("[audit] exception", e);
  }
}
