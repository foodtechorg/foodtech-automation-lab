import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { translations, t } from '@/lib/i18n';

export default function Analytics() {
  const navigate = useNavigate();

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('email, name');
      if (error) throw error;
      return data;
    },
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['analytics-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const emailToName = profiles?.reduce((acc, p) => {
    acc[p.email] = p.name || p.email;
    return acc;
  }, {} as Record<string, string>) || {};

  const stats = {
    total: requests?.length || 0,
    active: requests?.filter(r => ['IN_PROGRESS', 'SENT_FOR_TEST'].includes(r.status)).length || 0,
    approved: requests?.filter(r => r.status === 'APPROVED_FOR_PRODUCTION').length || 0,
    rejected: requests?.filter(r => ['REJECTED_BY_CLIENT', 'CANCELLED'].includes(r.status)).length || 0,
    pending: requests?.filter(r => r.status === 'PENDING').length || 0,
  };

  const kpiCards = [
    { title: translations.analytics.kpi.totalRequests, value: stats.total, icon: TrendingUp, color: 'text-primary' },
    { title: translations.analytics.kpi.active, value: stats.active, icon: Clock, color: 'text-info' },
    { title: translations.analytics.kpi.approved, value: stats.approved, icon: CheckCircle2, color: 'text-success', subtitle: stats.total ? `${Math.round(stats.approved / stats.total * 100)}% ${translations.analytics.kpi.approvalRate}` : '' },
    { title: translations.analytics.kpi.rejected, value: stats.rejected, icon: XCircle, color: 'text-destructive', subtitle: stats.total ? `${Math.round(stats.rejected / stats.total * 100)}% ${translations.analytics.kpi.rejectionRate}` : '' },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-destructive/10 text-destructive';
      case 'MEDIUM': return 'bg-warning/10 text-warning';
      case 'LOW': return 'bg-success/10 text-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{translations.analytics.title}</h2>
        <p className="text-muted-foreground">{translations.analytics.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (
                <>
                  <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                  {kpi.subtitle && <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{translations.analytics.allRequestsData}</CardTitle>
          <CardDescription>{translations.analytics.allRequestsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translations.requests.table.code}</TableHead>
                    <TableHead>{translations.requests.table.customer}</TableHead>
                    <TableHead>{translations.requests.table.status}</TableHead>
                    <TableHead>{translations.requests.table.priority}</TableHead>
                    <TableHead>{translations.requests.table.author}</TableHead>
                    <TableHead>{translations.requests.table.responsible}</TableHead>
                    <TableHead>{translations.requests.table.created}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests?.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/requests/${r.id}`)}>
                      <TableCell className="font-medium">{r.code}</TableCell>
                      <TableCell>{r.customer_company}</TableCell>
                      <TableCell><StatusBadge status={r.status as any} /></TableCell>
                      <TableCell><Badge variant="outline" className={getPriorityColor(r.priority)}>{t.priority(r.priority)}</Badge></TableCell>
                      <TableCell>{emailToName[r.author_email] || r.author_email}</TableCell>
                      <TableCell>{r.responsible_email ? emailToName[r.responsible_email] : '-'}</TableCell>
                      <TableCell>{format(new Date(r.created_at), 'dd.MM.yyyy', { locale: uk })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
