import { crm } from "@/lib/crmClient.ts";
import { crmUrl, authHeaders } from '../../lib/crmApi.ts';
export interface TimelineEvent {
  id: string;
  type: 'status_change' | 'stage_change' | 'note' | 'update' | 'create' | 'email' | 'call';
  message: string;
  userId: string;
  userName: string;
  createdAt: string;
  metadata?: any;
}

export const getTimeline = async (dealId: string): Promise<TimelineEvent[]> => {
    try {
        const response = await fetch(
            `${crmUrl(`/timeline/${dealId}`)}`,
            {
                headers: { ...authHeaders(false) }
            }
        );
        
        if (!response.ok) return [];
        return await response.json();
    } catch (e) {
        console.error("Timeline fetch error", e);
        return [];
    }
};

export const addTimelineEvent = async (dealId: string, event: Omit<TimelineEvent, 'id' | 'createdAt' | 'userId' | 'userName'>) => {
    try {
        // 1. Get User
        const { data: { session } } = await crm.auth.getSession();
        const user = session?.user;
        const userName = user?.user_metadata?.name || user?.email || 'Unknown';
        const userId = user?.id || 'anon';

        // 2. Prepare event
        const newEvent: TimelineEvent = {
            id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            ...event,
            userId,
            userName,
            createdAt: new Date().toISOString()
        };

        // 3. Send to Server
        await fetch(
            `${crmUrl('/timeline')}`,
            {
                method: 'POST',
                headers: { ...authHeaders() },
                body: JSON.stringify({
                    dealId,
                    event: newEvent
                })
            }
        );

    } catch (e) {
        console.error("Timeline error", e);
    }
};