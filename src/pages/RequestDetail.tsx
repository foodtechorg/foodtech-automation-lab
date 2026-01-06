import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CalendarIcon, Edit, Loader2, MessageSquare, Play, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  const [complexityLevel, setComplexityLevel] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editEtaDate, setEditEtaDate] = useState<Date | undefined>();
  const [editRdComment, setEditRdComment] = useState('');
  const [editPriority, setEditPriority] = useState<string>('');
  const [editComplexityLevel, setEditComplexityLevel] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<'update' | 'send_for_test' | 'cancel'>('update');

  // Feedback dialog state
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackResult, setFeedbackResult] = useState<'PRODUCTION' | 'REWORK' | 'DECLINE' | null>(null);

  // Comment dialog state
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');

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

  const { data: testResults } = useQuery({
    queryKey: ['test-results', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('test_results')
        .select('*')
        .eq('request_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
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

  const canEditRequest = 
    (request?.status === 'PENDING' || request?.status === 'IN_PROGRESS') && 
    (profile?.role === 'rd_manager' || profile?.role === 'admin');

  const canProvideFeedback = 
    request?.status === 'SENT_FOR_TEST' && 
    profile?.role === 'sales_manager' && 
    request?.author_email === profile?.email;

  const canAddComment = 
    request?.status !== 'APPROVED_FOR_PRODUCTION' && 
    request?.status !== 'REJECTED_BY_CLIENT' &&
    request?.status !== 'CANCELLED' &&
    (
      (profile?.role === 'sales_manager' && request?.author_email === profile?.email) ||
      profile?.role === 'rd_dev' || 
      profile?.role === 'rd_manager' || 
      profile?.role === 'admin'
    );

  const openEditDialog = () => {
    setEditEtaDate(request?.eta_first_stage ? new Date(request.eta_first_stage) : undefined);
    setEditRdComment(request?.rd_comment || '');
    setEditPriority(request?.priority || 'MEDIUM');
    setEditComplexityLevel((request as any)?.complexity_level || '');
    setSelectedAction('update');
    setEditDialogOpen(true);
  };

  const handleEditRequest = async () => {
    if (!profile?.email || !id) return;
    if (selectedAction !== 'cancel' && !editEtaDate) {
      toast.error('Оберіть дату ETA');
      return;
    }

    setSubmitting(true);
    try {
      if (selectedAction === 'update') {
        const updateData: any = {
          eta_first_stage: editEtaDate ? format(editEtaDate, 'yyyy-MM-dd') : null,
          rd_comment: editRdComment || null,
          priority: editPriority,
        };
        if (editComplexityLevel) {
          updateData.complexity_level = editComplexityLevel;
        }

        const { error } = await supabase
          .from('requests')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;

        const updatedFields = ['eta_first_stage'];
        if (editPriority !== request?.priority) updatedFields.push('priority');
        if (editComplexityLevel !== (request as any)?.complexity_level) updatedFields.push('complexity_level');

        await supabase.rpc('log_request_event', {
          p_request_id: id,
          p_actor_email: profile.email,
          p_event_type: 'FIELD_UPDATED',
          p_payload: { fields: updatedFields },
        });

        // Log R&D comment as FEEDBACK_ADDED event
        if (editRdComment && editRdComment.trim()) {
          await supabase.rpc('log_request_event', {
            p_request_id: id,
            p_actor_email: profile.email,
            p_event_type: 'FEEDBACK_ADDED',
            p_payload: { comment: editRdComment.trim() },
          });
        }

        toast.success('Інформацію оновлено');
      } else if (selectedAction === 'send_for_test') {
        const { error } = await supabase
          .from('requests')
          .update({
            status: 'SENT_FOR_TEST',
            eta_first_stage: editEtaDate ? format(editEtaDate, 'yyyy-MM-dd') : null,
            rd_comment: editRdComment || null,
            date_sent_for_test: format(new Date(), 'yyyy-MM-dd'),
          })
          .eq('id', id);

        if (error) throw error;

        await supabase.rpc('log_request_event', {
          p_request_id: id,
          p_actor_email: profile.email,
          p_event_type: 'SENT_FOR_TEST',
          p_payload: { date: format(new Date(), 'yyyy-MM-dd') },
        });

        await supabase.rpc('log_request_event', {
          p_request_id: id,
          p_actor_email: profile.email,
          p_event_type: 'STATUS_CHANGED',
          p_payload: { from: 'IN_PROGRESS', to: 'SENT_FOR_TEST' },
        });

        toast.success('Заявку відправлено на тестування');
      } else if (selectedAction === 'cancel') {
        const { error } = await supabase
          .from('requests')
          .update({
            status: 'CANCELLED',
            rd_comment: editRdComment || null,
          })
          .eq('id', id);

        if (error) throw error;

        await supabase.rpc('log_request_event', {
          p_request_id: id,
          p_actor_email: profile.email,
          p_event_type: 'STATUS_CHANGED',
          p_payload: { from: 'IN_PROGRESS', to: 'CANCELLED' },
        });

        toast.success('Розробку скасовано');
      }

      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['request-events', id] });
    } catch (error) {
      console.error('Error editing request:', error);
      toast.error('Помилка при оновленні заявки');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!profile?.email || !id || !feedbackResult) return;
    if (feedbackComment.trim().length < 10) {
      toast.error('Коментар має містити мінімум 10 символів');
      return;
    }

    setSubmitting(true);
    try {
      // Determine new status based on result
      let newStatus: string;
      let isFinal = false;
      
      switch (feedbackResult) {
        case 'REWORK':
          newStatus = 'IN_PROGRESS';
          break;
        case 'DECLINE':
          newStatus = 'REJECTED_BY_CLIENT';
          break;
        case 'PRODUCTION':
          newStatus = 'APPROVED_FOR_PRODUCTION';
          isFinal = true;
          break;
        default:
          return;
      }

      // Insert test result
      const { error: testResultError } = await supabase
        .from('test_results')
        .insert({
          request_id: id,
          actor_email: profile.email,
          result: feedbackResult,
          feedback: feedbackComment.trim(),
          is_final: isFinal,
        });

      if (testResultError) throw testResultError;

      // Update request status
      const updateData: any = {
        status: newStatus,
        customer_result: feedbackResult,
        customer_feedback: feedbackComment.trim(),
      };

      if (feedbackResult === 'PRODUCTION') {
        updateData.production_start_date = format(new Date(), 'yyyy-MM-dd');
      }

      const { error: updateError } = await supabase
        .from('requests')
        .update(updateData)
        .eq('id', id);

      if (updateError) throw updateError;

      // Log events
      await supabase.rpc('log_request_event', {
        p_request_id: id,
        p_actor_email: profile.email,
        p_event_type: 'FEEDBACK_PROVIDED',
        p_payload: { result: feedbackResult, feedback: feedbackComment.trim() },
      });

      await supabase.rpc('log_request_event', {
        p_request_id: id,
        p_actor_email: profile.email,
        p_event_type: 'STATUS_CHANGED',
        p_payload: { from: 'SENT_FOR_TEST', to: newStatus },
      });

      const resultMessages: Record<string, string> = {
        REWORK: 'Заявку повернено на доопрацювання',
        DECLINE: 'Розробку відхилено',
        PRODUCTION: 'Заявку затверджено до виробництва',
      };

      toast.success(resultMessages[feedbackResult]);
      setFeedbackDialogOpen(false);
      setFeedbackComment('');
      setFeedbackResult(null);
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['request-events', id] });
      queryClient.invalidateQueries({ queryKey: ['test-results', id] });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Помилка при збереженні результату');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTakeRequest = async () => {
    if (!etaDate || !complexityLevel || !profile?.email || !id) {
      if (!complexityLevel) {
        toast.error('Оберіть рівень складності');
      }
      return;
    }

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
          complexity_level: complexityLevel,
        } as any)
        .eq('id', id);

      if (updateError) throw updateError;

      // Log ASSIGNED event
      await supabase.rpc('log_request_event', {
        p_request_id: id,
        p_actor_email: profile.email,
        p_event_type: 'ASSIGNED',
        p_payload: { responsible_email: profile.email, complexity_level: complexityLevel },
      });

      // Log STATUS_CHANGED event
      await supabase.rpc('log_request_event', {
        p_request_id: id,
        p_actor_email: profile.email,
        p_event_type: 'STATUS_CHANGED',
        p_payload: { from: 'PENDING', to: 'IN_PROGRESS' },
      });

      // Log R&D comment as FEEDBACK_ADDED event
      if (rdComment && rdComment.trim()) {
        await supabase.rpc('log_request_event', {
          p_request_id: id,
          p_actor_email: profile.email,
          p_event_type: 'FEEDBACK_ADDED',
          p_payload: { comment: rdComment.trim() },
        });
      }

      toast.success('Заявку взято в роботу');
      setTakeDialogOpen(false);
      setEtaDate(undefined);
      setRdComment('');
      setComplexityLevel('');
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['request-events', id] });
    } catch (error) {
      console.error('Error taking request:', error);
      toast.error('Помилка при взятті заявки в роботу');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!profile?.email || !id || newComment.trim().length < 5) return;
    
    setSubmitting(true);
    try {
      await supabase.rpc('log_request_event', {
        p_request_id: id,
        p_actor_email: profile.email,
        p_event_type: 'FEEDBACK_ADDED',
        p_payload: { comment: newComment.trim() },
      });
      
      toast.success('Коментар додано');
      setCommentDialogOpen(false);
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['request-events', id] });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Помилка при додаванні коментаря');
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{translations.requestDetail.sections.requestInfo}</CardTitle>
            {canProvideFeedback && (
              <Button variant="outline" onClick={() => setFeedbackDialogOpen(true)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Результати тестування
              </Button>
            )}
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
            {/* Test Results History */}
            {testResults && testResults.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <span className="text-sm text-muted-foreground font-medium">Результати тестування:</span>
                  {testResults.map((result) => (
                    <div 
                      key={result.id} 
                      className={cn(
                        "p-3 rounded-md border text-sm",
                        result.is_final 
                          ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                          : "bg-muted/30"
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium flex items-center gap-2">
                          {result.is_final && <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Фінальний</Badge>}
                          {t.clientResult(result.result)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(result.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{result.feedback}</p>
                      <p className="text-xs mt-1">— {emailToName[result.actor_email] || result.actor_email}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
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
              {canEditRequest && (
                <Button variant="outline" onClick={openEditDialog}>
                  <Edit className="mr-2 h-4 w-4" />
                  Редагувати
                </Button>
              )}
              {canAddComment && (
                <Button variant="outline" onClick={() => setCommentDialogOpen(true)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Додати коментар
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.responsibleDev}:</span><p className="font-medium">{request.responsible_email ? emailToName[request.responsible_email] : translations.requests.unassigned}</p></div>
              <div><span className="text-muted-foreground">{translations.requestDetail.fields.etaFirstStage}:</span><p className="font-medium">{request.eta_first_stage ? format(new Date(request.eta_first_stage), 'PPP', { locale: uk }) : '-'}</p></div>
              {(request as any).complexity_level && (
                <div>
                  <span className="text-muted-foreground">Рівень складності:</span>
                  <p className="font-medium">
                    <Badge variant="outline" className={cn(
                      (request as any).complexity_level === 'EASY' && 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                      (request as any).complexity_level === 'MEDIUM' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
                      (request as any).complexity_level === 'COMPLEX' && 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
                      (request as any).complexity_level === 'EXPERT' && 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    )}>
                      {{
                        'EASY': '1 – Легкий',
                        'MEDIUM': '2 – Середній',
                        'COMPLEX': '3 – Складний',
                        'EXPERT': '4 – Надскладний'
                      }[(request as any).complexity_level as string]}
                    </Badge>
                  </p>
                </div>
              )}
            </div>
            {request.date_sent_for_test && <div><span className="text-muted-foreground">{translations.requestDetail.fields.dateSentForTest}:</span><p className="font-medium">{format(new Date(request.date_sent_for_test), 'PPP', { locale: uk })}</p></div>}
            {/* Comments Feed */}
            {events && events.filter(e => e.event_type === 'FEEDBACK_ADDED').length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <span className="text-sm text-muted-foreground font-medium">Коментарі:</span>
                  {events
                    .filter(e => e.event_type === 'FEEDBACK_ADDED')
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((event) => (
                      <div key={event.id} className="p-3 rounded-md border text-sm bg-muted/30">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium">
                            {emailToName[event.actor_email] || event.actor_email}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {format(new Date(event.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          {(event.payload as any)?.comment}
                        </p>
                      </div>
                    ))}
                </div>
              </>
            )}
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
              <div className="flex items-center gap-1.5">
                <Label>Рівень складності *</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-md text-sm">
                      <div className="space-y-2">
                        <p><strong>1 – Легкий (до 3 днів):</strong> Підбір існуючого асортименту. Підбір аналогу сировини для заміни. Тестування нових зразків сировини. Виготовлення зразків продукції.</p>
                        <p><strong>2 – Середній (3–10 днів):</strong> Завдання потребує базового аналізу та коригування. Доопрацювання рецептури. Доопрацювання тестових зразків. Виготовлення нового продукту/аналогу із визначеним вмістом.</p>
                        <p><strong>3 – Складний (10–20 днів):</strong> Визначення вмісту інгредієнтів та розробка аналогу. Розробка нового виду продукту. Розробка за двома напрямками: смако-ароматичний та функціональний/барвник.</p>
                        <p><strong>4 – Надскладний (30–90 днів):</strong> Розробка «складної» суміші та принципово нового виду продукту за власною ініціативою або в межах внутрішнього R&D.</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select value={complexityLevel} onValueChange={setComplexityLevel}>
                <SelectTrigger className={cn(!complexityLevel && "text-muted-foreground")}>
                  <SelectValue placeholder="Оберіть рівень складності" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EASY">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Легкий</span>
                      <span className="text-xs text-muted-foreground">Стандартні компоненти, до 3 днів</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="MEDIUM">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Середній</span>
                      <span className="text-xs text-muted-foreground">Адаптація рецептур, 3–10 днів</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="COMPLEX">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Складний</span>
                      <span className="text-xs text-muted-foreground">Нові розробки, 10–20 днів</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="EXPERT">
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Надскладний</span>
                      <span className="text-xs text-muted-foreground">Довготривалі дослідження, 30–90 днів</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <Button onClick={handleTakeRequest} disabled={!etaDate || !complexityLevel || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Взяти в роботу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Request Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редагувати заявку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1 h-5">
                  <Label>Пріоритет</Label>
                </div>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть пріоритет" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">Високий</SelectItem>
                    <SelectItem value="MEDIUM">Середній</SelectItem>
                    <SelectItem value="LOW">Низький</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1 h-5">
                  <Label>Складність розробки</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        <p className="font-semibold mb-1">Легка:</p>
                        <p className="mb-2">Новий аромат на базі наявного рецепту, зміна дозування, підбір аналогу із наявних в асортименті</p>
                        <p className="font-semibold mb-1">Середня:</p>
                        <p className="mb-2">Розробка нового рецепту на основі наявних сировинних матеріалів</p>
                        <p className="font-semibold mb-1">Складна:</p>
                        <p className="mb-2">Розробка нового рецепту з пошуком/замовленням нової сировини</p>
                        <p className="font-semibold mb-1">Експертна:</p>
                        <p>Розробка нової технології або рішення, що потребує досліджень</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={editComplexityLevel} onValueChange={setEditComplexityLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Оберіть складність" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EASY">Легка</SelectItem>
                    <SelectItem value="MEDIUM">Середня</SelectItem>
                    <SelectItem value="COMPLEX">Складна</SelectItem>
                    <SelectItem value="EXPERT">Експертна</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ETA першого етапу</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editEtaDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editEtaDate ? format(editEtaDate, "PPP", { locale: uk }) : "Оберіть дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editEtaDate}
                    onSelect={setEditEtaDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Коментар R&D (опціонально)</Label>
              <Textarea
                value={editRdComment}
                onChange={(e) => setEditRdComment(e.target.value.slice(0, 500))}
                placeholder="Додайте коментар щодо розробки..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">{editRdComment.length}/500 символів</p>
            </div>
            <div className="space-y-3">
              <Label>Оберіть дію</Label>
              <RadioGroup value={selectedAction} onValueChange={(v) => setSelectedAction(v as any)}>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="update" id="action-update" className="mt-1" />
                  <Label htmlFor="action-update" className="font-normal cursor-pointer">
                    Просто оновити інформацію
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="send_for_test" id="action-test" className="mt-1" />
                  <div>
                    <Label htmlFor="action-test" className="font-normal cursor-pointer">
                      Готово до відправки на тест замовнику
                    </Label>
                    <p className="text-xs text-muted-foreground">Розробка завершена, зразок готовий для тестування</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="cancel" id="action-cancel" className="mt-1" />
                  <div>
                    <Label htmlFor="action-cancel" className="font-normal cursor-pointer">
                      Скасувати розробку
                    </Label>
                    <p className="text-xs text-muted-foreground">Припинити розробку за цією заявкою</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Скасувати
            </Button>
            <Button onClick={handleEditRequest} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Результат тестування зразка</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Коментар *</Label>
              <Textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Опишіть результати тестування..."
                rows={4}
              />
              <p className={cn(
                "text-xs text-right",
                feedbackComment.trim().length < 10 ? "text-destructive" : "text-muted-foreground"
              )}>
                {feedbackComment.trim().length}/10 символів (мінімум)
              </p>
            </div>
            <div className="space-y-3">
              <Label>Результат тестування *</Label>
              <RadioGroup value={feedbackResult || ''} onValueChange={(v) => setFeedbackResult(v as any)}>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="REWORK" id="feedback-rework" className="mt-1" />
                  <div>
                    <Label htmlFor="feedback-rework" className="font-normal cursor-pointer">
                      Повернути на доопрацювання
                    </Label>
                    <p className="text-xs text-muted-foreground">Заявка повернеться до розробника</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="DECLINE" id="feedback-decline" className="mt-1" />
                  <div>
                    <Label htmlFor="feedback-decline" className="font-normal cursor-pointer">
                      Відмовитись від розробки
                    </Label>
                    <p className="text-xs text-muted-foreground">Заявку буде закрито</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="PRODUCTION" id="feedback-production" className="mt-1" />
                  <div>
                    <Label htmlFor="feedback-production" className="font-normal cursor-pointer">
                      Затверджено
                    </Label>
                    <p className="text-xs text-muted-foreground">Заявка переходить у виробництво</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Скасувати
            </Button>
            <Button 
              onClick={handleFeedbackSubmit} 
              disabled={submitting || !feedbackResult || feedbackComment.trim().length < 10}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Зберегти результат
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Comment Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Додати коментар</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Коментар</Label>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Введіть коментар..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground text-right">
                {newComment.length} символів
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentDialogOpen(false)}>
              Скасувати
            </Button>
            <Button 
              onClick={handleAddComment} 
              disabled={submitting || newComment.trim().length < 5}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Додати
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
