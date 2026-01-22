import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Archive, TestTubes, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import {
  fetchSamplesByRequestId,
  archiveSample,
  copySample,
  DevelopmentSample
} from '@/services/samplesApi';
import { SampleStatusTracker } from './SampleStatusTracker';

interface SamplesListProps {
  requestId: string;
  onOpenSample: (sampleId: string) => void;
  canEdit?: boolean;
}

export function SamplesList({ requestId, onOpenSample, canEdit = true }: SamplesListProps) {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [archiveDialogSample, setArchiveDialogSample] = useState<DevelopmentSample | null>(null);


  const { data: samples, isLoading } = useQuery({
    queryKey: ['development-samples', requestId, showArchived],
    queryFn: () => fetchSamplesByRequestId(requestId, showArchived)
  });

  const archiveMutation = useMutation({
    mutationFn: (sampleId: string) => archiveSample(sampleId),
    onSuccess: (archivedSample) => {
      queryClient.invalidateQueries({ queryKey: ['development-samples', requestId] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      toast.success(`Зразок ${archivedSample.sample_code} архівовано`);
      setArchiveDialogSample(null);
    },
    onError: (error: Error) => {
      toast.error(`Помилка архівації: ${error.message}`);
    }
  });

  const copyMutation = useMutation({
    mutationFn: (sampleId: string) => copySample(sampleId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['development-samples', requestId] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      toast.success(`Зразок скопійовано як ${result.sample.sample_code}`);
      onOpenSample(result.sample.id);
    },
    onError: (error: Error) => {
      toast.error(`Помилка копіювання: ${error.message}`);
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const hasSamples = samples && samples.length > 0;

  return (
    <div className="space-y-4">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Лабораторні зразки рецептів</h3>
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived" className="text-sm text-muted-foreground">
            Показати архівні
          </Label>
        </div>
      </div>

      {/* Empty state */}
      {!hasSamples && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <TestTubes className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Зразків ще немає</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Щоб створити зразок, перейдіть до рецепту зі статусом "В роботі"
            та натисніть кнопку "Виготовити зразок".
          </p>
        </div>
      )}

      {/* Samples table */}
      {hasSamples && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Код зразка</TableHead>
                <TableHead>Рецепт</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Партія, г</TableHead>
                <TableHead>Створено</TableHead>
                <TableHead className="w-24 text-right">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {samples.map((sample) => {
                const isArchived = sample.status === 'Archived';
                const isPrepared = sample.status === 'Prepared';
                // Extract recipe code from sample code (e.g., RD-0015/01/01 -> RD-0015/01)
                const recipeCode = sample.sample_code.split('/').slice(0, 2).join('/');
                
                return (
                  <TableRow
                    key={sample.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onOpenSample(sample.id)}
                  >
                    <TableCell className="font-mono font-medium">
                      {sample.sample_code}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {recipeCode}
                    </TableCell>
                    <TableCell>
                      <SampleStatusTracker status={sample.status} compact />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {sample.batch_weight_g.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(sample.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && isPrepared && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyMutation.mutate(sample.id);
                            }}
                            disabled={copyMutation.isPending}
                            title="Копіювати зразок"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {canEdit && !isArchived && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setArchiveDialogSample(sample);
                            }}
                            title="Архівувати"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Archive confirmation dialog */}
      <AlertDialog
        open={!!archiveDialogSample}
        onOpenChange={(open) => !open && setArchiveDialogSample(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архівувати зразок?</AlertDialogTitle>
            <AlertDialogDescription>
              Зразок {archiveDialogSample?.sample_code} буде переміщено в архів.
              Ви зможете переглядати його, але не зможете редагувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveDialogSample && archiveMutation.mutate(archiveDialogSample.id)}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? 'Архівація...' : 'Архівувати'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
