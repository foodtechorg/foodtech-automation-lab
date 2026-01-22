import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FlaskConical, CheckCircle2, XCircle, Clock, Send, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  fetchTestingSamplesByRequestId,
  setTestingResult,
  declineRequestFromTesting,
  testingSampleStatusLabels,
  testingSampleStatusColors,
  TestingSample,
} from '@/services/testingSamplesApi';

interface TestingSamplesSectionProps {
  requestId: string;
  requestStatus: string;
  isAuthor: boolean;
  successfulSampleDisplay?: string | null;
  onStatusChange?: () => void;
}

export function TestingSamplesSection({
  requestId,
  requestStatus,
  isAuthor,
  successfulSampleDisplay,
  onStatusChange,
}: TestingSamplesSectionProps) {
  const queryClient = useQueryClient();
  const [selectedSample, setSelectedSample] = useState<TestingSample | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [declineComment, setDeclineComment] = useState('');

  const { data: testingSamples, isLoading } = useQuery({
    queryKey: ['testing-samples', requestId],
    queryFn: () => fetchTestingSamplesByRequestId(requestId),
    enabled: !!requestId,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ result, comment }: { result: 'Approved' | 'Rejected'; comment?: string }) => {
      if (!selectedSample) throw new Error('No sample selected');
      return setTestingResult(selectedSample.id, result, comment);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['testing-samples', requestId] });
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      setReviewDialogOpen(false);
      setSelectedSample(null);
      setComment('');
      
      if (data.result === 'Approved') {
        toast.success('Зразок погоджено! Заявку закрито.');
      } else {
        toast.success('Результат зафіксовано');
      }
      
      onStatusChange?.();
    },
    onError: (error: Error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const declineMutation = useMutation({
    mutationFn: (comment?: string) => declineRequestFromTesting(requestId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testing-samples', requestId] });
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      setDeclineDialogOpen(false);
      setDeclineComment('');
      toast.success('Відмову зафіксовано');
      onStatusChange?.();
    },
    onError: (error: Error) => {
      toast.error(`Помилка: ${error.message}`);
    },
  });

  const handleOpenReview = (sample: TestingSample) => {
    setSelectedSample(sample);
    setComment(sample.manager_comment || '');
    setReviewDialogOpen(true);
  };

  const handleApprove = () => {
    reviewMutation.mutate({ result: 'Approved', comment: comment.trim() || undefined });
  };

  const handleReject = () => {
    reviewMutation.mutate({ result: 'Rejected', comment: comment.trim() || undefined });
  };

  const handleDecline = () => {
    declineMutation.mutate(declineComment.trim() || undefined);
  };

  const getStatusIcon = (status: TestingSample['status']) => {
    switch (status) {
      case 'Sent':
        return <Clock className="h-4 w-4" />;
      case 'Approved':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'Rejected':
        return <XCircle className="h-4 w-4" />;
    }
  };

  // Show successful sample banner for APPROVED_FOR_PRODUCTION
  if (requestStatus === 'APPROVED_FOR_PRODUCTION' && successfulSampleDisplay) {
    return (
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-700 dark:text-emerald-300">
                Успішний зразок
              </p>
              <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                {successfulSampleDisplay}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Only show for SENT_FOR_TEST status or when there are testing samples
  if (requestStatus !== 'SENT_FOR_TEST' && (!testingSamples || testingSamples.length === 0)) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasSentSamples = testingSamples?.some((s) => s.status === 'Sent');

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Зразки на тестуванні
            </CardTitle>
            {isAuthor && hasSentSamples && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive hover:bg-destructive/10"
                onClick={() => setDeclineDialogOpen(true)}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Відмовитись від розробки
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!testingSamples || testingSamples.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Зразки ще не відправлено на тестування</p>
              <p className="text-sm mt-1">
                Зразки на тестування відправляються з модуля "Розробка"
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Зразок</TableHead>
                    <TableHead className="w-32">Статус</TableHead>
                    <TableHead className="w-36">Відправлено</TableHead>
                    <TableHead className="w-24">Дія</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {testingSamples.map((sample) => (
                    <TableRow key={sample.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sample.display_name}</p>
                          {sample.manager_comment && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {sample.manager_comment}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('gap-1', testingSampleStatusColors[sample.status])}
                        >
                          {getStatusIcon(sample.status)}
                          {testingSampleStatusLabels[sample.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(sample.sent_at), 'dd.MM.yyyy', { locale: uk })}
                      </TableCell>
                      <TableCell>
                        {isAuthor && sample.status === 'Sent' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenReview(sample)}
                          >
                            Оцінити
                          </Button>
                        ) : sample.status !== 'Sent' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenReview(sample)}
                          >
                            Деталі
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Результат тестування</DialogTitle>
            <DialogDescription>
              {selectedSample?.display_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedSample?.status !== 'Sent' && (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn('gap-1', testingSampleStatusColors[selectedSample?.status || 'Sent'])}
                >
                  {selectedSample && getStatusIcon(selectedSample.status)}
                  {selectedSample && testingSampleStatusLabels[selectedSample.status]}
                </Badge>
                {selectedSample?.reviewed_at && (
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(selectedSample.reviewed_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="review-comment">Коментар</Label>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Введіть коментар про результати тестування..."
                rows={4}
                disabled={selectedSample?.status !== 'Sent' || !isAuthor}
              />
            </div>
          </div>

          <DialogFooter>
            {selectedSample?.status === 'Sent' && isAuthor ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setReviewDialogOpen(false)}
                  disabled={reviewMutation.isPending}
                >
                  Скасувати
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={reviewMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {reviewMutation.isPending ? 'Обробка...' : 'Не погоджено'}
                </Button>
                <Button onClick={handleApprove} disabled={reviewMutation.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {reviewMutation.isPending ? 'Обробка...' : 'Погоджено'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                Закрити
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Відмовитись від розробки
            </DialogTitle>
            <DialogDescription>
              Ви впевнені, що хочете повністю відмовитись від цієї розробки?
              Всі відправлені зразки будуть позначені як відхилені.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="decline-comment">Причина відмови</Label>
              <Textarea
                id="decline-comment"
                value={declineComment}
                onChange={(e) => setDeclineComment(e.target.value)}
                placeholder="Введіть причину відмови..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclineDialogOpen(false)}
              disabled={declineMutation.isPending}
            >
              Скасувати
            </Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={declineMutation.isPending}
            >
              {declineMutation.isPending ? 'Обробка...' : 'Підтвердити відмову'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
