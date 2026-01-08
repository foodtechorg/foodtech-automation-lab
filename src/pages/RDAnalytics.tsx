import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { RDNavTabs } from '@/components/rd/RDNavTabs';
import { translations } from '@/lib/i18n';

const statusColors = {
  pending: 'hsl(var(--muted-foreground))',
  inProgress: 'hsl(217, 91%, 60%)',
  testing: 'hsl(38, 92%, 50%)',
  approved: 'hsl(142, 76%, 36%)',
  rejected: 'hsl(0, 84%, 60%)'
};

const chartConfig = {
  pending: { label: translations.rdAnalytics.statuses.pending, color: statusColors.pending },
  inProgress: { label: translations.rdAnalytics.statuses.inProgress, color: statusColors.inProgress },
  testing: { label: translations.rdAnalytics.statuses.testing, color: statusColors.testing },
  approved: { label: translations.rdAnalytics.statuses.approved, color: statusColors.approved },
  rejected: { label: translations.rdAnalytics.statuses.rejected, color: statusColors.rejected },
};

type StatusCount = {
  pending: number;
  inProgress: number;
  testing: number;
  approved: number;
  rejected: number;
};

export default function RDAnalytics() {
  const cutoffDate = subDays(new Date(), 90).toISOString();

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['rd-analytics-requests', cutoffDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('author_email, responsible_email, status, created_at')
        .gte('created_at', cutoffDate);
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('email, name');
      if (error) throw error;
      return data;
    },
  });

  const emailToName = useMemo(() => {
    return profiles?.reduce((acc, p) => {
      acc[p.email] = p.name || p.email.split('@')[0];
      return acc;
    }, {} as Record<string, string>) || {};
  }, [profiles]);

  const authorStats = useMemo(() => {
    if (!requests) return [];
    
    const stats: Record<string, StatusCount> = {};
    
    requests.forEach(req => {
      const email = req.author_email;
      if (!stats[email]) {
        stats[email] = { pending: 0, inProgress: 0, testing: 0, approved: 0, rejected: 0 };
      }
      switch (req.status) {
        case 'PENDING': stats[email].pending++; break;
        case 'IN_PROGRESS': stats[email].inProgress++; break;
        case 'SENT_FOR_TEST': stats[email].testing++; break;
        case 'APPROVED_FOR_PRODUCTION': stats[email].approved++; break;
        case 'REJECTED_BY_CLIENT':
        case 'CANCELLED': stats[email].rejected++; break;
      }
    });

    return Object.entries(stats)
      .map(([email, counts]) => ({
        name: emailToName[email] || email.split('@')[0],
        ...counts,
        total: counts.pending + counts.inProgress + counts.testing + counts.approved + counts.rejected
      }))
      .sort((a, b) => b.total - a.total);
  }, [requests, emailToName]);

  const developerStats = useMemo(() => {
    if (!requests) return [];
    
    const stats: Record<string, Omit<StatusCount, 'pending'>> = {};
    
    requests
      .filter(r => r.responsible_email)
      .forEach(req => {
        const email = req.responsible_email!;
        if (!stats[email]) {
          stats[email] = { inProgress: 0, testing: 0, approved: 0, rejected: 0 };
        }
        switch (req.status) {
          case 'IN_PROGRESS': stats[email].inProgress++; break;
          case 'SENT_FOR_TEST': stats[email].testing++; break;
          case 'APPROVED_FOR_PRODUCTION': stats[email].approved++; break;
          case 'REJECTED_BY_CLIENT':
          case 'CANCELLED': stats[email].rejected++; break;
        }
      });

    return Object.entries(stats)
      .map(([email, counts]) => ({
        name: emailToName[email] || email.split('@')[0],
        ...counts,
        total: counts.inProgress + counts.testing + counts.approved + counts.rejected
      }))
      .sort((a, b) => b.total - a.total);
  }, [requests, emailToName]);

  const isLoading = requestsLoading || profilesLoading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{translations.rdAnalytics.title}</h2>
        <p className="text-muted-foreground">{translations.rdAnalytics.description}</p>
      </div>

      <RDNavTabs />

      <div className="grid gap-6">
        {/* Chart 1: Requests by Sales Managers */}
        <Card>
          <CardHeader>
            <CardTitle>{translations.rdAnalytics.chartAuthors}</CardTitle>
            <CardDescription>{translations.rdAnalytics.chartAuthorsDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : authorStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{translations.common.noData}</div>
            ) : (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={authorStats} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis 
                      allowDecimals={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="pending" stackId="a" fill={statusColors.pending} name={translations.rdAnalytics.statuses.pending} />
                    <Bar dataKey="inProgress" stackId="a" fill={statusColors.inProgress} name={translations.rdAnalytics.statuses.inProgress} />
                    <Bar dataKey="testing" stackId="a" fill={statusColors.testing} name={translations.rdAnalytics.statuses.testing} />
                    <Bar dataKey="approved" stackId="a" fill={statusColors.approved} name={translations.rdAnalytics.statuses.approved} />
                    <Bar dataKey="rejected" stackId="a" fill={statusColors.rejected} name={translations.rdAnalytics.statuses.rejected} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Requests by R&D Developers */}
        <Card>
          <CardHeader>
            <CardTitle>{translations.rdAnalytics.chartDevelopers}</CardTitle>
            <CardDescription>{translations.rdAnalytics.chartDevelopersDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : developerStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{translations.common.noData}</div>
            ) : (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={developerStats} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis 
                      allowDecimals={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="inProgress" stackId="a" fill={statusColors.inProgress} name={translations.rdAnalytics.statuses.inProgress} />
                    <Bar dataKey="testing" stackId="a" fill={statusColors.testing} name={translations.rdAnalytics.statuses.testing} />
                    <Bar dataKey="approved" stackId="a" fill={statusColors.approved} name={translations.rdAnalytics.statuses.approved} />
                    <Bar dataKey="rejected" stackId="a" fill={statusColors.rejected} name={translations.rdAnalytics.statuses.rejected} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
