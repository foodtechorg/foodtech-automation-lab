import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { translations, t } from '@/lib/i18n';

export default function RDBoard() {
  const { profile } = useAuth();
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
    queryKey: ['rd-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const emailToName = profiles?.reduce((acc, p) => {
    acc[p.email] = p.name || p.email;
    return acc;
  }, {} as Record<string, string>) || {};

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
        <h2 className="text-3xl font-bold tracking-tight">{translations.rdBoard.title}</h2>
        <p className="text-muted-foreground">{translations.rdBoard.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{translations.rdBoard.allRequests}</CardTitle>
          <CardDescription>{requests?.length || 0} {translations.rdBoard.requestsInSystem}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : requests?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{translations.requests.noRequests}</div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="space-y-3 md:hidden">
                {requests?.map((request) => (
                  <div 
                    key={request.id} 
                    className="p-4 border rounded-lg bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => navigate(`/requests/${request.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-primary">{request.code}</span>
                      <StatusBadge status={request.status as any} />
                    </div>
                    <p className="text-sm font-medium mb-1">{request.customer_company}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {request.responsible_email ? emailToName[request.responsible_email] : translations.rdBoard.unassigned}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{t.direction(request.direction)}</span>
                      <span>•</span>
                      <Badge variant="outline" className={`${getPriorityColor(request.priority)} text-xs`}>
                        {t.priority(request.priority)}
                      </Badge>
                      <span>•</span>
                      <span>{format(new Date(request.created_at), 'dd.MM.yyyy', { locale: uk })}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translations.requests.table.code}</TableHead>
                      <TableHead>{translations.requests.table.customer}</TableHead>
                      <TableHead>{translations.requests.table.direction}</TableHead>
                      <TableHead>{translations.requests.table.status}</TableHead>
                      <TableHead>{translations.requests.table.priority}</TableHead>
                      <TableHead>{translations.requests.table.responsible}</TableHead>
                      <TableHead>{translations.requests.table.created}</TableHead>
                      <TableHead>{translations.requests.table.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests?.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.code}</TableCell>
                        <TableCell>{request.customer_company}</TableCell>
                        <TableCell>{t.direction(request.direction)}</TableCell>
                        <TableCell><StatusBadge status={request.status as any} /></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getPriorityColor(request.priority)}>
                            {t.priority(request.priority)}
                          </Badge>
                        </TableCell>
                        <TableCell>{request.responsible_email ? emailToName[request.responsible_email] : translations.rdBoard.unassigned}</TableCell>
                        <TableCell>{format(new Date(request.created_at), 'dd.MM.yyyy', { locale: uk })}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/requests/${request.id}`)}>
                            {translations.rdBoard.view}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
