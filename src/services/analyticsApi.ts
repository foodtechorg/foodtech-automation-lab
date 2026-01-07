import { supabase } from "@/integrations/supabase/client";

export interface UserActivityStats {
  userId: string;
  email: string;
  name: string;
  role: string;
  rdEventsCount: number;
  purchaseRequestsCount: number;
  purchaseInvoicesCount: number;
  lastActivityAt: string | null;
}

export interface ActivityTimelinePoint {
  date: string;
  rdEvents: number;
  purchaseEvents: number;
  total: number;
}

export interface ActivitySummary {
  activeUsersCount: number;
  totalUsersCount: number;
  totalEventsCount: number;
  mostActiveUser: { name: string; eventsCount: number } | null;
}

export async function getUserActivityStats(days: number = 30): Promise<UserActivityStats[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceDateStr = sinceDate.toISOString();

  // Fetch all profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, name, role');

  if (profilesError) throw profilesError;

  // Fetch R&D events count per user
  const { data: rdEvents, error: rdError } = await supabase
    .from('request_events')
    .select('actor_email, created_at')
    .gte('created_at', sinceDateStr);

  if (rdError) throw rdError;

  // Fetch purchase requests per user
  const { data: purchaseRequests, error: prError } = await supabase
    .from('purchase_requests')
    .select('created_by, created_at')
    .gte('created_at', sinceDateStr);

  if (prError) throw prError;

  // Fetch purchase invoices per user
  const { data: purchaseInvoices, error: piError } = await supabase
    .from('purchase_invoices')
    .select('created_by, created_at')
    .gte('created_at', sinceDateStr);

  if (piError) throw piError;

  // Fetch purchase logs per user
  const { data: purchaseLogs, error: plError } = await supabase
    .from('purchase_logs')
    .select('user_id, user_email, created_at')
    .gte('created_at', sinceDateStr);

  if (plError) throw plError;

  // Build stats per user
  const statsMap = new Map<string, UserActivityStats>();

  profiles?.forEach((profile) => {
    statsMap.set(profile.id, {
      userId: profile.id,
      email: profile.email,
      name: profile.name || profile.email,
      role: profile.role,
      rdEventsCount: 0,
      purchaseRequestsCount: 0,
      purchaseInvoicesCount: 0,
      lastActivityAt: null,
    });
  });

  // Count R&D events by email
  rdEvents?.forEach((event) => {
    const profile = profiles?.find((p) => p.email === event.actor_email);
    if (profile && statsMap.has(profile.id)) {
      const stats = statsMap.get(profile.id)!;
      stats.rdEventsCount++;
      if (!stats.lastActivityAt || event.created_at > stats.lastActivityAt) {
        stats.lastActivityAt = event.created_at;
      }
    }
  });

  // Count purchase requests
  purchaseRequests?.forEach((pr) => {
    if (statsMap.has(pr.created_by)) {
      const stats = statsMap.get(pr.created_by)!;
      stats.purchaseRequestsCount++;
      if (!stats.lastActivityAt || pr.created_at > stats.lastActivityAt) {
        stats.lastActivityAt = pr.created_at;
      }
    }
  });

  // Count purchase invoices
  purchaseInvoices?.forEach((pi) => {
    if (statsMap.has(pi.created_by)) {
      const stats = statsMap.get(pi.created_by)!;
      stats.purchaseInvoicesCount++;
      if (!stats.lastActivityAt || pi.created_at > stats.lastActivityAt) {
        stats.lastActivityAt = pi.created_at;
      }
    }
  });

  // Also consider purchase logs for last activity
  purchaseLogs?.forEach((log) => {
    if (statsMap.has(log.user_id)) {
      const stats = statsMap.get(log.user_id)!;
      if (!stats.lastActivityAt || log.created_at > stats.lastActivityAt) {
        stats.lastActivityAt = log.created_at;
      }
    }
  });

  return Array.from(statsMap.values()).sort((a, b) => {
    const totalA = a.rdEventsCount + a.purchaseRequestsCount + a.purchaseInvoicesCount;
    const totalB = b.rdEventsCount + b.purchaseRequestsCount + b.purchaseInvoicesCount;
    return totalB - totalA;
  });
}

export async function getActivityTimeline(days: number = 30): Promise<ActivityTimelinePoint[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceDateStr = sinceDate.toISOString();

  // Fetch R&D events
  const { data: rdEvents, error: rdError } = await supabase
    .from('request_events')
    .select('created_at')
    .gte('created_at', sinceDateStr);

  if (rdError) throw rdError;

  // Fetch purchase logs
  const { data: purchaseLogs, error: plError } = await supabase
    .from('purchase_logs')
    .select('created_at')
    .gte('created_at', sinceDateStr);

  if (plError) throw plError;

  // Group by date
  const dateMap = new Map<string, { rdEvents: number; purchaseEvents: number }>();

  // Initialize all dates in range
  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dateMap.set(dateStr, { rdEvents: 0, purchaseEvents: 0 });
  }

  rdEvents?.forEach((event) => {
    const dateStr = event.created_at.split('T')[0];
    if (dateMap.has(dateStr)) {
      dateMap.get(dateStr)!.rdEvents++;
    }
  });

  purchaseLogs?.forEach((log) => {
    const dateStr = log.created_at.split('T')[0];
    if (dateMap.has(dateStr)) {
      dateMap.get(dateStr)!.purchaseEvents++;
    }
  });

  return Array.from(dateMap.entries())
    .map(([date, counts]) => ({
      date,
      rdEvents: counts.rdEvents,
      purchaseEvents: counts.purchaseEvents,
      total: counts.rdEvents + counts.purchaseEvents,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getActivitySummary(days: number = 30): Promise<ActivitySummary> {
  const stats = await getUserActivityStats(days);
  
  const activeUsers = stats.filter(
    (s) => s.rdEventsCount > 0 || s.purchaseRequestsCount > 0 || s.purchaseInvoicesCount > 0
  );

  const totalEvents = stats.reduce(
    (sum, s) => sum + s.rdEventsCount + s.purchaseRequestsCount + s.purchaseInvoicesCount,
    0
  );

  let mostActiveUser: { name: string; eventsCount: number } | null = null;
  if (stats.length > 0) {
    const top = stats[0];
    const topCount = top.rdEventsCount + top.purchaseRequestsCount + top.purchaseInvoicesCount;
    if (topCount > 0) {
      mostActiveUser = { name: top.name, eventsCount: topCount };
    }
  }

  return {
    activeUsersCount: activeUsers.length,
    totalUsersCount: stats.length,
    totalEventsCount: totalEvents,
    mostActiveUser,
  };
}
