import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Download, RefreshCw, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { fetchKBDocument, getKBFileSignedUrl, triggerKBIngest } from '@/services/kbApi';
import {
  KBCategory,
  KBStatus,
  KBIndexStatus,
  KBAccessLevel,
  KB_CATEGORY_LABELS,
  KB_STATUS_LABELS,
  KB_INDEX_STATUS_LABELS,
  KB_ACCESS_LEVEL_LABELS,
} from '@/types/kb';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

export default function KBDocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDownloading, setIsDownloading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);

  const userRole = profile?.role;
  const hasAccess = userRole === 'coo' || userRole === 'admin';

  const { data: document, isLoading, error, refetch } = useQuery({
    queryKey: ['kb-document', id],
    queryFn: () => fetchKBDocument(id!),
    enabled: Boolean(id) && hasAccess,
  });

  const handleDownload = async () => {
    if (!document?.storage_path) return;
    setIsDownloading(true);
    try {
      const signedUrl = await getKBFileSignedUrl(document.storage_path);
      window.open(signedUrl, '_blank');
    } catch (error) {
      toast({
        title: 'Помилка',
        description: 'Не вдалося отримати посилання на файл.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTriggerIngest = async () => {
    if (!id) return;
    setIsIndexing(true);
    try {
      await triggerKBIngest(id);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['kb-documents'] });
      toast({
        title: 'Відправлено',
        description: 'Документ відправлено на індексацію.',
      });
    } catch (error: any) {
      toast({
        title: 'Помилка',
        description: error.message || 'Не вдалося запустити індексацію.',
        variant: 'destructive',
      });
    } finally {
      setIsIndexing(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Недостатньо прав</h2>
          <p className="text-muted-foreground">
            Доступ до Бібліотеки знань мають тільки користувачі з роллю COO або Admin.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Документ не знайдено</h2>
          <Button onClick={() => navigate('/kb')}>Повернутися до списку</Button>
        </div>
      </div>
    );
  }

  const indexStatus = document.index_status as KBIndexStatus;
  const isPending = indexStatus === 'pending';
  const isNotActive = document.status !== 'active';
  const hasNoText = !document.raw_text;
  const canIndex = !isPending && !isNotActive && !hasNoText;
  
  const getIndexButtonTitle = () => {
    if (isPending) return 'Індексація в процесі...';
    if (isNotActive) return 'Документ має бути активним';
    if (hasNoText) return 'Додайте текст для індексації';
    return 'Запустити індексацію';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/kb')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{document.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={document.status === 'active' ? 'default' : 'secondary'}>
                {KB_STATUS_LABELS[document.status as KBStatus]}
              </Badge>
              <Badge variant="outline">
                {KB_CATEGORY_LABELS[document.category as KBCategory]}
              </Badge>
              {document.version && (
                <span className="text-sm text-muted-foreground">v{document.version}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/kb/${id}/edit`)}>
            <Edit className="w-4 h-4 mr-2" />
            Редагувати
          </Button>
          {document.storage_path && (
            <Button variant="outline" onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Завантажити
            </Button>
          )}
        </div>
      </div>

      {/* Index Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Статус індексації
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {indexStatus === 'indexed' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Проіндексовано</span>
                </div>
              )}
              {indexStatus === 'pending' && (
                <div className="flex items-center gap-2 text-amber-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>В обробці...</span>
                </div>
              )}
              {indexStatus === 'not_indexed' && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-5 h-5" />
                  <span>Не індексовано</span>
                </div>
              )}
              {indexStatus === 'error' && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5" />
                  <span>Помилка</span>
                </div>
              )}
              {document.indexed_at && (
                <span className="text-sm text-muted-foreground">
                  Останній раз: {format(new Date(document.indexed_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                </span>
              )}
            </div>
            <Button
              onClick={handleTriggerIngest}
              disabled={!canIndex || isIndexing}
              title={getIndexButtonTitle()}
            >
              {isIndexing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Проіндексувати
            </Button>
          </div>

          {indexStatus === 'error' && document.index_error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Помилка індексації</AlertTitle>
              <AlertDescription>{document.index_error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Метадані</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Створено</dt>
              <dd>{format(new Date(document.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Оновлено</dt>
              <dd>{format(new Date(document.updated_at), 'dd.MM.yyyy HH:mm', { locale: uk })}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Рівень доступу</dt>
              <dd>
                <Badge variant={document.access_level === 'open' ? 'outline' : 'secondary'}>
                  {KB_ACCESS_LEVEL_LABELS[document.access_level as KBAccessLevel] || document.access_level}
                </Badge>
              </dd>
            </div>
            {document.storage_path && (
              <div>
                <dt className="text-muted-foreground">Файл</dt>
                <dd className="truncate">{document.storage_path.split('/').pop()}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Raw Text */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Текст для індексації</CardTitle>
        </CardHeader>
        <CardContent>
          {document.raw_text ? (
            <div className="bg-muted p-4 rounded-lg max-h-[400px] overflow-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono">{document.raw_text}</pre>
            </div>
          ) : (
            <p className="text-muted-foreground italic">
              Текст не додано. Редагуйте документ, щоб додати текст для індексації.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
