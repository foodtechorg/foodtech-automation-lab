import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Eye, Edit, Archive, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { fetchKBDocuments, updateKBDocument, triggerKBIngest } from '@/services/kbApi';
import { useToast } from '@/hooks/use-toast';
import { KBCategory, KBStatus, KBIndexStatus, KBAccessLevel, KB_CATEGORY_LABELS, KB_STATUS_LABELS, KB_INDEX_STATUS_LABELS, KB_ACCESS_LEVEL_LABELS } from '@/types/kb';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
export default function KnowledgeBase() {
  const {
    profile
  } = useAuth();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<KBCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<KBStatus | 'all'>('all');
  const [indexStatusFilter, setIndexStatusFilter] = useState<KBIndexStatus | 'all'>('all');
  const userRole = profile?.role;
  const hasAccess = userRole === 'coo' || userRole === 'admin';
  const {
    data: documents,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['kb-documents'],
    queryFn: fetchKBDocuments,
    enabled: hasAccess
  });
  if (!hasAccess) {
    return <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Недостатньо прав</h2>
          <p className="text-muted-foreground">
            Доступ до Бібліотеки знань мають тільки користувачі з роллю COO або Admin.
          </p>
        </div>
      </div>;
  }
  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    const matchesIndexStatus = indexStatusFilter === 'all' || doc.index_status === indexStatusFilter;
    return matchesSearch && matchesCategory && matchesStatus && matchesIndexStatus;
  });
  const handleArchive = async (id: string, currentStatus: KBStatus) => {
    const newStatus: KBStatus = currentStatus === 'active' ? 'archived' : 'active';
    try {
      await updateKBDocument(id, {
        status: newStatus
      });
      await refetch();
      toast({
        title: newStatus === 'archived' ? 'Архівовано' : 'Відновлено',
        description: `Документ ${newStatus === 'archived' ? 'переміщено в архів' : 'відновлено з архіву'}.`
      });
    } catch (error) {
      toast({
        title: 'Помилка',
        description: 'Не вдалося змінити статус документа.',
        variant: 'destructive'
      });
    }
  };
  const handleTriggerIngest = async (id: string) => {
    try {
      await triggerKBIngest(id);
      await refetch();
      toast({
        title: 'Відправлено',
        description: 'Документ відправлено на індексацію.'
      });
    } catch (error: any) {
      toast({
        title: 'Помилка',
        description: error.message || 'Не вдалося запустити індексацію.',
        variant: 'destructive'
      });
    }
  };
  const getIndexStatusBadge = (status: KBIndexStatus) => {
    const variants: Record<KBIndexStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      not_indexed: 'outline',
      pending: 'secondary',
      indexed: 'default',
      error: 'destructive'
    };
    return <Badge variant={variants[status]}>{KB_INDEX_STATUS_LABELS[status]}</Badge>;
  };
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Бібліотека знань</h1>
          <p className="text-muted-foreground">Затверджені регламентуючі документи</p>
        </div>
        <Button onClick={() => navigate('/kb/new')}>
          <Plus className="w-4 h-4 mr-2" />
          Додати документ
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Пошук за назвою..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as KBCategory | 'all')}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Категорія" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі категорії</SelectItem>
            {Object.entries(KB_CATEGORY_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as KBStatus | 'all')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі статуси</SelectItem>
            {Object.entries(KB_STATUS_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={indexStatusFilter} onValueChange={v => setIndexStatusFilter(v as KBIndexStatus | 'all')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Індексація" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всі</SelectItem>
            {Object.entries(KB_INDEX_STATUS_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div> : <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Назва</TableHead>
                <TableHead>Категорія</TableHead>
                <TableHead>Версія</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Доступ</TableHead>
                <TableHead>Індексація</TableHead>
                <TableHead>Оновлено</TableHead>
                <TableHead className="text-right">Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments?.length === 0 ? <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Документів не знайдено
                  </TableCell>
                </TableRow> : filteredDocuments?.map(doc => <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>{KB_CATEGORY_LABELS[doc.category as KBCategory]}</TableCell>
                    <TableCell>{doc.version || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={doc.status === 'active' ? 'default' : 'secondary'}>
                        {KB_STATUS_LABELS[doc.status as KBStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={doc.access_level === 'open' ? 'outline' : 'secondary'}>
                        {KB_ACCESS_LEVEL_LABELS[doc.access_level as KBAccessLevel] || doc.access_level}
                      </Badge>
                    </TableCell>
                    <TableCell>{getIndexStatusBadge(doc.index_status as KBIndexStatus)}</TableCell>
                    <TableCell>
                      {format(new Date(doc.updated_at), 'dd.MM.yyyy HH:mm', {
                locale: uk
              })}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/kb/${doc.id}`)} title="Переглянути">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/kb/${doc.id}/edit`)} title="Редагувати">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleArchive(doc.id, doc.status as KBStatus)} title={doc.status === 'active' ? 'Архівувати' : 'Відновити'}>
                          <Archive className="w-4 h-4" />
                        </Button>
                        {(() => {
                  const isPending = doc.index_status === 'pending';
                  const isNotActive = doc.status !== 'active';
                  const hasNoText = !doc.raw_text;
                  const isDisabled = isPending || isNotActive || hasNoText;
                  const title = isPending ? 'Індексація в процесі...' : isNotActive ? 'Документ має бути активним' : hasNoText ? 'Додайте текст для індексації' : 'Проіндексувати';
                  return <Button variant="ghost" size="icon" onClick={() => handleTriggerIngest(doc.id)} disabled={isDisabled} title={title}>
                              <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
                            </Button>;
                })()}
                      </div>
                    </TableCell>
                  </TableRow>)}
            </TableBody>
          </Table>
        </div>}
    </div>;
}