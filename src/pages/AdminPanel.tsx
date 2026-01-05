import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Loader2, Users, RefreshCw, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { t } from '@/lib/i18n';

type UserRole = 'admin' | 'sales_manager' | 'rd_dev' | 'rd_manager' | 'procurement_manager' | 'coo' | 'ceo' | 'treasurer' | 'accountant' | 'quality_manager' | 'admin_director' | 'chief_engineer' | 'production_deputy' | 'warehouse_manager';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
}

export default function AdminPanel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('sales_manager');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId?: string; userName?: string }>({ open: false });

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data as UserProfile[]);
    } catch (error: any) {
      toast({ title: 'Помилка', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email, name, phone, role }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Успіх', description: `Користувача ${name} створено. Email-запрошення надіслано.` });
      setEmail(''); setName(''); setPhone(''); setRole('sales_manager');
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Помилка', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog.userId) return;
    try {
      const { error } = await supabase.functions.invoke('delete-user', { body: { userId: deleteDialog.userId } });
      if (error) throw error;
      toast({ title: 'Успіх', description: `Користувача видалено` });
      fetchUsers();
    } catch (error: any) {
      toast({ title: 'Помилка', description: error.message, variant: 'destructive' });
    } finally {
      setDeleteDialog({ open: false });
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const { error } = await supabase.functions.invoke('reset-user-password', { body: { userId } });
      if (error) throw error;
      toast({ title: 'Успіх', description: 'Посилання для скидання паролю надіслано' });
    } catch (error: any) {
      toast({ title: 'Помилка', description: error.message, variant: 'destructive' });
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingRole(userId);
    try {
      const { data, error } = await supabase.functions.invoke('update-user-role', {
        body: { userId, newRole }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Успіх', description: 'Роль користувача змінено' });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (error: any) {
      toast({ title: 'Помилка', description: error.message, variant: 'destructive' });
    } finally {
      setUpdatingRole(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Адміністрування</h2>
        <p className="text-muted-foreground">Управління користувачами системи</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Адміністрування користувачів</CardTitle>
          <CardDescription>Створення нових користувачів системи. Після створення на вказану пошту буде надіслано запрошення для встановлення паролю.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@foodtech.org.ua" required />
            </div>
            <div className="space-y-2">
              <Label>Ім'я *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Іван Петренко" required />
            </div>
            <div className="space-y-2">
              <Label>Телефон *</Label>
              <Input 
                type="tel" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="+380XXXXXXXXX" 
                pattern="^\+380[0-9]{9}$"
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>Роль *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_manager">Менеджер продажів</SelectItem>
                  <SelectItem value="rd_dev">Розробник R&D</SelectItem>
                  <SelectItem value="rd_manager">Менеджер R&D</SelectItem>
                  <SelectItem value="procurement_manager">Менеджер закупівель</SelectItem>
                  <SelectItem value="coo">COO</SelectItem>
                  <SelectItem value="ceo">CEO</SelectItem>
                  <SelectItem value="treasurer">Казначей</SelectItem>
                  <SelectItem value="accountant">Бухгалтер</SelectItem>
                  <SelectItem value="quality_manager">Керівник відділу ССіЯ</SelectItem>
                  <SelectItem value="admin_director">Адміністративний директор</SelectItem>
                  <SelectItem value="chief_engineer">Головний інженер</SelectItem>
                  <SelectItem value="production_deputy">Заст. директора з виробництва</SelectItem>
                  <SelectItem value="warehouse_manager">Начальник складу</SelectItem>
                  <SelectItem value="admin">Адміністратор</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Створення...</>
                ) : (
                  <><UserPlus className="mr-2 h-4 w-4" />Створити користувача</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Users className="h-5 w-5" />Список користувачів</span>
            <Button variant="ghost" size="icon" onClick={fetchUsers}><RefreshCw className={`h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`} /></Button>
          </CardTitle>
          <CardDescription>Управління існуючими користувачами системи</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ім'я</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Створено</TableHead>
                  <TableHead>Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.phone || '—'}</TableCell>
                    <TableCell>
                      <Select 
                        value={u.role} 
                        onValueChange={(newRole) => handleRoleChange(u.id, newRole as UserRole)}
                        disabled={u.id === user?.id || updatingRole === u.id}
                      >
                        <SelectTrigger className="w-[200px]">
                          {updatingRole === u.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sales_manager">Менеджер продажів</SelectItem>
                          <SelectItem value="rd_dev">Розробник R&D</SelectItem>
                          <SelectItem value="rd_manager">Менеджер R&D</SelectItem>
                          <SelectItem value="procurement_manager">Менеджер закупівель</SelectItem>
                          <SelectItem value="coo">COO</SelectItem>
                          <SelectItem value="ceo">CEO</SelectItem>
                          <SelectItem value="treasurer">Казначей</SelectItem>
                          <SelectItem value="accountant">Бухгалтер</SelectItem>
                          <SelectItem value="quality_manager">Керівник відділу ССіЯ</SelectItem>
                          <SelectItem value="admin_director">Адміністративний директор</SelectItem>
                          <SelectItem value="chief_engineer">Головний інженер</SelectItem>
                          <SelectItem value="production_deputy">Заст. директора з виробництва</SelectItem>
                          <SelectItem value="warehouse_manager">Начальник складу</SelectItem>
                          <SelectItem value="admin">Адміністратор</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(u.created_at), 'dd.MM.yyyy', { locale: uk })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleResetPassword(u.id)} title="Скинути пароль">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        {u.id !== user?.id && (
                          <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, userId: u.id, userName: u.name })} title="Видалити">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити користувача?</AlertDialogTitle>
            <AlertDialogDescription>Ви впевнені, що хочете видалити користувача {deleteDialog.userName}? Цю дію не можна скасувати.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">Видалити</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
