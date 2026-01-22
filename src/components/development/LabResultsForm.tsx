import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Microscope, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchLabResults,
  upsertLabResults,
  validateLabResults,
  labFieldsConfig,
  LabResults,
} from '@/services/labResultsApi';
import { completeLabAnalysis } from '@/services/samplesApi';
import { DevelopmentSampleStatus } from '@/services/samplesApi';

interface LabResultsFormProps {
  sampleId: string;
  sampleStatus: DevelopmentSampleStatus;
  onLabCompleted?: () => void;
  canEdit?: boolean;
}

type LabFormData = Partial<Omit<LabResults, 'id' | 'sample_id' | 'created_at' | 'updated_at'>>;

export function LabResultsForm({ sampleId, sampleStatus, onLabCompleted, canEdit = true }: LabResultsFormProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<LabFormData>({});
  const [hasChanges, setHasChanges] = useState(false);

  const isLabStatus = sampleStatus === 'Lab';
  const isLabDone = sampleStatus === 'LabDone';
  const isReadOnly = !isLabStatus || !canEdit;

  // Fetch existing lab results
  // Load lab results for all stages where they should be visible (Lab through HandedOff)
  const shouldLoadLabResults = ['Lab', 'LabDone', 'Pilot', 'PilotDone', 'ReadyForHandoff', 'HandedOff'].includes(sampleStatus);
  
  const { data: labResults, isLoading } = useQuery({
    queryKey: ['lab-results', sampleId],
    queryFn: () => fetchLabResults(sampleId),
    enabled: shouldLoadLabResults
  });

  // Initialize form data when results are loaded
  useEffect(() => {
    if (labResults) {
      const data: LabFormData = {};
      labFieldsConfig.forEach(field => {
        const value = labResults[field.key as keyof LabResults];
        if (value !== null && value !== undefined) {
          data[field.key] = value as never;
        }
      });
      setFormData(data);
      setHasChanges(false);
    }
  }, [labResults]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () => upsertLabResults(sampleId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-results', sampleId] });
      setHasChanges(false);
      toast.success('Лабораторні дані збережено');
    },
    onError: (error: Error) => {
      toast.error(`Помилка збереження: ${error.message}`);
    }
  });

  // Complete lab mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      // First save any pending changes
      await upsertLabResults(sampleId, formData);
      // Then complete lab
      return completeLabAnalysis(sampleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-results', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-sample', sampleId] });
      queryClient.invalidateQueries({ queryKey: ['development-samples'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-samples'] });
      toast.success('Лабораторні результати зафіксовано');
      onLabCompleted?.();
    },
    onError: (error: Error) => {
      toast.error(`Помилка: ${error.message}`);
    }
  });

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [key]: value === '' ? null : (labFieldsConfig.find(f => f.key === key)?.type === 'number' ? parseFloat(value) : value)
    }));
    setHasChanges(true);
  };

  const handleCompleteClick = () => {
    // Validate before completing
    const validation = validateLabResults({ ...labResults, ...formData } as LabResults);
    if (!validation.isValid) {
      toast.error(validation.errorMessage);
      return;
    }
    // Directly complete without dialog
    completeMutation.mutate();
  };

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Microscope className="h-5 w-5" />
            Лабораторія
            {isLabDone && (
              <Badge variant="outline" className="bg-primary/10 text-primary">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Зафіксовано
              </Badge>
            )}
          </CardTitle>
          {isLabStatus && canEdit && (
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
                {completeMutation.isPending ? 'Фіксація...' : 'Зафіксувати результати'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {labFieldsConfig.map(field => {
            const value = formData[field.key] ?? '';
            
            return (
              <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2 lg:col-span-3' : ''}>
                <Label htmlFor={field.key} className="text-sm">
                  {field.label}
                  {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    id={field.key}
                    value={value?.toString() ?? ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    disabled={isReadOnly}
                    placeholder={isReadOnly ? '—' : `Введіть ${field.label.toLowerCase()}`}
                    className="mt-1.5"
                    rows={3}
                  />
                ) : (
                  <Input
                    id={field.key}
                    type={field.type}
                    value={value?.toString() ?? ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    disabled={isReadOnly}
                    placeholder={isReadOnly ? '—' : `0`}
                    className="mt-1.5 font-mono"
                    step={field.type === 'number' ? '0.001' : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
