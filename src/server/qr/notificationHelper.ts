import * as kv from "../kv_store.ts";

export type SiteNotificationKind =
  | "qr_registration"
  | "site_request"
  | "site_review"
  | "dealer_assignment_conflict"
  | "dealer_country_mismatch"
  | "dealer_assigned";

type NotificationPayload = {
  kind: SiteNotificationKind;
  title: string;
  message: string;
  priority?: "high" | "medium" | "low";
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  dealerId?: string | null;
};

function buildNotification(
  id: string,
  opts: NotificationPayload,
  audience: "admin" | "dealer",
  actionUrl: string | null,
) {
  const priority = opts.priority || "medium";
  return {
    id,
    type: priority === "high" ? "warning" : "info",
    title: opts.title,
    message: opts.message,
    priority,
    entityType: opts.entityType || null,
    entityId: opts.entityId || null,
    actionUrl,
    audience,
    dealerId: opts.dealerId || null,
    siteKind: opts.kind,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
}

export async function pushSiteNotification(opts: NotificationPayload) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const adminId = `notification:${suffix}`;
  const adminNotif = buildNotification(adminId, opts, "admin", opts.actionUrl || null);
  await kv.set(adminId, adminNotif);

  if (opts.dealerId) {
    const dealerAction =
      opts.kind === "site_request"
        ? "/dealer/requests"
        : opts.kind === "site_review"
          ? "/dealer/reviews"
          : opts.entityId
            ? `/dealer/customers/${opts.entityId}`
            : "/dealer";
    const dealerId = `notification:dealer:${opts.dealerId}:${suffix}`;
    const dealerNotif = buildNotification(dealerId, opts, "dealer", dealerAction);
    await kv.set(dealerId, dealerNotif);
    return { admin: adminNotif, dealer: dealerNotif };
  }

  return { admin: adminNotif };
}

export async function listDealerNotifications(dealerCompanyId: string, limit = 50) {
  const all = await kv.getByPrefix("notification:");
  return (all || [])
    .filter((n) => n && n.audience === "dealer" && n.dealerId === dealerCompanyId)
    .sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())
    .slice(0, limit);
}
