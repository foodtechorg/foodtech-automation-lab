import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { translations, t } from '@/lib/i18n';
import { Constants } from '@/integrations/supabase/types';
import { RDNavTabs } from '@/components/rd/RDNavTabs';
import { cn } from '@/lib/utils';

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
  
  // Filter events for this request and sort chronologically
  const requestEvents = statusEvents
    .filter(e => e.request_id === requestId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  if (requestEvents.length === 0) return null;
  
  // Determine rework days based on direction
  const isFunctionalType = direction === 'FUNCTIONAL' || direction === 'COMPLEX';
  const reworkDays = isFunctionalType ? rules.reworkFunctional : rules.reworkFlavor;
  
  // Find the last relevant event for the current status
  if (currentStatus === 'IN_PROGRESS') {
    // Find the last transition TO IN_PROGRESS
    const lastInProgressEvent = [...requestEvents].reverse().find(
      e => e.payload?.to === 'IN_PROGRESS'
    );
    if (!lastInProgressEvent) return null;
    
    // Check if this is a return from testing (rework) or initial development
    const isRework = lastInProgressEvent.payload?.from === 'SENT_FOR_TEST';
    const days = isRework ? reworkDays : rules.dev;
    
    return addDays(new Date(lastInProgressEvent.created_at), days);
  }
  
  if (currentStatus === 'SENT_FOR_TEST') {
    // Find the last transition TO SENT_FOR_TEST
    const lastTestEvent = [...requestEvents].reverse().find(
      e => e.payload?.to === 'SENT_FOR_TEST'
    );
    if (!lastTestEvent) return null;
    return addDays(new Date(lastTestEvent.created_at), rules.test);
  }
  
  // For completed/cancelled/pending statuses, don't show SLA
  return null;
}

export default function RDBoard() {
  const {
    profile
  } = useAuth();
  const navigate = useNavigate();

  // Filter states
  const [customerFilter, setCustomerFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  const {
    data: profiles
  } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('profiles').select('email, name');
      if (error) throw error;
      return data;
    }
  });
  
  const {
    data: requests,
    isLoading
  } = useQuery({
    queryKey: ['rd-requests'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('requests').select('*').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return data;
    }
  });

  // Fetch IN_PROGRESS events to calculate SLA dates
  const { data: inProgressEvents } = useQuery({
    queryKey: ['rd-in-progress-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_events')
        .select('request_id, created_at, payload')
        .eq('event_type', 'STATUS_CHANGED');
      if (error) throw error;
      return data;
    }
  });

  // Cast events to typed array
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
      const matchesCustomer = customerFilter === '' || request.customer_company.toLowerCase().includes(customerFilter.toLowerCase());
      const matchesDirection = directionFilter === 'all' || request.direction === directionFilter;
      const matchesDomain = domainFilter === 'all' || request.domain === domainFilter;
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter;
      return matchesCustomer && matchesDirection && matchesDomain && matchesStatus && matchesPriority;
    });
  }, [requests, customerFilter, directionFilter, domainFilter, statusFilter, priorityFilter]);
  
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

  const getSlaInfo = (request: typeof requests extends (infer T)[] | undefined ? T : never) => {
    const slaDate = calculateDynamicSlaDate(
      request.id,
      request.status,
      request.complexity_level,
      request.direction,
      statusEvents
    );
    const isActiveStatus = ['IN_PROGRESS', 'SENT_FOR_TEST'].includes(request.status);
    const isOverdue = slaDate && isActiveStatus && new Date() > slaDate;
    return { slaDate, isOverdue };
  };
  return <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-bold tracking-tight text-2xl">{translations.rdBoard.title}</h2>
          <p className="text-muted-foreground">{translations.rdBoard.description}</p>
        </div>
        {profile?.role === 'admin' && <Button onClick={() => navigate('/requests/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Нова заявка
          </Button>}
      </div>

      <RDNavTabs />

      <Card>
        <CardHeader>
          <CardTitle>{translations.rdBoard.allRequests}</CardTitle>
          <CardDescription>{filteredRequests.length} {translations.rdBoard.requestsInSystem}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="space-y-1">
              <label className="text-sm font-medium">{translations.requests.table.customer}</label>
              <Input placeholder="Пошук..." value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{translations.requests.table.direction}</label>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Всі" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всі</SelectItem>
                  {Constants.public.Enums.direction.map(dir => <SelectItem key={dir} value={dir}>{t.direction(dir)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{translations.requests.table.domain}</label>
              <Select value={domainFilter} onValueChange={setDomainFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Всі" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всі</SelectItem>
                  {Constants.public.Enums.domain.map(dom => <SelectItem key={dom} value={dom}>{t.domain(dom)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{translations.requests.table.status}</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Всі" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всі</SelectItem>
                  {Constants.public.Enums.status.map(st => <SelectItem key={st} value={st}>{t.status(st)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{translations.requests.table.priority}</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Всі" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всі</SelectItem>
                  {Constants.public.Enums.priority.map(pr => <SelectItem key={pr} value={pr}>{t.priority(pr)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div> : filteredRequests.length === 0 ? <div className="text-center py-8 text-muted-foreground">{translations.requests.noRequests}</div> : <>
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
                      onClick={() => navigate(`/requests/${request.id}`)}
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
                        Відповідальний: {request.responsible_email ? emailToName[request.responsible_email] : translations.rdBoard.unassigned}
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
                      <TableHead>{translations.requests.table.code}</TableHead>
                      <TableHead>{translations.requests.table.customer}</TableHead>
                      <TableHead>Автор</TableHead>
                      <TableHead>{translations.requests.table.direction}</TableHead>
                      <TableHead>{translations.requests.table.domain}</TableHead>
                      <TableHead>{translations.requests.table.status}</TableHead>
                      <TableHead>{translations.requests.table.priority}</TableHead>
                      <TableHead>{translations.requests.table.responsible}</TableHead>
                      <TableHead>{translations.requests.table.created}</TableHead>
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
                          onClick={() => navigate(`/requests/${request.id}`)}
                        >
                          <TableCell className="font-medium">{request.code}</TableCell>
                          <TableCell>{request.customer_company}</TableCell>
                          <TableCell>{emailToName[request.author_email] || request.author_email}</TableCell>
                          <TableCell>{t.direction(request.direction)}</TableCell>
                          <TableCell>{t.domain(request.domain)}</TableCell>
                          <TableCell><StatusBadge status={request.status as any} /></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getPriorityColor(request.priority)}>
                              {t.priority(request.priority)}
                            </Badge>
                          </TableCell>
                          <TableCell>{request.responsible_email ? emailToName[request.responsible_email] : translations.rdBoard.unassigned}</TableCell>
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
            </>}
        </CardContent>
      </Card>
    </div>;
}