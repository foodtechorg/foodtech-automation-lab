import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Activity, Trophy, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { t } from '@/lib/i18n';
import {
  getUserActivityStats,
  getActivityTimeline,
  getActivitySummary,
  type UserActivityStats,
  type ActivityTimelinePoint,
  type ActivitySummary,
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
