import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CalendarIcon, Edit, Loader2, MessageSquare, Play, Info, Download, Trash2, FileText, Upload, X } from 'lucide-react';
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
import { 
  getRdAttachments, 
  deleteRdAttachment, 
  getRdSignedUrl, 
  formatFileSize, 
  getFileIcon, 
  RdAttachment, 
  uploadRdAttachment, 
  validateRdFile,
  isImageType 
} from '@/services/rdAttachmentService';

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
  const [originalRdComment, setOriginalRdComment] = useState('');
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

  // Edit dialog files state
  const [editPendingFiles, setEditPendingFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Image preview state
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string>('');
  
  // Attachment URLs cache
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});

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

  const { data: attachments, refetch: refetchAttachments } = useQuery({
    queryKey: ['rd-attachments', id],
    queryFn: async () => getRdAttachments(id!),
    enabled: !!id,
  });

  const isAuthor = request?.author_email === profile?.email;

  const handleDownloadAttachment = async (attachment: RdAttachment) => {
    try {
      const url = await getRdSignedUrl(attachment.file_path);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.file_name;
      link.target = '_blank';
      link.click();
    } catch (error) {
      toast.error('Помилка завантаження файлу');
    }
  };

  const handleDeleteAttachment = async (attachment: RdAttachment) => {
    try {
      await deleteRdAttachment(attachment.id, attachment.file_path);
      toast.success('Файл видалено');
      refetchAttachments();
    } catch (error) {
      toast.error('Помилка видалення файлу');
    }
  };

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
    (profile?.role === 'rd_manager' || profile?.role === 'admin' || 
     profile?.role === 'ceo' || profile?.role === 'coo' || 
     profile?.role === 'quality_manager' || profile?.role === 'admin_director');

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
      profile?.role === 'admin' ||
      profile?.role === 'ceo' ||
      profile?.role === 'coo' ||
      profile?.role === 'quality_manager' ||
      profile?.role === 'admin_director'
    );

  const openEditDialog = () => {
    setEditEtaDate(request?.eta_first_stage ? new Date(request.eta_first_stage) : undefined);
    const currentRdComment = request?.rd_comment || '';
    setEditRdComment(currentRdComment);
    setOriginalRdComment(currentRdComment);
    setEditPriority(request?.priority || 'MEDIUM');
    setEditComplexityLevel((request as any)?.complexity_level || '');
    setSelectedAction('update');
    setEditPendingFiles([]);
    setEditDialogOpen(true);
  };

  // Handle file selection in edit dialog
  const handleEditFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateRdFile(file);
      if (error) {
        toast.error(`${file.name}: ${error}`);
      } else {
        newFiles.push(file);
      }
    }
    setEditPendingFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  }, []);

  const removeEditPendingFile = (index: number) => {
    setEditPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle image thumbnail click
  const handleImagePreview = async (attachment: RdAttachment) => {
    try {
      // Use cached URL or fetch new one
      let url = attachmentUrls[attachment.id];
      if (!url) {
        url = await getRdSignedUrl(attachment.file_path);
        setAttachmentUrls(prev => ({ ...prev, [attachment.id]: url }));
      }
      setPreviewImageUrl(url);
      setPreviewImageName(attachment.file_name);
    } catch (error) {
      toast.error('Помилка завантаження зображення');
    }
  };

  // Load thumbnail URLs for attachments in comments
  useEffect(() => {
    const loadThumbnails = async () => {
      if (!attachments) return;
      const imageAttachments = attachments.filter(a => isImageType(a.file_type) && !attachmentUrls[a.id]);
      
      for (const att of imageAttachments) {
        try {
          const url = await getRdSignedUrl(att.file_path);
          setAttachmentUrls(prev => ({ ...prev, [att.id]: url }));
        } catch (error) {
          console.error('Error loading thumbnail:', error);
        }
      }
    };
    loadThumbnails();
  }, [attachments]);

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

        // Log separate events for each changed field
        if (editPriority !== request?.priority) {
          await supabase.rpc('log_request_event', {
            p_request_id: id,
            p_actor_email: profile.email,
            p_event_type: 'FIELD_UPDATED',
            p_payload: { field: 'priority', from: request?.priority, to: editPriority },
          });
        }

        if (editComplexityLevel !== (request as any)?.complexity_level) {
          await supabase.rpc('log_request_event', {
            p_request_id: id,
            p_actor_email: profile.email,
            p_event_type: 'FIELD_UPDATED',
            p_payload: { field: 'complexity_level', from: (request as any)?.complexity_level, to: editComplexityLevel },
          });
        }

        const currentEta = request?.eta_first_stage;
        const newEta = editEtaDate ? format(editEtaDate, 'yyyy-MM-dd') : null;
        if (newEta !== currentEta) {
          await supabase.rpc('log_request_event', {
            p_request_id: id,
            p_actor_email: profile.email,
            p_event_type: 'FIELD_UPDATED',
            p_payload: { field: 'eta_first_stage', to: newEta },
          });
        }

        // Log R&D comment as FEEDBACK_ADDED event only if changed or has files
        let eventId: string | null = null;
        if ((editRdComment && editRdComment.trim() && editRdComment.trim() !== originalRdComment.trim()) || editPendingFiles.length > 0) {
          const { data: eventData, error: eventError } = await supabase
            .from('request_events')
            .insert({
              request_id: id,
              actor_email: profile.email,
              event_type: 'FEEDBACK_ADDED',
              payload: { comment: editRdComment?.trim() || '' },
            })
            .select('id')
            .single();
          
          if (eventError) {
            console.error('Error creating event:', eventError);
          } else {
            eventId = eventData.id;
          }
        }

        // Upload files and link to the event
        if (editPendingFiles.length > 0 && profile?.id) {
          setUploadingFiles(true);
          try {
            for (const file of editPendingFiles) {
              await uploadRdAttachment(file, id, profile.id, eventId || undefined);
            }
          } catch (uploadError) {
            console.error('Error uploading files:', uploadError);
            toast.error('Деякі файли не вдалося завантажити');
          } finally {
            setUploadingFiles(false);
          }
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
      setEditPendingFiles([]);
      queryClient.invalidateQueries({ queryKey: ['request', id] });
      queryClient.invalidateQueries({ queryKey: ['request-events', id] });
      queryClient.invalidateQueries({ queryKey: ['rd-attachments', id] });
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
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 mt-1" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl md:text-3xl font-bold tracking-tight">{request.code}</h2>
            <StatusBadge status={request.status as any} />
            <Badge variant="outline" className={getPriorityColor(request.priority)}>{t.priority(request.priority)}</Badge>
          </div>
          <p className="text-muted-foreground truncate">{request.customer_company}</p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>{translations.requestDetail.sections.requestInfo}</CardTitle>
            {canProvideFeedback && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setFeedbackDialogOpen(true)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Результати тестування
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
            <div><span className="text-muted-foreground">{translations.requestDetail.fields.description}:</span><p className="mt-1 break-words">{request.description}</p></div>
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
          <CardHeader className="space-y-3">
            <CardTitle>{translations.requestDetail.sections.rdInfo}</CardTitle>
            {(canTakeRequest || canEditRequest || canAddComment) && (
              <div className="flex flex-wrap gap-2">
                {canTakeRequest && (
                  <Button size="sm" variant="outline" onClick={() => setTakeDialogOpen(true)}>
                    <Play className="mr-2 h-4 w-4" />
                    Взяти в роботу
                  </Button>
                )}
                {canEditRequest && (
                  <Button size="sm" variant="outline" onClick={openEditDialog}>
                    <Edit className="mr-2 h-4 w-4" />
                    Редагувати
                  </Button>
                )}
                {canAddComment && (
                  <Button size="sm" variant="outline" onClick={() => setCommentDialogOpen(true)}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Коментар
                  </Button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
                    .map((event) => {
                      // Get attachments for this event
                      const eventAttachments = attachments?.filter(a => a.event_id === event.id) || [];
                      const imageAttachments = eventAttachments.filter(a => isImageType(a.file_type));
                      const otherAttachments = eventAttachments.filter(a => !isImageType(a.file_type));
                      
                      return (
                        <div key={event.id} className="p-3 rounded-md border text-sm bg-muted/30">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">
                              {emailToName[event.actor_email] || event.actor_email}
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {format(new Date(event.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                            </span>
                          </div>
                          {(event.payload as any)?.comment && (
                            <p className="text-muted-foreground">
                              {(event.payload as any)?.comment}
                            </p>
                          )}
                          {/* Image thumbnails */}
                          {imageAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {imageAttachments.map((att) => (
                                <div
                                  key={att.id}
                                  className="relative group cursor-pointer"
                                  onClick={() => handleImagePreview(att)}
                                >
                                  {attachmentUrls[att.id] ? (
                                    <img
                                      src={attachmentUrls[att.id]}
                                      alt={att.file_name}
                                      className="h-16 w-16 object-cover rounded border hover:opacity-80 transition-opacity"
                                    />
                                  ) : (
                                    <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center">
                                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Other attachments */}
                          {otherAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {otherAttachments.map((att) => (
                                <Button
                                  key={att.id}
                                  variant="outline"
                                  size="sm"
                                  className="h-auto py-1 px-2 text-xs"
                                  onClick={() => handleDownloadAttachment(att)}
                                >
                                  <span className="mr-1">{getFileIcon(att.file_type)}</span>
                                  <span className="truncate max-w-[120px]">{att.file_name}</span>
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attachments Section */}
      {attachments && attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Документи
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 rounded-md border bg-muted/30 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">{getFileIcon(attachment.file_type)}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{attachment.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.file_size)} • {format(new Date(attachment.created_at), 'dd.MM.yyyy', { locale: uk })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownloadAttachment(attachment)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {isAuthor && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteAttachment(attachment)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{translations.requestDetail.sections.eventTimeline}</CardTitle>
        </CardHeader>
        <CardContent>
          {events && events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event) => {
                const getEventDescription = () => {
                  const payload = event.payload as any;
                  if (event.event_type === 'FIELD_UPDATED' && payload?.field) {
                    if (payload.field === 'priority') {
                      return `Змінено пріоритет на "${t.priority(payload.to)}"`;
                    }
                    if (payload.field === 'complexity_level') {
                      const complexityLabels: Record<string, string> = {
                        'EASY': '1 – Легкий',
                        'MEDIUM': '2 – Середній',
                        'COMPLEX': '3 – Складний',
                        'EXPERT': '4 – Надскладний'
                      };
                      return `Змінено рівень складності на "${complexityLabels[payload.to] || payload.to}"`;
                    }
                    if (payload.field === 'eta_first_stage') {
                      return `Встановлено термін: ${payload.to ? format(new Date(payload.to), 'dd.MM.yyyy') : 'не вказано'}`;
                    }
                  }
                  if (event.event_type === 'FEEDBACK_ADDED') {
                    return 'Додано коментар';
                  }
                  return t.eventType(event.event_type);
                };

                return (
                  <div key={event.id} className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-sm">
                    <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">{format(new Date(event.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}</div>
                    <div className="break-words"><span className="font-medium">{getEventDescription()}</span><span className="text-muted-foreground"> - {emailToName[event.actor_email] || event.actor_email}</span></div>
                  </div>
                );
              })}
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
            {/* File upload section */}
            <div className="space-y-2">
              <Label>Прикріпити файли</Label>
              <div className="border-2 border-dashed rounded-lg p-4">
                <input
                  type="file"
                  multiple
                  onChange={handleEditFileSelect}
                  className="hidden"
                  id="edit-file-input"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar,.7z"
                />
                <label
                  htmlFor="edit-file-input"
                  className="flex flex-col items-center justify-center gap-2 cursor-pointer text-center"
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Натисніть для вибору файлів
                  </span>
                  <span className="text-xs text-muted-foreground">
                    До 5 МБ на файл
                  </span>
                </label>
              </div>
              {editPendingFiles.length > 0 && (
                <div className="space-y-2 mt-2">
                  {editPendingFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{getFileIcon(file.type)}</span>
                        <span className="truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeEditPendingFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setEditPendingFiles([]); }}>
              Скасувати
            </Button>
            <Button onClick={handleEditRequest} disabled={submitting || uploadingFiles}>
              {(submitting || uploadingFiles) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploadingFiles ? 'Завантаження...' : 'Зберегти'}
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

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImageUrl} onOpenChange={(open) => { if (!open) { setPreviewImageUrl(null); setPreviewImageName(''); } }}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader className="p-2">
            <DialogTitle className="text-sm truncate">{previewImageName}</DialogTitle>
          </DialogHeader>
          {previewImageUrl && (
            <div className="flex items-center justify-center max-h-[70vh] overflow-auto">
              <img 
                src={previewImageUrl} 
                alt={previewImageName}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          )}
          <DialogFooter className="p-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (previewImageUrl) {
                  const link = document.createElement('a');
                  link.href = previewImageUrl;
                  link.download = previewImageName;
                  link.target = '_blank';
                  link.click();
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Завантажити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
