import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, X, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchKBDocument,
  createKBDocument,
  updateKBDocument,
  uploadKBFile,
  deleteKBFile,
} from '@/services/kbApi';
import {
  KBCategory,
  KBStatus,
  KBAccessLevel,
  KB_CATEGORY_LABELS,
  KB_STATUS_LABELS,
  KB_ACCESS_LEVEL_LABELS,
} from '@/types/kb';

export default function KBDocumentForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<KBCategory>('SOP');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState<KBStatus>('active');
  const [accessLevel, setAccessLevel] = useState<KBAccessLevel>('open');
  const [rawText, setRawText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const userRole = profile?.role;
  const hasAccess = userRole === 'coo' || userRole === 'admin';

  const { data: document, isLoading } = useQuery({
    queryKey: ['kb-document', id],
    queryFn: () => fetchKBDocument(id!),
    enabled: isEdit && hasAccess,
  });

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setCategory(document.category);
      setVersion(document.version || '');
      setStatus(document.status);
      setAccessLevel((document.access_level as KBAccessLevel) || 'open');
      setRawText(document.raw_text || '');
      setExistingFilePath(document.storage_path);
    }
  }, [document]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
  };

  const handleGenerateFromFile = async () => {
    if (!id) {
      toast({ 
        title: 'Помилка', 
        description: 'Спочатку збережіть документ', 
        variant: 'destructive' 
      });
      return;
    }

    if (!existingFilePath && !rawText) {
      toast({ 
        title: 'Помилка', 
        description: 'Завантажте файл або введіть текст для генерації', 
        variant: 'destructive' 
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('kb-generate-index-text', {
        body: { document_id: id }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setRawText(data.generatedText);
      
      let description = 'Перевірте та відредагуйте за потреби.';
      if (data.sourceInfo) {
        description = `${data.sourceInfo}. ${description}`;
      }
      if (data.truncated) {
        description += ' (Текст було скорочено через великий розмір)';
      }
      
      toast({ 
        title: 'Текст згенеровано', 
        description 
      });
    } catch (error: any) {
      console.error('Generate error:', error);
      toast({ 
        title: 'Помилка генерації', 
        description: error.message || 'Не вдалося згенерувати текст', 
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    setIsSubmitting(true);

    try {
      let storagePath = existingFilePath;
      let storageBucket: string | null = existingFilePath ? 'kb' : null;
      let mimeType: string | null = document?.mime_type || null;

      // If editing and no new file, keep existing
      if (isEdit && !file) {
        // Keep existing values
      } else if (file) {
        // Upload new file
        const docId = id || crypto.randomUUID();
        const uploadResult = await uploadKBFile(docId, file);
        storagePath = uploadResult.path;
        storageBucket = uploadResult.bucket;
        mimeType = uploadResult.mimeType;

        // Delete old file if exists
        if (existingFilePath && existingFilePath !== storagePath) {
          try {
            await deleteKBFile(existingFilePath);
          } catch {
            // Ignore deletion errors
          }
        }
      }

      if (isEdit && id) {
        await updateKBDocument(id, {
          title,
          category,
          version: version || null,
          status,
          access_level: accessLevel,
          raw_text: rawText || null,
          storage_bucket: storageBucket,
          storage_path: storagePath,
          mime_type: mimeType,
        });
        toast({ title: 'Збережено', description: 'Документ оновлено.' });
      } else {
        const created = await createKBDocument({
          title,
          category,
          version: version || null,
          status,
          access_level: accessLevel,
          raw_text: rawText || null,
          storage_bucket: storageBucket,
          storage_path: storagePath,
          mime_type: mimeType,
          created_by: profile.id,
        });

        // If we uploaded before having the ID, we need to update the path
        if (file && storagePath && !storagePath.startsWith(created.id)) {
          // Re-upload with correct ID
          const uploadResult = await uploadKBFile(created.id, file);
          await updateKBDocument(created.id, {
            storage_bucket: uploadResult.bucket,
            storage_path: uploadResult.path,
            mime_type: uploadResult.mimeType,
          });
          // Clean up temp file
          try {
            await deleteKBFile(storagePath);
          } catch {
            // Ignore
          }
        }

        toast({ title: 'Створено', description: 'Документ додано до бібліотеки.' });
      }

      queryClient.invalidateQueries({ queryKey: ['kb-documents'] });
      navigate('/kb');
    } catch (error: any) {
      toast({
        title: 'Помилка',
        description: error.message || 'Не вдалося зберегти документ.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
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

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/kb')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEdit ? 'Редагувати документ' : 'Новий документ'}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? 'Змініть дані документа' : 'Додайте новий документ до бібліотеки'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Основна інформація</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Назва *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введіть назву документа"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Категорія *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as KBCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(KB_CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Статус</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as KBStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(KB_STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessLevel">Рівень доступу</Label>
              <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as KBAccessLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KB_ACCESS_LEVEL_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">Версія</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Наприклад: 1.0, v2.1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Файл (PDF, DOCX, XLSX, PNG, XML)</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.xml,.bpmn,.png,.jpg,.jpeg,.txt"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {file && (
                  <Button type="button" variant="ghost" size="icon" onClick={handleRemoveFile}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Обрано: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
              {existingFilePath && !file && (
                <p className="text-sm text-muted-foreground">
                  Поточний файл: {existingFilePath.split('/').pop()}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="rawText">
                  Текст для індексації *
                  <span className="font-normal text-muted-foreground ml-2">
                    (або згенеруйте AI)
                  </span>
                </Label>
                {isEdit && (existingFilePath || rawText) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateFromFile}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Генерую...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Згенерувати (AI) з файлу
                      </>
                    )}
                  </Button>
                )}
              </div>
              <Textarea
                id="rawText"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Вставте текст документа для індексації RAG-системою..."
                className="min-h-[200px]"
                required
              />
              <p className="text-xs text-muted-foreground">
                Цей текст буде розбито на чанки та проіндексовано для пошуку через Telegram-бота.
                {isEdit && ' Натисніть кнопку "Згенерувати (AI) з файлу" для автоматичного створення структурованого тексту.'}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate('/kb')}>
            Скасувати
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Зберегти' : 'Створити'}
          </Button>
        </div>
      </form>
    </div>
  );
}
