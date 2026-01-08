import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, CalendarIcon, Info, Upload, X, FileText } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { translations, t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { uploadRdAttachment, validateRdFile, formatFileSize, getFileIcon } from '@/services/rdAttachmentService';

interface PendingFile {
  file: File;
  error?: string;
}

const DOMAIN_ORDER = [
  'MEAT', 'SEMI_FINISHED', 'CONFECTIONERY', 'SNACKS',
  'DAIRY', 'FATS_OILS', 'ICE_CREAM', 'FISH', 'BAKERY'
];

export default function NewRequest() {
  const {
    profile
  } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customer_company: '',
    customer_contact: '',
    direction: '',
    domain: '',
    description: '',
    priority: 'MEDIUM',
    desired_due_date: undefined as Date | undefined,
    has_sample_analog: false
  });
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: PendingFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateRdFile(file);
      newFiles.push({ file, error: error || undefined });
    }
    setPendingFiles(prev => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.desired_due_date) {
      toast({
        title: translations.newRequest.errorTitle,
        description: 'Оберіть бажану дату завершення',
        variant: 'destructive'
      });
      return;
    }

    const validFiles = pendingFiles.filter(pf => !pf.error);
    if (pendingFiles.some(pf => pf.error)) {
      toast({
        title: translations.newRequest.errorTitle,
        description: 'Видаліть файли з помилками перед створенням заявки',
        variant: 'destructive'
      });
      return;
    }
    setLoading(true);
    try {
      const {
        data: codeData
      } = await supabase.rpc('generate_request_code');
      const {
        data,
        error
      } = await supabase.from('requests').insert({
        code: codeData,
        author_email: profile?.email,
        customer_company: formData.customer_company,
        customer_contact: formData.customer_contact,
        direction: formData.direction as any,
        domain: formData.domain as any,
        description: formData.description,
        priority: formData.priority as any,
        desired_due_date: formData.desired_due_date.toISOString(),
        has_sample_analog: formData.has_sample_analog
      }).select().single();
      if (error) throw error;
      await supabase.rpc('log_request_event', {
        p_request_id: data.id,
        p_actor_email: profile?.email,
        p_event_type: 'CREATED',
        p_payload: {
          customer_company: formData.customer_company
        }
      });

      // Upload attachments
      if (validFiles.length > 0 && profile?.id) {
        for (const pf of validFiles) {
          try {
            await uploadRdAttachment(pf.file, data.id, profile.id);
          } catch (uploadError) {
            console.error('Error uploading attachment:', uploadError);
          }
        }
      }

      toast({
        title: translations.newRequest.successTitle,
        description: translations.newRequest.success.replace('{code}', codeData)
      });
      navigate('/requests/my');
    } catch (error: any) {
      toast({
        title: translations.newRequest.errorTitle,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  return <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h2 className="font-bold tracking-tight text-2xl">{translations.newRequest.title}</h2>
          <p className="text-muted-foreground">{translations.newRequest.description}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{translations.newRequest.requestDetails}</CardTitle>
          <CardDescription>{translations.newRequest.requestDetailsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{translations.newRequest.form.customerCompany} *</Label>
                <Input value={formData.customer_company} onChange={e => setFormData({
                ...formData,
                customer_company: e.target.value
              })} required />
              </div>
              <div className="space-y-2">
                <Label>{translations.newRequest.form.customerContact}</Label>
                <Input value={formData.customer_contact} onChange={e => setFormData({
                ...formData,
                customer_contact: e.target.value
              })} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{translations.newRequest.form.direction} *</Label>
                <Select value={formData.direction} onValueChange={v => setFormData({
                ...formData,
                direction: v
              })}>
                  <SelectTrigger><SelectValue placeholder={translations.newRequest.form.directionPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(translations.direction).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{translations.newRequest.form.domain} *</Label>
                <Select value={formData.domain} onValueChange={v => setFormData({
                ...formData,
                domain: v
              })}>
                  <SelectTrigger><SelectValue placeholder={translations.newRequest.form.domainPlaceholder} /></SelectTrigger>
                  <SelectContent>
                    {DOMAIN_ORDER.map((key) => (
                      <SelectItem key={key} value={key}>
                        {translations.domain[key as keyof typeof translations.domain]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{translations.newRequest.form.priority} *</Label>
                <Select value={formData.priority} onValueChange={v => setFormData({
                ...formData,
                priority: v
              })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(translations.priority).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{translations.newRequest.form.desiredDueDate} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.desired_due_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.desired_due_date ? format(formData.desired_due_date, 'PPP', {
                      locale: uk
                    }) : translations.newRequest.form.pickDate}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.desired_due_date} onSelect={d => setFormData({
                    ...formData,
                    desired_due_date: d
                  })} locale={uk} /></PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>{translations.newRequest.form.description} *</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-sm">
                      <p>В описі важливо дати максимум інформації для розробника, щоб процес розробки і результат були якісними. Приклад необхідної додаткової інформації: рекомендоване дозування, ціна (бажана вартість для оригіналу, за необхідності), сфера та особливості застосування, технологічні особливості виробництва, рецептури продукту, сировина, бажаний технологічний ефект.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea value={formData.description} onChange={e => setFormData({
              ...formData,
              description: e.target.value
            })} rows={4} required />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="hasSample" checked={formData.has_sample_analog} onCheckedChange={c => setFormData({
              ...formData,
              has_sample_analog: c as boolean
            })} />
              <Label htmlFor="hasSample">{translations.newRequest.form.hasSampleAnalogYes}</Label>
            </div>

            {/* File Attachments */}
            <div className="space-y-3">
              <Label>Прикріплені файли</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  Перетягніть файли сюди або натисніть для вибору
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  PDF, DOC, XLS, PPT, TXT, CSV, JPG, PNG, ZIP • до 5 МБ
                </p>
                <Input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <Button type="button" variant="outline" size="sm" asChild>
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Обрати файли
                  </label>
                </Button>
              </div>

              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  {pendingFiles.map((pf, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md border text-sm",
                        pf.error ? "border-destructive bg-destructive/10" : "bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{getFileIcon(pf.file.type)}</span>
                        <span className="truncate">{pf.file.name}</span>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">
                          {formatFileSize(pf.file.size)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {pf.error && (
                          <span className="text-xs text-destructive">{pf.error}</span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removePendingFile(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>{translations.newRequest.form.cancel}</Button>
              <Button type="submit" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{translations.newRequest.form.submitting}</> : translations.newRequest.form.submit}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>;
}