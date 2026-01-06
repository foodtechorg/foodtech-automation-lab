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
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { translations, t } from '@/lib/i18n';
import { Constants } from '@/integrations/supabase/types';
import { Plus } from 'lucide-react';
export default function MyRequests() {
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
    data: requests,
    isLoading
  } = useQuery({
    queryKey: ['my-requests', profile?.email],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('requests').select('*').eq('author_email', profile?.email).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return data;
    },
    enabled: !!profile
  });
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
  return <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-bold tracking-tight text-2xl">{translations.requests.myRequests}</h2>
          <p className="text-muted-foreground">{translations.requests.myRequestsDesc}</p>
        </div>
        <Button onClick={() => navigate('/requests/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Нова заявка
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{translations.requests.requestList}</CardTitle>
          <CardDescription>{filteredRequests.length} {translations.requests.requestsFound}</CardDescription>
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
                {filteredRequests.map(request => <div key={request.id} className="p-4 border rounded-lg bg-card cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/requests/${request.id}`)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-primary">{request.code}</span>
                      <StatusBadge status={request.status as any} />
                    </div>
                    <p className="text-sm font-medium mb-1">{request.customer_company}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{t.direction(request.direction)}</span>
                      <span>•</span>
                      <span>{t.domain(request.domain)}</span>
                      <span>•</span>
                      <Badge variant="outline" className={`${getPriorityColor(request.priority)} text-xs`}>
                        {t.priority(request.priority)}
                      </Badge>
                      <span>•</span>
                      <span>{format(new Date(request.created_at), 'd MMM yyyy', {
                    locale: uk
                  })}</span>
                    </div>
                  </div>)}
              </div>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translations.requests.table.code}</TableHead>
                      <TableHead>{translations.requests.table.customer}</TableHead>
                      <TableHead>{translations.requests.table.direction}</TableHead>
                      <TableHead>{translations.requests.table.domain}</TableHead>
                      <TableHead>{translations.requests.table.status}</TableHead>
                      <TableHead>{translations.requests.table.priority}</TableHead>
                      <TableHead>{translations.requests.table.created}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map(request => <TableRow key={request.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/requests/${request.id}`)}>
                        <TableCell className="font-medium">{request.code}</TableCell>
                        <TableCell>{request.customer_company}</TableCell>
                        <TableCell>{t.direction(request.direction)}</TableCell>
                        <TableCell>{t.domain(request.domain)}</TableCell>
                        <TableCell><StatusBadge status={request.status as any} /></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getPriorityColor(request.priority)}>
                            {t.priority(request.priority)}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(request.created_at), 'd MMM yyyy', {
                      locale: uk
                    })}</TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
              </div>
            </>}
        </CardContent>
      </Card>
    </div>;
}