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
import { Loader2, ArrowLeft, CalendarIcon, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { translations, t } from '@/lib/i18n';
import { Checkbox } from '@/components/ui/checkbox';
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
                    {Object.entries(translations.domain).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
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