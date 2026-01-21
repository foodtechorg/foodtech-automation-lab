import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FlaskConical, TestTubes } from 'lucide-react';
import { t } from '@/lib/i18n';
import { RecipesList } from '@/components/development/RecipesList';
import { RecipeForm } from '@/components/development/RecipeForm';

export default function DevelopmentRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

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
  if (request.status !== 'IN_PROGRESS') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Заявка недоступна</h2>
        <p className="text-muted-foreground mb-4">
          Заявка {request.code} має статус "{t.status(request.status)}" і не доступна в модулі "Розробка".
          <br />
          Модуль "Розробка" працює лише з заявками зі статусом "В роботі".
        </p>
        <Button onClick={() => navigate('/development')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          До списку заявок
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Request Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Інформація про заявку</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Замовник</label>
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
              <label className="text-sm font-medium text-muted-foreground">Пріоритет</label>
              <div className="mt-1">
                <Badge variant="outline" className={getPriorityColor(request.priority)}>
                  {t.priority(request.priority)}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Складність</label>
              <p className="font-medium">
                {request.complexity_level ? t.complexityLevel(request.complexity_level) : 'Не визначено'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Відповідальний</label>
              <p className="font-medium">
                {request.responsible_email ? emailToName[request.responsible_email] : 'Не призначено'}
              </p>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <label className="text-sm font-medium text-muted-foreground">Опис</label>
              <p className="font-medium whitespace-pre-wrap">
                {request.description || 'Опис відсутній'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Recipes and Samples */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="recipes">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="recipes" className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Рецепти
              </TabsTrigger>
              <TabsTrigger value="samples" className="flex items-center gap-2">
                <TestTubes className="h-4 w-4" />
                Зразки
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recipes" className="mt-6">
              {selectedRecipeId ? (
                <RecipeForm
                  recipeId={selectedRecipeId}
                  onBack={() => setSelectedRecipeId(null)}
                  onRecipeCopied={(newRecipeId) => setSelectedRecipeId(newRecipeId)}
                />
              ) : (
                <RecipesList
                  requestId={id!}
                  onOpenRecipe={(recipeId) => setSelectedRecipeId(recipeId)}
                />
              )}
            </TabsContent>

            <TabsContent value="samples" className="mt-6">
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <TestTubes className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Зразки</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Буде реалізовано наступним кроком (Sample).
                  <br />
                  Тут будуть відображатися зразки з лабораторними даними та пілотом.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
