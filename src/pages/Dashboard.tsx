import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { translations } from '@/lib/i18n';

export default function Dashboard() {
  const { profile } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', profile?.email],
    queryFn: async () => {
      let query = supabase.from('requests').select('status', { count: 'exact' });
      if (profile?.role === 'sales_manager') {
        query = query.eq('author_email', profile.email);
      }
      const { data, error } = await query;
      if (error) throw error;

      return {
        total: data.length,
        pending: data.filter(r => r.status === 'PENDING').length,
        in_progress: data.filter(r => r.status === 'IN_PROGRESS').length,
        testing: data.filter(r => r.status === 'SENT_FOR_TEST').length,
        approved: data.filter(r => r.status === 'APPROVED_FOR_PRODUCTION').length,
        rejected: data.filter(r => r.status === 'REJECTED_BY_CLIENT' || (r.status as string) === 'CANCELLED').length
      };
    },
    enabled: !!profile
  });

  const statCards = [
    { title: translations.dashboard.totalRequests, value: stats?.total || 0, icon: FileText, color: 'text-primary' },
    { title: translations.dashboard.pending, value: stats?.pending || 0, icon: Clock, color: 'text-warning' },
    { title: translations.dashboard.inProgress, value: stats?.in_progress || 0, icon: FileText, color: 'text-info' },
    { title: translations.dashboard.testing, value: stats?.testing || 0, icon: FileText, color: 'text-primary' },
    { title: translations.dashboard.approved, value: stats?.approved || 0, icon: CheckCircle2, color: 'text-success' },
    { title: translations.dashboard.rejected, value: stats?.rejected || 0, icon: XCircle, color: 'text-destructive' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {translations.dashboard.welcome}, {profile?.name}!
        </h2>
        <p className="text-muted-foreground">
          {translations.dashboard.descriptions[profile?.role as keyof typeof translations.dashboard.descriptions] || ''}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
