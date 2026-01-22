import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { uk } from 'date-fns/locale';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

// SLA rules based on complexity level (days)
const SLA_RULES: Record<string, { dev: number; test: number; reworkFunctional: number; reworkFlavor: number }> = {
  EASY:    { dev: 3,  test: 10, reworkFunctional: 3,  reworkFlavor: 3 },
  MEDIUM:  { dev: 10, test: 10, reworkFunctional: 5,  reworkFlavor: 5 },
  COMPLEX: { dev: 20, test: 10, reworkFunctional: 10, reworkFlavor: 7 },
  EXPERT:  { dev: 90, test: 10, reworkFunctional: 30, reworkFlavor: 20 },
};

type StatusEvent = {
  request_id: string;
  created_at: string;
  payload: { from?: string; to?: string } | null;
};

function calculateDynamicSlaDate(
  requestId: string,
  currentStatus: string,
  complexityLevel: string | null,
  direction: string,
  statusEvents: StatusEvent[]
): Date | null {
  if (!complexityLevel) return null;
  
  const rules = SLA_RULES[complexityLevel];
  if (!rules) return null;
  
  const requestEvents = statusEvents
    .filter(e => e.request_id === requestId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  if (requestEvents.length === 0) return null;
  
  const isFunctionalType = direction === 'FUNCTIONAL' || direction === 'COMPLEX';
  const reworkDays = isFunctionalType ? rules.reworkFunctional : rules.reworkFlavor;
  
  if (currentStatus === 'IN_PROGRESS') {
    const lastInProgressEvent = [...requestEvents].reverse().find(
      e => e.payload?.to === 'IN_PROGRESS'
    );
    if (!lastInProgressEvent) return null;
    
    const isRework = lastInProgressEvent.payload?.from === 'SENT_FOR_TEST';
    const days = isRework ? reworkDays : rules.dev;
    
    return addDays(new Date(lastInProgressEvent.created_at), days);
  }
  
  return null;
}

export default function DevelopmentBoard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [customerFilter, setCustomerFilter] = useState('');
  
  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('email, name');
      if (error) throw error;
      return data;
    }
  });
  
  // Fetch only IN_PROGRESS requests for Development module
  const { data: requests, isLoading } = useQuery({
    queryKey: ['development-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'IN_PROGRESS')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: inProgressEvents } = useQuery({
    queryKey: ['dev-in-progress-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_events')
        .select('request_id, created_at, payload')
        .eq('event_type', 'STATUS_CHANGED');
      if (error) throw error;
      return data;
    }
  });

  const statusEvents = useMemo<StatusEvent[]>(() => {
    if (!inProgressEvents) return [];
    return inProgressEvents.map(e => ({
      request_id: e.request_id,
      created_at: e.created_at,
      payload: e.payload as { from?: string; to?: string } | null,
    }));
  }, [inProgressEvents]);
  
  const emailToName = profiles?.reduce((acc, p) => {
    acc[p.email] = p.name || p.email;
    return acc;
  }, {} as Record<string, string>) || {};
  
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter(request => {
      // rd_dev only sees their own assigned requests
      if (profile?.role === 'rd_dev') {
        if (request.responsible_email !== profile.email) {
          return false;
        }
      }
      const matchesCustomer = customerFilter === '' || 
        request.customer_company.toLowerCase().includes(customerFilter.toLowerCase());
      return matchesCustomer;
    });
  }, [requests, customerFilter, profile]);
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-destructive/10 text-destructive';
      case 'MEDIUM':
        return 'bg-warning/10 text-warning';
      case 'LOW':
        return 'bg-success/10 text-success';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getSlaInfo = (request: NonNullable<typeof requests>[number]) => {
    const slaDate = calculateDynamicSlaDate(
      request.id,
      request.status,
      request.complexity_level,
      request.direction,
      statusEvents
    );
    const isOverdue = slaDate && new Date() > slaDate;
    return { slaDate, isOverdue };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-bold tracking-tight text-2xl">Заявки в роботі</h2>
        <p className="text-muted-foreground">
          Модуль "Розробка" — управління рецептами та зразками для R&D заявок
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Заявки зі статусом "В роботі"</CardTitle>
          <CardDescription>{filteredRequests.length} заявок в розробці</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="space-y-1">
              <label className="text-sm font-medium">Замовник</label>
              <Input 
                placeholder="Пошук по замовнику..." 
                value={customerFilter} 
                onChange={e => setCustomerFilter(e.target.value)} 
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Немає заявок зі статусом "В роботі"
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="space-y-3 md:hidden">
                {filteredRequests.map(request => {
                  const { slaDate, isOverdue } = getSlaInfo(request);
                  return (
                    <div 
                      key={request.id} 
                      className={cn(
                        "p-4 border rounded-lg bg-card cursor-pointer hover:bg-muted/50 transition-colors",
                        isOverdue && "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900"
                      )} 
                      onClick={() => navigate(`/development/requests/${request.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-primary">{request.code}</span>
                        <StatusBadge status={request.status as any} />
                      </div>
                      <p className="text-sm font-medium mb-1">{request.customer_company}</p>
                      <p className="text-xs text-muted-foreground mb-1">
                        Автор: {emailToName[request.author_email] || request.author_email}
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Відповідальний: {request.responsible_email ? emailToName[request.responsible_email] : 'Не призначено'}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{t.direction(request.direction)}</span>
                        <span>•</span>
                        <span>{t.domain(request.domain)}</span>
                        <span>•</span>
                        <Badge variant="outline" className={`${getPriorityColor(request.priority)} text-xs`}>
                          {t.priority(request.priority)}
                        </Badge>
                        <span>•</span>
                        <span>{format(new Date(request.created_at), 'd MMM yyyy', { locale: uk })}</span>
                        {slaDate && (
                          <>
                            <span>•</span>
                            <span className={cn(isOverdue && "text-orange-600 dark:text-orange-400 font-medium")}>
                              SLA: {format(slaDate, 'd MMM yyyy', { locale: uk })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Код</TableHead>
                      <TableHead>Замовник</TableHead>
                      <TableHead>Автор</TableHead>
                      <TableHead>Вид продукту</TableHead>
                      <TableHead>Напрямок</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Пріоритет</TableHead>
                      <TableHead>Відповідальний</TableHead>
                      <TableHead>Створено</TableHead>
                      <TableHead>Планова дата по SLA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map(request => {
                      const { slaDate, isOverdue } = getSlaInfo(request);
                      return (
                        <TableRow 
                          key={request.id} 
                          className={cn(
                            "cursor-pointer hover:bg-muted/50",
                            isOverdue && "bg-orange-50 dark:bg-orange-950/30"
                          )} 
                          onClick={() => navigate(`/development/requests/${request.id}`)}
                        >
                          <TableCell className="font-medium">{request.code}</TableCell>
                          <TableCell>{request.customer_company}</TableCell>
                          <TableCell>{emailToName[request.author_email] || request.author_email}</TableCell>
                          <TableCell>{t.domain(request.domain)}</TableCell>
                          <TableCell>{t.direction(request.direction)}</TableCell>
                          <TableCell><StatusBadge status={request.status as any} /></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getPriorityColor(request.priority)}>
                              {t.priority(request.priority)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {request.responsible_email ? emailToName[request.responsible_email] : 'Не призначено'}
                          </TableCell>
                          <TableCell>{format(new Date(request.created_at), 'd MMM yyyy', { locale: uk })}</TableCell>
                          <TableCell className={cn(isOverdue && "text-orange-600 dark:text-orange-400 font-medium")}>
                            {slaDate ? format(slaDate, 'd MMM yyyy', { locale: uk }) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
