import * as kv from "../kv_store.ts";

export type SiteNotificationKind =
  | "qr_registration"
  | "site_request"
  | "site_review"
  | "dealer_assignment_conflict"
  | "dealer_country_mismatch"
  | "dealer_assigned";

export async function pushSiteNotification(opts: {
  kind: SiteNotificationKind;
  title: string;
  message: string;
  priority?: "high" | "medium" | "low";
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  dealerId?: string | null;
}) {
  const id = `notification:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const priority = opts.priority || "medium";
  const notification = {
    id,
    type: priority === "high" ? "warning" : "info",
    title: opts.title,
    message: opts.message,
    priority,
    entityType: opts.entityType || null,
    entityId: opts.entityId || null,
    actionUrl: opts.actionUrl || null,
    audience: "admin" as const,
    dealerId: opts.dealerId || null,
    siteKind: opts.kind,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  await kv.set(id, notification);
  return notification;
}
