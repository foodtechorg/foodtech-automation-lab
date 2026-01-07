import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users, Activity, Trophy, TrendingUp, UserCheck, UserX, LogIn } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { t } from '@/lib/i18n';
import {
  getUserActivityStats,
  getActivityTimeline,
  getActivitySummary,
  getUsersLoginInfo,
  type UserActivityStats,
  type ActivityTimelinePoint,
  type ActivitySummary,
  type UserLoginInfo,
} from '@/services/analyticsApi';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const PERIOD_OPTIONS = [
  { value: '7', label: '7 днів' },
  { value: '30', label: '30 днів' },
  { value: '90', label: '90 днів' },
];

export default function UserActivityAnalytics() {
  const [days, setDays] = useState(30);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['activity-summary', days],
    queryFn: () => getActivitySummary(days),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user-activity-stats', days],
    queryFn: () => getUserActivityStats(days),
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['activity-timeline', days],
    queryFn: () => getActivityTimeline(days),
  });

  const { data: loginInfo, isLoading: loginInfoLoading } = useQuery({
    queryKey: ['users-login-info'],
    queryFn: getUsersLoginInfo,
  });

  const loggedInCount = loginInfo?.filter((u) => u.hasLoggedIn).length || 0;
  const notLoggedInCount = loginInfo?.filter((u) => !u.hasLoggedIn).length || 0;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Період:</span>
        <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активних користувачів</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {summary?.activeUsersCount} / {summary?.totalUsersCount}
              </div>
            )}
            <p className="text-xs text-muted-foreground">за останні {days} днів</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всього подій</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{summary?.totalEventsCount}</div>
            )}
            <p className="text-xs text-muted-foreground">дій в системі</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Найактивніший</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : summary?.mostActiveUser ? (
              <>
                <div className="text-2xl font-bold truncate">{summary.mostActiveUser.name}</div>
                <p className="text-xs text-muted-foreground">
                  {summary.mostActiveUser.eventsCount} подій
                </p>
              </>
            ) : (
              <div className="text-muted-foreground">—</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Login status section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Статус входу користувачів
          </CardTitle>
          <CardDescription>Інформація про перший та останній вхід в систему</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Login summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div>
                {loginInfoLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-green-600">{loggedInCount}</div>
                )}
                <p className="text-sm text-muted-foreground">Здійснили вхід</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <UserX className="h-8 w-8 text-orange-600" />
              <div>
                {loginInfoLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold text-orange-600">{notLoggedInCount}</div>
                )}
                <p className="text-sm text-muted-foreground">Очікують входу</p>
              </div>
            </div>
          </div>

          {/* Login status table */}
          {loginInfoLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Користувач</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Створено</TableHead>
                    <TableHead>Перший вхід</TableHead>
                    <TableHead>Останній вхід</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginInfo
                    ?.sort((a, b) => {
                      // Sort: not logged in first, then by creation date
                      if (a.hasLoggedIn !== b.hasLoggedIn) {
                        return a.hasLoggedIn ? 1 : -1;
                      }
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    })
                    .map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.role(user.role)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(user.createdAt), 'dd.MM.yyyy', { locale: uk })}
                        </TableCell>
                        <TableCell>
                          {user.confirmedAt ? (
                            format(new Date(user.confirmedAt), 'dd.MM.yyyy HH:mm', { locale: uk })
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.lastSignInAt ? (
                            format(new Date(user.lastSignInAt), 'dd.MM.yyyy HH:mm', { locale: uk })
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.hasLoggedIn ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              Активний
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                              Очікує входу
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Графік активності
          </CardTitle>
          <CardDescription>Кількість подій по днях</CardDescription>
        </CardHeader>
        <CardContent>
          {timelineLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'dd.MM', { locale: uk })}
                  className="text-xs"
                />
                <YAxis className="text-xs" />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value), 'dd MMMM yyyy', { locale: uk })}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="rdEvents"
                  name="R&D події"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="purchaseEvents"
                  name="Закупівлі"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* User activity table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Активність по користувачах
          </CardTitle>
          <CardDescription>Детальна статистика дій кожного користувача</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Користувач</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead className="text-center">R&D події</TableHead>
                    <TableHead className="text-center">Заявки</TableHead>
                    <TableHead className="text-center">Рахунки</TableHead>
                    <TableHead className="text-center">Всього</TableHead>
                    <TableHead>Остання активність</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.map((user) => {
                    const total =
                      user.rdEventsCount + user.purchaseRequestsCount + user.purchaseInvoicesCount;
                    return (
                      <TableRow key={user.userId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.role(user.role)}
                        </TableCell>
                        <TableCell className="text-center">{user.rdEventsCount || '—'}</TableCell>
                        <TableCell className="text-center">
                          {user.purchaseRequestsCount || '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {user.purchaseInvoicesCount || '—'}
                        </TableCell>
                        <TableCell className="text-center font-medium">{total || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.lastActivityAt
                            ? format(new Date(user.lastActivityAt), 'dd.MM.yyyy HH:mm', {
                                locale: uk,
                              })
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
