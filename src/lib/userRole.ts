export function getUserRole(session: { user?: { user_metadata?: Record<string, unknown> } } | null): string {
  const role = session?.user?.user_metadata?.role;
  return typeof role === "string" ? role : "";
}

export function getUserCompanyId(session: { user?: { user_metadata?: Record<string, unknown> } } | null): string | null {
  const id = session?.user?.user_metadata?.company_id;
  return typeof id === "string" && id ? id : null;
}

export function isDealerSession(session: { user?: { user_metadata?: Record<string, unknown> } } | null): boolean {
  return getUserRole(session) === "dealer" && Boolean(getUserCompanyId(session));
}

export function isAdminSession(session: { user?: { user_metadata?: Record<string, unknown> } } | null): boolean {
  const role = getUserRole(session).toLowerCase();
  return ["owner", "director", "admin", "manager"].includes(role);
}

export function loginRedirectPath(session: { user?: { user_metadata?: Record<string, unknown> } } | null): string {
  return isDealerSession(session) ? "/dealer" : "/";
}
