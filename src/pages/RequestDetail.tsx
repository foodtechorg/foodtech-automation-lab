import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CalendarIcon, Loader2, Play } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { translations, t } from '@/lib/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [takeDialogOpen, setTakeDialogOpen] = useState(false);
  const [etaDate, setEtaDate] = useState<Date | undefined>();
  const [rdComment, setRdComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: request, isLoading } = useQuery({
    queryKey: ['request', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('requests').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: events } = useQuery({
    queryKey: ['request-events', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('request_events').select('*').eq('request_id', id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('email, name');
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

  const canTakeRequest = 
    request?.status === 'PENDING' && 
    !request?.responsible_email && 
    (profile?.role === 'rd_dev' || profile?.role === 'rd_manager' || profile?.role === 'admin');

  const handleTakeRequest = async () => {
    if (!etaDate || !profile?.email || !id) return;

    setSubmitting(true);
    try {
      // Update request
      const { error: updateError } = await supabase
        .from('requests')
        .update({
          status: 'IN_PROGRESS',
          responsible_email: profile.email,
          eta_first_stage: format(etaDate, 'yyyy-MM-dd'),
          rd_comment: rdComment || null,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      // Log ASSIGNED event
      await supabase.rpc('log_request_event', {
        p_request_id: id,
        p_actor_email: profile.email,
        p_event_type: 'ASSIGNED',
        p_payload: { responsible_email: profile.email },
      });

      // Log STATUS_CHANGED event
      await supabase.rpc('log_request_event', {
        p_request_id: id,
        p_actor_email: profile.email,
        p_event_type: 'STATUS_CHANGED',
        p_payload: { from: 'PENDING', to: 'IN_PROGRESS' },
      });

      toast.success('Заявку взято в роботу');
      setTakeDialogOpen(false);
      setEtaDate(undefined);
      setRdComment('');
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['request-events', id] });
    } catch (error) {
      console.error('Error taking request:', error);
      toast.error('Помилка при взятті заявки в роботу');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-muted-foreground">{translations.requestDetail.notFound}</p>
        <Button className="mt-4" onClick={() => navigate('/')}>{translations.requestDetail.goToDashboard}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{request.code}</h2>
            <StatusBadge status={request.status as any} />
            <Badge variant="outline" className={getPriorityColor(request.priority)}>{t.priority(request.priority)}</Badge>
          </div>
          <p className="text-muted-foreground">{request.customer_company}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{translations.requestDetail.sections.requestInfo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.customerCompany}:</span><p className="font-medium">{request.customer_company}</p></div>
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.customerContact}:</span><p className="font-medium">{request.customer_contact || '-'}</p></div>
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.direction}:</span><p className="font-medium">{t.direction(request.direction)}</p></div>
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.domain}:</span><p className="font-medium">{t.domain(request.domain)}</p></div>
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.author}:</span><p className="font-medium">{emailToName[request.author_email] || request.author_email}</p></div>
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.createdAt}:</span><p className="font-medium">{format(new Date(request.created_at), 'PPP', { locale: uk })}</p></div>
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.desiredDueDate}:</span><p className="font-medium">{request.desired_due_date ? format(new Date(request.desired_due_date), 'PPP', { locale: uk }) : '-'}</p></div>
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.hasSampleAnalog}:</span><p className="font-medium">{request.has_sample_analog ? translations.requestDetail.fields.sampleAnalogYes : translations.requestDetail.fields.sampleAnalogNo}</p></div>
            </div>
            <Separator />
            <div><span className="text-muted-foreground">{translations.requestDetail.fields.description}:</span><p className="mt-1">{request.description}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{translations.requestDetail.sections.rdInfo}</CardTitle>
            <div className="flex gap-2">
              {canTakeRequest && (
                <Button variant="outline" onClick={() => setTakeDialogOpen(true)}>
                  <Play className="mr-2 h-4 w-4" />
                  Взяти в роботу
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.responsibleDev}:</span><p className="font-medium">{request.responsible_email ? emailToName[request.responsible_email] : translations.requests.unassigned}</p></div>
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.etaFirstStage}:</span><p className="font-medium">{request.eta_first_stage ? format(new Date(request.eta_first_stage), 'PPP', { locale: uk }) : '-'}</p></div>
            </div>
            {request.rd_comment && <div><span className="text-muted-foreground">{translations.requestDetail.fields.rdComment}:</span><p className="mt-1 whitespace-pre-wrap">{request.rd_comment}</p></div>}
            {request.date_sent_for_test && <div><span className="text-muted-foreground">{translations.requestDetail.fields.dateSentForTest}:</span><p className="font-medium">{format(new Date(request.date_sent_for_test), 'PPP', { locale: uk })}</p></div>}
            {request.customer_feedback && <><Separator /><div><span className="text-muted-foreground">{translations.requestDetail.fields.customerFeedback}:</span><p className="mt-1">{request.customer_feedback}</p></div></>}
            {request.customer_result && <div><span className="text-muted-foreground">{translations.requestDetail.fields.clientResult}:</span><p className="font-medium">{t.clientResult(request.customer_result)}</p></div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{translations.requestDetail.sections.eventTimeline}</CardTitle>
        </CardHeader>
        <CardContent>
          {events && events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="flex gap-4 text-sm">
                  <div className="text-muted-foreground whitespace-nowrap">{format(new Date(event.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}</div>
                  <div><span className="font-medium">{t.eventType(event.event_type)}</span><span className="text-muted-foreground"> - {emailToName[event.actor_email] || event.actor_email}</span></div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">{translations.requestDetail.noEvents}</p>
          )}
        </CardContent>
      </Card>

      {/* Take Request Dialog */}
      <Dialog open={takeDialogOpen} onOpenChange={setTakeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Взяти в роботу</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>ETA першого етапу *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !etaDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {etaDate ? format(etaDate, "PPP", { locale: uk }) : "Оберіть дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={etaDate}
                    onSelect={setEtaDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Коментар R&D (опціонально)</Label>
              <Textarea
                value={rdComment}
                onChange={(e) => setRdComment(e.target.value)}
                placeholder="Додайте коментар щодо розробки..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTakeDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={handleTakeRequest} disabled={!etaDate || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Взяти в роботу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
