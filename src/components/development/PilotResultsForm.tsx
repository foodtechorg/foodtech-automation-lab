import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardList, Save, CheckCircle2, CalendarIcon, Send } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  fetchPilotResults,
  upsertPilotResults,
  initializePilotResults,
  validatePilotResults,
  pilotScoreFieldsConfig,
  pilotDirectionOptions,
  PilotFormData,
  PilotResults,
} from '@/services/pilotResultsApi';
import { updateSampleStatus, DevelopmentSampleStatus } from '@/services/samplesApi';

interface PilotResultsFormProps {
  sampleId: string;
  sampleStatus: DevelopmentSampleStatus;
  onPilotCompleted?: () => void;
}

// Score options 1-10
const scoreOptions = Array.from({ length: 10 }, (_, i) => i + 1);

export function PilotResultsForm({ sampleId, sampleStatus, onPilotCompleted }: PilotResultsFormProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<PilotFormData>({});
  const [hasChanges, setHasChanges] = useState(false);

  const isLabDone = sampleStatus === 'LabDone';
  const isPilot = sampleStatus === 'Pilot';
  const isPilotDone = sampleStatus === 'PilotDone';
  const showForm = isPilot || isPilotDone;
  const isReadOnly = isPilotDone;

  // Fetch existing pilot results
  const { data: pilotResults, isLoading } = useQuery({
    queryKey: ['pilot-results', sampleId],
    queryFn: () => fetchPilotResults(sampleId),
    enabled: showForm
  });

  // Initialize form data when results are loaded
  useEffect(() => {
    if (pilotResults) {
      const data: PilotFormData = {};
      
      // Header fields
      if (pilotResults.tasting_sheet_no) data.tasting_sheet_no = pilotResults.tasting_sheet_no;
      if (pilotResults.tasting_date) data.tasting_date = pilotResults.tasting_date;
      if (pilotResults.direction) data.direction = pilotResults.direction;
      if (pilotResults.tasting_goal) data.tasting_goal = pilotResults.tasting_goal;
      
      // Score fields
      pilotScoreFieldsConfig.forEach(field => {
        const value = pilotResults[field.key as keyof PilotResults];
        if (value !== null && value !== undefined) {
          (data as Record<string, unknown>)[field.key] = value;
        }
      });
      
      // Comment
      if (pilotResults.comment) data.comment = pilotResults.comment;
      
      setFormData(data);
      setHasChanges(false);
    }
  }, [pilotResults]);

  // Transition to Pilot mutation
  const transitionToPilotMutation = useMutation({
    mutationFn: async () => {
      await initializePilotResults(sampleId);
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

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => upsertPilotResults(sampleId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot-results', sampleId] });
      setHasChanges(false);
      toast.success('Дані дегустації збережено');
    },
    onError: (error: Error) => {
      toast.error(`Помилка збереження: ${error.message}`);
    }
  });

  // Complete pilot mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      // First save any pending changes
      await upsertPilotResults(sampleId, formData);
      // Then transition to PilotDone
      return updateSampleStatus(sampleId, 'PilotDone');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot-results', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-samples'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      toast.success('Результати дегустації зафіксовано');
      onPilotCompleted?.();
    },
    onError: (error: Error) => {
      toast.error(`Помилка: ${error.message}`);
    }
  });

  const handleFieldChange = (key: string, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [key]: value === '' ? null : value
    }));
    setHasChanges(true);
  };

  const handleDateChange = (date: Date | undefined) => {
    setFormData(prev => ({
      ...prev,
      tasting_date: date ? format(date, 'yyyy-MM-dd') : null
    }));
    setHasChanges(true);
  };

  const handleCompleteClick = () => {
    // Validate before completing
    const validation = validatePilotResults(formData);
    if (!validation.isValid) {
      toast.error(validation.errorMessage);
      return;
    }
    completeMutation.mutate();
  };

  // Show CTA for LabDone status
  if (isLabDone) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <ClipboardList className="h-5 w-5" />
            Пілот / Дегустація
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => transitionToPilotMutation.mutate()}
            disabled={transitionToPilotMutation.isPending}
            className="w-full md:w-auto"
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            {transitionToPilotMutation.isPending ? 'Передача...' : 'Перейти до дегустації'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show placeholder for statuses before LabDone
  if (!showForm) {
    return (
      <Card className="border-dashed opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <ClipboardList className="h-5 w-5" />
            Пілот / Дегустація
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Доступно після завершення лабораторного аналізу
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const selectedDate = formData.tasting_date ? parseISO(formData.tasting_date) : undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Пілот / Дегустація
            {isPilotDone && (
              <Badge variant="outline" className="bg-primary/10 text-primary">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Зафіксовано
              </Badge>
            )}
          </CardTitle>
          {isPilot && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !hasChanges}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Збереження...' : 'Зберегти'}
              </Button>
              <Button
                size="sm"
                onClick={handleCompleteClick}
                disabled={completeMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {completeMutation.isPending ? 'Фіксація...' : 'Зафіксувати дегустацію'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Header fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="tasting_sheet_no" className="text-sm">
              № дегустаційного листа
            </Label>
            <Input
              id="tasting_sheet_no"
              value={formData.tasting_sheet_no || ''}
              onChange={(e) => handleFieldChange('tasting_sheet_no', e.target.value)}
              disabled={isReadOnly}
              placeholder={isReadOnly ? '—' : 'Введіть номер'}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label className="text-sm">Дата</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full mt-1.5 justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                  disabled={isReadOnly}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'dd.MM.yyyy', { locale: uk }) : 'Оберіть дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateChange}
                  initialFocus
                  locale={uk}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-sm">Напрямок</Label>
            <Select
              value={formData.direction || ''}
              onValueChange={(value) => handleFieldChange('direction', value)}
              disabled={isReadOnly}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Оберіть напрямок" />
              </SelectTrigger>
              <SelectContent>
                {pilotDirectionOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tasting_goal" className="text-sm">
              Мета дегустації
            </Label>
            <Input
              id="tasting_goal"
              value={formData.tasting_goal || ''}
              onChange={(e) => handleFieldChange('tasting_goal', e.target.value)}
              disabled={isReadOnly}
              placeholder={isReadOnly ? '—' : 'Введіть мету'}
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Score fields */}
        <div>
          <h4 className="text-sm font-medium mb-3">Оцінки (1–10)</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {pilotScoreFieldsConfig.map(field => {
              const value = (formData as Record<string, unknown>)[field.key] as number | null | undefined;
              
              return (
                <div key={field.key}>
                  <Label className="text-sm">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Select
                    value={value?.toString() || ''}
                    onValueChange={(v) => handleFieldChange(field.key, v ? parseInt(v, 10) : null)}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {scoreOptions.map(score => (
                        <SelectItem key={score} value={score.toString()}>
                          {score}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comment */}
        <div>
          <Label htmlFor="comment" className="text-sm">
            Коментар
          </Label>
          <Textarea
            id="comment"
            value={formData.comment || ''}
            onChange={(e) => handleFieldChange('comment', e.target.value)}
            disabled={isReadOnly}
            placeholder={isReadOnly ? '—' : 'Введіть коментар...'}
            className="mt-1.5"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Handoff placeholder component
export function HandoffPlaceholder() {
  return (
    <Card className="border-dashed opacity-60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <Send className="h-5 w-5" />
          Передача на тестування
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Буде реалізовано наступним кроком
        </p>
      </CardContent>
    </Card>
  );
}
