import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, isFuture } from 'date-fns';
import { translations } from '@/lib/i18n';

const POINTS_MAP: Record<string, number> = {
  EASY: 1,
  MEDIUM: 3,
  COMPLEX: 8,
  EXPERT: 20
};

interface DeveloperActivityStats {
  email: string;
  name: string;
  takenInWork: number;
  sentForTest: number;
  returnedForRework: number;
  approved: number;
  rejected: number;
}

interface DeveloperPointsStats {
  email: string;
  name: string;
  level1Count: number;
  level2Count: number;
  level3Count: number;
  level4Count: number;
  totalPoints: number;
}

interface EventPayload {
  from?: string;
  to?: string;
}

interface RequestEvent {
  id: string;
  event_type: string;
  payload: EventPayload | null;
  created_at: string;
  request_id: string;
  requests: {
    responsible_email: string | null;
    complexity_level: string | null;
  } | null;
}

export function RDMonthlyReports() {
  const [selectedDate, setSelectedDate] = useState(() => subMonths(new Date(), 1));

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const monthName = translations.rdReports.months[month as keyof typeof translations.rdReports.months];

  const canGoNext = !isFuture(startOfMonth(new Date(year, month + 1)));

  const handlePrevMonth = () => {
    setSelectedDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    if (canGoNext) {
      setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const startDate = useMemo(() => startOfMonth(new Date(year, month)).toISOString(), [year, month]);
  const endDate = useMemo(() => endOfMonth(new Date(year, month)).toISOString(), [year, month]);

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['rd-monthly-events', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_events')
        .select(`
          id,
          event_type,
          payload,
          created_at,
          request_id,
          requests!inner (
            responsible_email,
            complexity_level
          )
        `)
        .eq('event_type', 'STATUS_CHANGED')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;
      return data as RequestEvent[];
    }
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['rd-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('email, name, role')
        .in('role', ['rd_dev', 'rd_manager']);

      if (error) throw error;
      return data;
    }
  });

  const emailToName = useMemo(() => {
    return profiles?.reduce((acc, p) => {
      acc[p.email] = p.name || p.email.split('@')[0];
      return acc;
    }, {} as Record<string, string>) || {};
  }, [profiles]);

  const activityStats = useMemo((): DeveloperActivityStats[] => {
    if (!events) return [];

    const statsMap = new Map<string, DeveloperActivityStats>();

    events.forEach(event => {
      const responsibleEmail = event.requests?.responsible_email;
      if (!responsibleEmail) return;

      const payload = event.payload as EventPayload | null;
      if (!payload) return;

      if (!statsMap.has(responsibleEmail)) {
        statsMap.set(responsibleEmail, {
          email: responsibleEmail,
          name: emailToName[responsibleEmail] || responsibleEmail.split('@')[0],
          takenInWork: 0,
          sentForTest: 0,
          returnedForRework: 0,
          approved: 0,
          rejected: 0
        });
      }

      const stats = statsMap.get(responsibleEmail)!;

      // Взято в роботу: PENDING → IN_PROGRESS
      if (payload.from === 'PENDING' && payload.to === 'IN_PROGRESS') {
        stats.takenInWork++;
      }

      // Відправлено на тестування: * → SENT_FOR_TEST
      if (payload.to === 'SENT_FOR_TEST') {
        stats.sentForTest++;
      }

      // Повернуто на доопрацювання: SENT_FOR_TEST → IN_PROGRESS
      if (payload.from === 'SENT_FOR_TEST' && payload.to === 'IN_PROGRESS') {
        stats.returnedForRework++;
      }

      // Затверджено: * → APPROVED_FOR_PRODUCTION
      if (payload.to === 'APPROVED_FOR_PRODUCTION') {
        stats.approved++;
      }

      // Відхилено: * → REJECTED_BY_CLIENT або CANCELLED
      if (payload.to === 'REJECTED_BY_CLIENT' || payload.to === 'CANCELLED') {
        stats.rejected++;
      }
    });

    return Array.from(statsMap.values())
      .filter(s => s.takenInWork > 0 || s.sentForTest > 0 || s.returnedForRework > 0 || s.approved > 0 || s.rejected > 0)
      .sort((a, b) => {
        const totalA = a.takenInWork + a.sentForTest + a.approved;
        const totalB = b.takenInWork + b.sentForTest + b.approved;
        return totalB - totalA;
      });
  }, [events, emailToName]);

  const pointsStats = useMemo((): DeveloperPointsStats[] => {
    if (!events) return [];

    const statsMap = new Map<string, DeveloperPointsStats>();

    // Фільтруємо тільки затверджені заявки
    const approvedEvents = events.filter(e => {
      const payload = e.payload as EventPayload | null;
      return payload?.to === 'APPROVED_FOR_PRODUCTION';
    });

    approvedEvents.forEach(event => {
      const responsibleEmail = event.requests?.responsible_email;
      const complexityLevel = event.requests?.complexity_level;

      if (!responsibleEmail) return;

      if (!statsMap.has(responsibleEmail)) {
        statsMap.set(responsibleEmail, {
          email: responsibleEmail,
          name: emailToName[responsibleEmail] || responsibleEmail.split('@')[0],
          level1Count: 0,
          level2Count: 0,
          level3Count: 0,
          level4Count: 0,
          totalPoints: 0
        });
      }

      const stats = statsMap.get(responsibleEmail)!;

      switch (complexityLevel) {
        case 'EASY':
          stats.level1Count++;
          stats.totalPoints += POINTS_MAP.EASY;
          break;
        case 'MEDIUM':
          stats.level2Count++;
          stats.totalPoints += POINTS_MAP.MEDIUM;
          break;
        case 'COMPLEX':
          stats.level3Count++;
          stats.totalPoints += POINTS_MAP.COMPLEX;
          break;
        case 'EXPERT':
          stats.level4Count++;
          stats.totalPoints += POINTS_MAP.EXPERT;
          break;
      }
    });

    return Array.from(statsMap.values())
      .filter(s => s.totalPoints > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }, [events, emailToName]);

  const activityTotals = useMemo(() => {
    return activityStats.reduce(
      (acc, s) => ({
        takenInWork: acc.takenInWork + s.takenInWork,
        sentForTest: acc.sentForTest + s.sentForTest,
        returnedForRework: acc.returnedForRework + s.returnedForRework,
        approved: acc.approved + s.approved,
        rejected: acc.rejected + s.rejected
      }),
      { takenInWork: 0, sentForTest: 0, returnedForRework: 0, approved: 0, rejected: 0 }
    );
  }, [activityStats]);

  const pointsTotals = useMemo(() => {
    return pointsStats.reduce(
      (acc, s) => ({
        level1Count: acc.level1Count + s.level1Count,
        level2Count: acc.level2Count + s.level2Count,
        level3Count: acc.level3Count + s.level3Count,
        level4Count: acc.level4Count + s.level4Count,
        totalPoints: acc.totalPoints + s.totalPoints
      }),
      { level1Count: 0, level2Count: 0, level3Count: 0, level4Count: 0, totalPoints: 0 }
    );
  }, [pointsStats]);

  const isLoading = eventsLoading || profilesLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{translations.rdReports.title}</CardTitle>
          <CardDescription>{translations.rdReports.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 mb-6">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium min-w-[160px] text-center">
              {monthName} {year}
            </span>
            <Button variant="outline" size="icon" onClick={handleNextMonth} disabled={!canGoNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Таблиця активності */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{translations.rdReports.activityReport}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : activityStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{translations.rdReports.noData}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translations.rdReports.columns.developer}</TableHead>
                  <TableHead className="text-center">{translations.rdReports.columns.takenInWork}</TableHead>
                  <TableHead className="text-center">{translations.rdReports.columns.sentForTest}</TableHead>
                  <TableHead className="text-center">{translations.rdReports.columns.returnedForRework}</TableHead>
                  <TableHead className="text-center">{translations.rdReports.columns.approved}</TableHead>
                  <TableHead className="text-center">{translations.rdReports.columns.rejected}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityStats.map(stats => (
                  <TableRow key={stats.email}>
                    <TableCell className="font-medium">{stats.name}</TableCell>
                    <TableCell className="text-center">{stats.takenInWork}</TableCell>
                    <TableCell className="text-center">{stats.sentForTest}</TableCell>
                    <TableCell className="text-center">{stats.returnedForRework}</TableCell>
                    <TableCell className="text-center">{stats.approved}</TableCell>
                    <TableCell className="text-center">{stats.rejected}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>{translations.rdReports.total}</TableCell>
                  <TableCell className="text-center">{activityTotals.takenInWork}</TableCell>
                  <TableCell className="text-center">{activityTotals.sentForTest}</TableCell>
                  <TableCell className="text-center">{activityTotals.returnedForRework}</TableCell>
                  <TableCell className="text-center">{activityTotals.approved}</TableCell>
                  <TableCell className="text-center">{activityTotals.rejected}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Таблиця балів */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{translations.rdReports.pointsReport}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : pointsStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{translations.rdReports.noData}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translations.rdReports.columns.developer}</TableHead>
                  <TableHead className="text-center">{translations.rdReports.columns.level1}</TableHead>
                  <TableHead className="text-center">{translations.rdReports.columns.level2}</TableHead>
                  <TableHead className="text-center">{translations.rdReports.columns.level3}</TableHead>
                  <TableHead className="text-center">{translations.rdReports.columns.level4}</TableHead>
                  <TableHead className="text-center">{translations.rdReports.columns.totalPoints}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pointsStats.map(stats => (
                  <TableRow key={stats.email}>
                    <TableCell className="font-medium">{stats.name}</TableCell>
                    <TableCell className="text-center">{stats.level1Count || '-'}</TableCell>
                    <TableCell className="text-center">{stats.level2Count || '-'}</TableCell>
                    <TableCell className="text-center">{stats.level3Count || '-'}</TableCell>
                    <TableCell className="text-center">{stats.level4Count || '-'}</TableCell>
                    <TableCell className="text-center font-bold">{stats.totalPoints}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>{translations.rdReports.total}</TableCell>
                  <TableCell className="text-center">{pointsTotals.level1Count || '-'}</TableCell>
                  <TableCell className="text-center">{pointsTotals.level2Count || '-'}</TableCell>
                  <TableCell className="text-center">{pointsTotals.level3Count || '-'}</TableCell>
                  <TableCell className="text-center">{pointsTotals.level4Count || '-'}</TableCell>
                  <TableCell className="text-center">{pointsTotals.totalPoints}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
