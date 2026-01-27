import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { RefreshCw, Bell, Send, CheckCircle2, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { t } from '@/lib/i18n';
import { toast } from '@/hooks/use-toast';

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
  profile_id: string | null;
  message_text: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'canceled';
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  profiles?: { name: string | null } | null;
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
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null);

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
      // Fetch outbox entries
      const { data: outboxData, error: outboxError } = await supabase
        .from('notification_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (outboxError) throw outboxError;
      
      // Get unique profile IDs and fetch names
      const profileIds = [...new Set((outboxData || []).map(e => e.profile_id).filter(Boolean))] as string[];
      
      let profilesMap: Record<string, string> = {};
      if (profileIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', profileIds);
        
        profilesMap = (profilesData || []).reduce((acc, p) => {
          acc[p.id] = p.name || '';
          return acc;
        }, {} as Record<string, string>);
      }
      
      // Combine data
      const enrichedOutbox = (outboxData || []).map(entry => ({
        ...entry,
        profiles: entry.profile_id && profilesMap[entry.profile_id] 
          ? { name: profilesMap[entry.profile_id] } 
          : null
      }));
      
      setOutbox(enrichedOutbox as NotificationOutboxEntry[]);
    } catch (error) {
      console.error('Error fetching notification outbox:', error);
    } finally {
      setLoadingOutbox(false);
    }
  };

  const toggleRuleStatus = async (ruleId: string, currentStatus: boolean) => {
    setUpdatingRuleId(ruleId);
    try {
      const { error } = await supabase
        .from('notification_rules')
        .update({ is_enabled: !currentStatus })
        .eq('id', ruleId);
      
      if (error) throw error;
      
      // Update local state
      setRules(rules.map(r => 
        r.id === ruleId ? { ...r, is_enabled: !currentStatus } : r
      ));
      
      toast({ 
        title: 'Успішно', 
        description: `Правило ${!currentStatus ? 'активовано' : 'деактивовано'}` 
      });
    } catch (error) {
      console.error('Error toggling rule status:', error);
      toast({ 
        title: 'Помилка', 
        description: 'Не вдалося оновити статус правила', 
        variant: 'destructive' 
      });
    } finally {
      setUpdatingRuleId(null);
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

  const getRecipientName = (entry: NotificationOutboxEntry) => {
    if (entry.profiles?.name) {
      return entry.profiles.name;
    }
    return `ID: ${entry.telegram_user_id}`;
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
                Налаштування правил Telegram-нотифікацій по подіях системи
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
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
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Правила нотифікацій не налаштовані
                        </TableCell>
                      </TableRow>
                    ) : (
                      rules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">
                            {t.notificationEventType(rule.event_type)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{rule.channel}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {updatingRuleId === rule.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Switch
                                  checked={rule.is_enabled}
                                  onCheckedChange={() => toggleRuleStatus(rule.id, rule.is_enabled)}
                                  aria-label="Toggle rule status"
                                />
                              )}
                              <span className="text-sm text-muted-foreground">
                                {rule.is_enabled ? 'Активне' : 'Вимкнено'}
                              </span>
                            </div>
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
                          <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap max-w-md">
                            {rule.template_text}
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
                      <TableHead>Отримувач</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Спроб</TableHead>
                      <TableHead className="min-w-[250px]">Повідомлення</TableHead>
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
                          <TableCell className="font-medium">
                            {t.notificationEventType(entry.event_type)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {getRecipientName(entry)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {statusIcons[entry.status]}
                              <span className="text-sm">{statusLabels[entry.status]}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{entry.attempts}</TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap max-w-md">
                            {entry.message_text}
                          </TableCell>
                          <TableCell className="text-sm text-destructive whitespace-pre-wrap max-w-xs">
                            {entry.last_error || '—'}
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
