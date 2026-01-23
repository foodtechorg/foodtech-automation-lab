import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { RefreshCw, Bell, Send, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { t } from '@/lib/i18n';

interface NotificationRule {
  id: string;
  code: string;
  event_type: string;
  channel: string;
  is_enabled: boolean;
  recipient_roles: string[];
  template_text: string;
  updated_at: string;
}

interface NotificationOutboxEntry {
  id: string;
  event_id: string;
  event_type: string;
  telegram_user_id: number;
  message_text: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'canceled';
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  processing: <RefreshCw className="h-4 w-4 animate-spin text-primary" />,
  sent: <CheckCircle2 className="h-4 w-4 text-primary" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  canceled: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
};

const statusLabels: Record<string, string> = {
  pending: 'Очікує',
  processing: 'Обробка',
  sent: 'Надіслано',
  failed: 'Помилка',
  canceled: 'Скасовано',
};

export default function NotificationsPanel() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [outbox, setOutbox] = useState<NotificationOutboxEntry[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [loadingOutbox, setLoadingOutbox] = useState(false);

  const fetchRules = async () => {
    setLoadingRules(true);
    try {
      const { data, error } = await supabase
        .from('notification_rules')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRules((data || []) as NotificationRule[]);
    } catch (error) {
      console.error('Error fetching notification rules:', error);
    } finally {
      setLoadingRules(false);
    }
  };

  const fetchOutbox = async () => {
    setLoadingOutbox(true);
    try {
      const { data, error } = await supabase
        .from('notification_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setOutbox((data || []) as NotificationOutboxEntry[]);
    } catch (error) {
      console.error('Error fetching notification outbox:', error);
    } finally {
      setLoadingOutbox(false);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchOutbox();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return format(new Date(dateStr), 'dd.MM.yyyy HH:mm', { locale: uk });
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules" className="gap-2">
            <Bell className="h-4 w-4" />
            Правила нотифікацій
          </TabsTrigger>
          <TabsTrigger value="outbox" className="gap-2">
            <Send className="h-4 w-4" />
            Outbox (останні 50)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Правила нотифікацій
                </span>
                <Button variant="ghost" size="icon" onClick={fetchRules}>
                  <RefreshCw className={`h-4 w-4 ${loadingRules ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
              <CardDescription>
                Налаштування правил Telegram-нотифікацій по подіях системи (read-only)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Код</TableHead>
                      <TableHead>Тип події</TableHead>
                      <TableHead>Канал</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Отримувачі</TableHead>
                      <TableHead className="min-w-[300px]">Шаблон</TableHead>
                      <TableHead>Оновлено</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Правила нотифікацій не налаштовані
                        </TableCell>
                      </TableRow>
                    ) : (
                      rules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-mono text-sm">{rule.code}</TableCell>
                          <TableCell className="font-mono text-sm">{rule.event_type}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{rule.channel}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rule.is_enabled ? 'success' : 'secondary'}>
                              {rule.is_enabled ? 'Активне' : 'Вимкнено'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {rule.recipient_roles.map((role) => (
                                <Badge key={role} variant="outline" className="text-xs">
                                  {t.role(role)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {truncateText(rule.template_text, 80)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {formatDate(rule.updated_at)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outbox">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Outbox нотифікацій
                </span>
                <Button variant="ghost" size="icon" onClick={fetchOutbox}>
                  <RefreshCw className={`h-4 w-4 ${loadingOutbox ? 'animate-spin' : ''}`} />
                </Button>
              </CardTitle>
              <CardDescription>
                Останні 50 записів черги відправки Telegram-повідомлень
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Створено</TableHead>
                      <TableHead>Тип події</TableHead>
                      <TableHead>Telegram ID</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Спроб</TableHead>
                      <TableHead className="min-w-[200px]">Повідомлення</TableHead>
                      <TableHead>Помилка</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outbox.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Черга повідомлень порожня
                        </TableCell>
                      </TableRow>
                    ) : (
                      outbox.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {formatDate(entry.created_at)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{entry.event_type}</TableCell>
                          <TableCell className="font-mono text-sm">{entry.telegram_user_id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {statusIcons[entry.status]}
                              <span className="text-sm">{statusLabels[entry.status]}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{entry.attempts}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {truncateText(entry.message_text, 60)}
                          </TableCell>
                          <TableCell className="text-sm text-destructive">
                            {entry.last_error ? truncateText(entry.last_error, 40) : '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
