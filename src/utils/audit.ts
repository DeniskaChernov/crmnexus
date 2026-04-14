import { crm } from "@/lib/crmClient.ts";
import { crmUrl, authHeaders } from '../lib/crmApi.ts';
interface AuditLogEntry {
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
}

export const logAction = async (entry: AuditLogEntry) => {
  try {
    let { userId, userEmail, userName } = entry;

    // If user info is missing, try to get it from the session
    if (!userId || !userEmail) {
      const { data: { session } } = await crm.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
        userEmail = session.user.email;
        userName = session.user.user_metadata?.name || session.user.email;
      }
    }

    const response = await fetch(
      `${crmUrl('/audit-log')}`,
      {
        method: 'POST',
        headers: { ...authHeaders() },
        body: JSON.stringify({
          ...entry,
          userId,
          userEmail,
          userName,
        }),
      }
    );

    if (!response.ok) {
      console.error('Failed to log action:', await response.text());
    }
  } catch (error) {
    console.error('Error logging action:', error);
  }
};

export const fetchAuditLogs = async () => {
  try {
    const response = await fetch(`${crmUrl("/audit-log")}`, {
      headers: { ...authHeaders(false) },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch audit logs');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};
