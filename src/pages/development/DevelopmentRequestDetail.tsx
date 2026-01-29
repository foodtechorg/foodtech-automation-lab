import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ClipboardList, FlaskConical, Info } from 'lucide-react';
import { t } from '@/lib/i18n';
import { RecipesList } from '@/components/development/RecipesList';
import { RecipeForm } from '@/components/development/RecipeForm';
import { SamplesList } from '@/components/development/SamplesList';
import { SampleDetail } from '@/components/development/SampleDetail';
import { QuickHandoffBlock } from '@/components/development/QuickHandoffBlock';
import { useAuth } from '@/hooks/useAuth';
import NoAccess from './NoAccess';
import { format } from 'date-fns';

// Statuses allowed in Development module
const DEV_MODULE_STATUSES = ['IN_PROGRESS', 'SENT_FOR_TEST', 'REJECTED_BY_CLIENT', 'APPROVED_FOR_PRODUCTION'];
// Statuses that allow editing
const EDITABLE_STATUSES = ['IN_PROGRESS', 'SENT_FOR_TEST'];

export default function DevelopmentRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('recipes');

  const { data: request, isLoading } = useQuery({
    queryKey: ['development-request', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('email, name');
      if (error) throw error;
      return data;
    }
  });

  const emailToName = profiles?.reduce((acc, p) => {
    acc[p.email] = p.name || p.email;
    return acc;
  }, {} as Record<string, string>) || {};

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Determine access rights based on status
  const isEditableStatus = EDITABLE_STATUSES.includes(request?.status ?? '');
  const hasEditRole = profile?.role === 'admin' || profile?.role === 'rd_dev';
  const canEdit = hasEditRole && isEditableStatus;
  const isReadOnlyStatus = ['REJECTED_BY_CLIENT', 'APPROVED_FOR_PRODUCTION'].includes(request?.status ?? '');

  // Check if this is an EASY complexity request (can use quick handoff)
  const isEasyComplexity = request?.complexity_level === 'EASY';
  const canQuickHandoff = canEdit && isEasyComplexity;

  // Check if rd_dev can access this request (only their own assigned requests)
  const isRdDev = profile?.role === 'rd_dev';
  const isAssignedToUser = request?.responsible_email === profile?.email;

  if (!request) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Заявку не знайдено</h2>
        <p className="text-muted-foreground mb-4">
          Заявка з ID {id} не існує або була видалена
        </p>
        <Button onClick={() => navigate('/development')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          До списку заявок
        </Button>
      </div>
    );
  }

  // Check if request is in valid status for Development module
  if (!DEV_MODULE_STATUSES.includes(request.status)) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Заявка недоступна</h2>
        <p className="text-muted-foreground mb-4">
          Заявка {request.code} має статус "{t.status(request.status)}" і не доступна в модулі "Розробка".
        </p>
        <Button onClick={() => navigate('/development')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          До списку заявок
        </Button>
      </div>
    );
  }

  if (isRdDev && !isAssignedToUser) {
    return <NoAccess />;
  }

  return (
    <div className="space-y-6">
      {/* Read-only banner for finished requests */}
      {isReadOnlyStatus && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Розробка завершена. Заявка доступна лише для перегляду.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/development')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{request.code}</h1>
              <StatusBadge status={request.status as any} />
            </div>
            <p className="text-muted-foreground">Картка заявки в модулі "Розробка"</p>
          </div>
        </div>
      </div>

      {/* Request Info Card - Extended */}
      <Card>
        <CardHeader>
          <CardTitle>Інформація про заявку</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Компанія замовника</label>
              <p className="font-medium">{request.customer_company}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Вид продукту</label>
              <p className="font-medium">{t.domain(request.domain)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Напрямок розробки</label>
              <p className="font-medium">{t.direction(request.direction)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Автор заявки</label>
              <p className="font-medium">
                {request.author_email ? emailToName[request.author_email] || request.author_email : '—'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Дата створення</label>
              <p className="font-medium">
                {request.created_at ? format(new Date(request.created_at), 'dd.MM.yyyy') : '—'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Бажана дата завершення</label>
              <p className="font-medium">
                {request.desired_due_date ? format(new Date(request.desired_due_date), 'dd.MM.yyyy') : 'Не вказано'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Наявність зразка аналогу</label>
              <p className="font-medium">{request.has_sample_analog ? 'Так' : 'Ні'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Пріоритет</label>
              <div className="mt-1">
                <Badge variant="outline" className={getPriorityColor(request.priority)}>
                  {t.priority(request.priority)}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Рівень складності</label>
              <div className="mt-1">
                {request.complexity_level ? (
                  <Badge variant="outline" className={t.complexityLevelColor(request.complexity_level)}>
                    {t.complexityLevel(request.complexity_level)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">Не визначено</span>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Опис</label>
              <p className="font-medium whitespace-pre-wrap">
                {request.description || 'Опис відсутній'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Handoff Block for EASY complexity requests */}
      {canQuickHandoff && (
        <QuickHandoffBlock
          requestId={id!}
          requestCode={request.code}
          canEdit={canEdit}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['development-request', id] });
          }}
        />
      )}

      {/* Tabs for Recipes and Samples */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="recipes" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Рецепти
              </TabsTrigger>
              <TabsTrigger value="samples" className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Зразки
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recipes" className="mt-6">
              {selectedRecipeId ? (
                <RecipeForm
                  recipeId={selectedRecipeId}
                  onBack={() => setSelectedRecipeId(null)}
                  onRecipeCopied={(newRecipeId) => setSelectedRecipeId(newRecipeId)}
                  onSampleCreated={(sampleId) => {
                    setSelectedSampleId(sampleId);
                    setActiveTab('samples');
                  }}
                  onOpenSample={(sampleId) => {
                    setSelectedSampleId(sampleId);
                    setActiveTab('samples');
                  }}
                  canEdit={canEdit}
                />
              ) : (
                <RecipesList
                  requestId={id!}
                  onOpenRecipe={(recipeId) => setSelectedRecipeId(recipeId)}
                  onOpenSample={(sampleId) => {
                    setSelectedSampleId(sampleId);
                    setActiveTab('samples');
                  }}
                  onSampleCreated={(sampleId) => {
                    setSelectedSampleId(sampleId);
                    setActiveTab('samples');
                  }}
                  canEdit={canEdit}
                />
              )}
            </TabsContent>

            <TabsContent value="samples" className="mt-6">
              {selectedSampleId ? (
                <SampleDetail
                  sampleId={selectedSampleId}
                  onBack={() => setSelectedSampleId(null)}
                  onOpenRecipe={(recipeId) => {
                    setSelectedRecipeId(recipeId);
                    setSelectedSampleId(null);
                    setActiveTab('recipes');
                  }}
                  onSampleCopied={(newSampleId) => setSelectedSampleId(newSampleId)}
                  canEdit={canEdit}
                />
              ) : (
                <SamplesList
                  requestId={id!}
                  onOpenSample={(sampleId) => setSelectedSampleId(sampleId)}
                  canEdit={canEdit}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
