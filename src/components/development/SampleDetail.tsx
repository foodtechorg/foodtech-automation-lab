import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
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
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Save, Lock, Archive, FlaskConical, Copy, Send, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchSampleWithIngredients,
  recalculateSampleIngredients,
  prepareSample,
  archiveSample,
  updateLotNumbers,
  copySample,
  transitionToLab,
  DevelopmentSampleIngredient,
  isPostHandoffStatus,
} from '@/services/samplesApi';
import { initializeLabResults } from '@/services/labResultsApi';
import { LabResultsForm } from './LabResultsForm';
import { PilotResultsForm } from './PilotResultsForm';
import { SampleStatusTracker } from './SampleStatusTracker';
import { NextStepsBlock } from './NextStepsBlock';
import { HandoffDialog } from './HandoffDialog';
import { initializePilotResults } from '@/services/pilotResultsApi';
import { updateSampleStatus } from '@/services/samplesApi';

interface SampleDetailProps {
  sampleId: string;
  onBack: () => void;
  onOpenRecipe?: (recipeId: string) => void;
  onSampleCopied?: (sampleId: string) => void;
  canEdit?: boolean;
}

interface IngredientRow extends DevelopmentSampleIngredient {
  localLotNumber: string;
  hasError?: boolean;
}

export function SampleDetail({ sampleId, onBack, onOpenRecipe, onSampleCopied, canEdit = true }: SampleDetailProps) {
  const queryClient = useQueryClient();
  const [batchWeight, setBatchWeight] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [prepareDialogOpen, setPrepareDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [handoffDialogOpen, setHandoffDialogOpen] = useState(false);


  const { data, isLoading } = useQuery({
    queryKey: ['development-sample', sampleId],
    queryFn: () => fetchSampleWithIngredients(sampleId)
  });

  const sample = data?.sample;
  const isDraft = sample?.status === 'Draft';
  const isPrepared = sample?.status === 'Prepared';
  const isLab = sample?.status === 'Lab';
  const isLabDone = sample?.status === 'LabDone';
  const isPilot = sample?.status === 'Pilot';
  const isPilotDone = sample?.status === 'PilotDone';
  const isArchived = sample?.status === 'Archived';
  const isTesting = sample?.status === 'Testing';
  const isApproved = sample?.status === 'Approved';
  const isRejected = sample?.status === 'Rejected';
  const isPostHandoff = sample?.status && isPostHandoffStatus(sample.status);
  const isReadOnly = !isDraft;
  const showLabSection = isLab || isLabDone || (sample?.status && ['Pilot', 'PilotDone', 'Testing', 'Approved', 'Rejected', 'ReadyForHandoff', 'HandedOff'].includes(sample.status));
  const showPilotSection = isLabDone || isPilot || isPilotDone || (sample?.status && ['Testing', 'Approved', 'Rejected', 'ReadyForHandoff', 'HandedOff'].includes(sample.status));

  // Extract recipe code from sample code (e.g., RD-0015/01/01 -> RD-0015/01)
  const recipeCode = sample?.sample_code?.split('/').slice(0, 2).join('/') ?? '';

  // Initialize form data
  useEffect(() => {
    if (data) {
      setBatchWeight(data.sample.batch_weight_g.toString());
      setIngredients(
        data.ingredients.map((ing) => ({
          ...ing,
          localLotNumber: ing.lot_number || '',
          hasError: false
        }))
      );
      setHasChanges(false);
    }
  }, [data]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalRecipeGrams = ingredients.reduce((sum, ing) => sum + ing.recipe_grams, 0);
    const totalRequiredGrams = ingredients.reduce((sum, ing) => sum + ing.required_grams, 0);
    return { totalRecipeGrams, totalRequiredGrams };
  }, [ingredients]);

  // Handle batch weight change with debounce
  const recalculateMutation = useMutation({
    mutationFn: (newWeight: number) => recalculateSampleIngredients(sampleId, newWeight),
    onSuccess: (result) => {
      // Use functional update to preserve local lot numbers
      setIngredients((prevIngredients) =>
        result.ingredients.map((ing) => {
          const prevIng = prevIngredients.find(i => i.id === ing.id);
          return {
            ...ing,
            localLotNumber: prevIng?.localLotNumber ?? ing.lot_number ?? '',
            hasError: false
          };
        })
      );
      queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
    },
    onError: (error: Error) => {
      toast.error(`Помилка перерахунку: ${error.message}`);
      // Reset to original weight
      if (data) {
        setBatchWeight(data.sample.batch_weight_g.toString());
      }
    }
  });

  const handleBatchWeightChange = (value: string) => {
    setBatchWeight(value);
    setHasChanges(true);
  };

  const handleBatchWeightBlur = () => {
    const newWeight = parseFloat(batchWeight);
    if (!isNaN(newWeight) && newWeight > 0 && data && newWeight !== data.sample.batch_weight_g) {
      recalculateMutation.mutate(newWeight);
    }
  };

  // Handle lot number changes
  const handleLotNumberChange = (index: number, value: string) => {
    setIngredients((prev) =>
      prev.map((ing, i) => 
        i === index 
          ? { ...ing, localLotNumber: value, hasError: false }
          : ing
      )
    );
    setHasChanges(true);
  };

  // Save lot numbers
  const saveLotsMutation = useMutation({
    mutationFn: async () => {
      const updates = ingredients
        .filter(ing => ing.localLotNumber !== (ing.lot_number || ''))
        .map(ing => ({
          id: ing.id,
          lot_number: ing.localLotNumber.trim()
        }));
      
      if (updates.length > 0) {
        await updateLotNumbers(updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
      setHasChanges(false);
      toast.success('Дані збережено');
    },
    onError: (error: Error) => {
      toast.error(`Помилка збереження: ${error.message}`);
    }
  });

  // Prepare sample (Draft -> Prepared)
  const prepareMutation = useMutation({
    mutationFn: async () => {
      // First save lot numbers
      const updates = ingredients.map(ing => ({
        id: ing.id,
        lot_number: ing.localLotNumber.trim()
      }));
      
      await updateLotNumbers(updates);
      
      // Then prepare
      return prepareSample(sampleId);
    },
    onSuccess: (preparedSample) => {
      queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-samples'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      setPrepareDialogOpen(false);
      setHasChanges(false);
      toast.success(`Зразок ${preparedSample.sample_code} підготовлено`);
    },
    onError: (error: Error) => {
      toast.error(`Помилка підготовки: ${error.message}`);
    }
  });

  // Archive sample
  const archiveMutation = useMutation({
    mutationFn: () => archiveSample(sampleId),
    onSuccess: (archivedSample) => {
      queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-samples'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      setArchiveDialogOpen(false);
      toast.success(`Зразок ${archivedSample.sample_code} архівовано`);
      onBack();
    },
    onError: (error: Error) => {
      toast.error(`Помилка архівації: ${error.message}`);
    }
  });

  // Copy sample
  const copyMutation = useMutation({
    mutationFn: () => copySample(sampleId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['development-samples'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      toast.success(`Зразок скопійовано як ${result.sample.sample_code}`);
      onSampleCopied?.(result.sample.id);
    },
    onError: (error: Error) => {
      toast.error(`Помилка копіювання: ${error.message}`);
    }
  });

  // Transition to Lab (without dialog, directly)
  const labTransitionMutation = useMutation({
    mutationFn: async () => {
      // Initialize empty lab results record
      await initializeLabResults(sampleId);
      // Transition status
      return transitionToLab(sampleId);
    },
    onSuccess: (updatedSample) => {
      queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-samples'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      toast.success(`Зразок ${updatedSample.sample_code} передано в лабораторію`);
    },
    onError: (error: Error) => {
      toast.error(`Помилка: ${error.message}`);
    }
  });

  // Transition to Pilot (without dialog, directly)
  const pilotTransitionMutation = useMutation({
    mutationFn: async () => {
      // Initialize empty pilot results record
      await initializePilotResults(sampleId);
      // Transition status
      return updateSampleStatus(sampleId, 'Pilot');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot-results', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-samples'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      toast.success('Зразок передано на дегустацію');
    },
    onError: (error: Error) => {
      toast.error(`Помилка: ${error.message}`);
    }
  });

  const handlePrepareClick = () => {
    const weight = parseFloat(batchWeight);
    if (isNaN(weight) || weight <= 0) {
      toast.error('Партія має бути числом більше 0');
      return;
    }
    setPrepareDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!sample) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Зразок не знайдено</h2>
        <Button onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад до списку
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold font-mono">{sample.sample_code}</h2>
                {/* Status badges for Testing/Approved/Rejected */}
                {isTesting && (
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    <Send className="h-3 w-3 mr-1" />
                    Тестування
                  </Badge>
                )}
                {isApproved && (
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Погоджений
                  </Badge>
                )}
                {isRejected && (
                  <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <XCircle className="h-3 w-3 mr-1" />
                    Відхилений
                  </Badge>
                )}
              </div>
              {/* Working title display for post-handoff statuses */}
              {isPostHandoff && sample.working_title && (
                <p className="font-medium text-primary">
                  {sample.working_title} ({sample.sample_code})
                </p>
              )}
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <span>{isReadOnly ? 'Перегляд зразка' : 'Редагування зразка'}</span>
                {onOpenRecipe && (
                  <>
                    <span>•</span>
                    <Button 
                      variant="link" 
                      className="text-sm h-auto p-0"
                      onClick={() => onOpenRecipe(sample.recipe_id)}
                    >
                      <FlaskConical className="h-3 w-3 mr-1" />
                      Рецепт: {recipeCode}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons based on status */}
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && isDraft && (
              <>
                <Button
                  variant="outline"
                  onClick={() => saveLotsMutation.mutate()}
                  disabled={saveLotsMutation.isPending || !hasChanges}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveLotsMutation.isPending ? 'Збереження...' : 'Зберегти чернетку'}
                </Button>
                <Button
                  onClick={handlePrepareClick}
                  disabled={prepareMutation.isPending}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Зафіксувати зразок
                </Button>
              </>
            )}

            {canEdit && isPrepared && (
              <>
                <Button
                  variant="outline"
                  onClick={() => copyMutation.mutate()}
                  disabled={copyMutation.isPending}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copyMutation.isPending ? 'Копіювання...' : 'Копіювати зразок'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setArchiveDialogOpen(true)}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Архівувати
                </Button>
              </>
            )}

            {canEdit && (isLab || isLabDone || isPilot || isPilotDone) && !isPostHandoff && (
              <>
                <Button
                  variant="outline"
                  onClick={() => copyMutation.mutate()}
                  disabled={copyMutation.isPending}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copyMutation.isPending ? 'Копіювання...' : 'Копіювати зразок'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setArchiveDialogOpen(true)}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Архівувати
                </Button>
              </>
            )}

            {/* Post-handoff: only view mode, no actions */}
            {isPostHandoff && (
              <span className="text-sm text-muted-foreground">
                Зразок передано на тестування
              </span>
            )}
          </div>
        </div>

        {/* Status Tracker */}
        <SampleStatusTracker status={sample.status} />
      </div>

      {/* Batch weight */}
      <Card>
        <CardHeader>
          <CardTitle>Партія зразка</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="batch-weight">Вага партії, г</Label>
              {isDraft ? (
                <Input
                  id="batch-weight"
                  type="number"
                  value={batchWeight}
                  onChange={(e) => handleBatchWeightChange(e.target.value)}
                  onBlur={handleBatchWeightBlur}
                  min="0.001"
                  step="0.001"
                  className="font-mono"
                  disabled={recalculateMutation.isPending}
                />
              ) : (
                <p className="font-mono text-lg">{sample.batch_weight_g.toFixed(3)} г</p>
              )}
            </div>
            {recalculateMutation.isPending && (
              <p className="text-sm text-muted-foreground">Перерахунок...</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <Card>
        <CardHeader>
          <CardTitle>Інгредієнти зразка</CardTitle>
        </CardHeader>
        <CardContent>
          {ingredients.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Інгредієнт</TableHead>
                    <TableHead className="w-32 text-right">Рецепт, %</TableHead>
                    <TableHead className="w-32 text-right">Потрібно, г</TableHead>
                    <TableHead className="w-48">Партія сировини</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ingredients.map((ing, index) => (
                    <TableRow key={ing.id}>
                      <TableCell className="font-medium">{ing.ingredient_name}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {totals.totalRecipeGrams > 0 
                          ? ((ing.recipe_grams / totals.totalRecipeGrams) * 100).toFixed(2)
                          : '0.00'}%
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {ing.required_grams.toFixed(3)}
                      </TableCell>
                      <TableCell>
                        {isDraft ? (
                          <Input
                            value={ing.localLotNumber}
                            onChange={(e) => handleLotNumberChange(index, e.target.value)}
                            placeholder="Введіть номер партії"
                          />
                        ) : (
                          <span className="font-mono">{ing.lot_number || '—'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Всього</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      100.00%
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {totals.totalRequiredGrams.toFixed(3)} г
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Інгредієнтів немає
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lab Section - show for Lab/LabDone statuses */}
      {showLabSection && sample && (
        <LabResultsForm
          sampleId={sampleId}
          sampleStatus={sample.status}
          onLabCompleted={() => {
            queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
          }}
          canEdit={canEdit}
        />
      )}

      {/* Pilot Section - show for LabDone/Pilot/PilotDone and later */}
      {showPilotSection && sample && (
        <PilotResultsForm
          sampleId={sampleId}
          sampleStatus={sample.status}
          onPilotCompleted={() => {
            queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
          }}
          canEdit={canEdit}
        />
      )}

      {/* Next Steps Block - visible for Prepared and later (except Archived) */}
      {sample && (
        <NextStepsBlock
          sampleId={sampleId}
          sampleStatus={sample.status}
          onTransitionToLab={() => labTransitionMutation.mutate()}
          onTransitionToPilot={() => pilotTransitionMutation.mutate()}
          onTransitionToHandoff={() => setHandoffDialogOpen(true)}
          isLabTransitioning={labTransitionMutation.isPending}
          isPilotTransitioning={pilotTransitionMutation.isPending}
          canEdit={canEdit}
        />
      )}

      {/* Handoff Dialog */}
      {sample && (
        <HandoffDialog
          open={handoffDialogOpen}
          onOpenChange={setHandoffDialogOpen}
          sampleId={sampleId}
          sampleCode={sample.sample_code}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
          }}
        />
      )}

      {/* Prepare Confirmation Dialog */}
      <AlertDialog open={prepareDialogOpen} onOpenChange={setPrepareDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Зафіксувати зразок?</AlertDialogTitle>
            <AlertDialogDescription>
              Після фіксації зразок {sample.sample_code} стане доступним для лабораторного аналізу.
              Ви не зможете змінювати партію та партії сировини.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => prepareMutation.mutate()}
              disabled={prepareMutation.isPending}
            >
              {prepareMutation.isPending ? 'Фіксація...' : 'Зафіксувати'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архівувати зразок?</AlertDialogTitle>
            <AlertDialogDescription>
              Зразок {sample.sample_code} буде переміщено в архів.
              Ви зможете переглядати його, але не зможете редагувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveMutation.mutate()}
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
