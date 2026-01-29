import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Microscope, ClipboardList, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickHandoffDialog } from './QuickHandoffDialog';

interface QuickHandoffBlockProps {
  requestId: string;
  requestCode: string;
  canEdit: boolean;
  onSuccess: () => void;
}

interface StageInfo {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  isAction: boolean;
}

const stages: StageInfo[] = [
  {
    key: 'lab',
    icon: Microscope,
    title: 'Лабораторія',
    subtitle: '(опційно)',
    isAction: false,
  },
  {
    key: 'pilot',
    icon: ClipboardList,
    title: 'Пілот/Дегустація',
    subtitle: '(опційно)',
    isAction: false,
  },
  {
    key: 'handoff',
    icon: Send,
    title: 'Передача на тестування',
    subtitle: '',
    isAction: true,
  },
];

export function QuickHandoffBlock({
  requestId,
  requestCode,
  canEdit,
  onSuccess,
}: QuickHandoffBlockProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Наступні кроки</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stages.map((stage) => {
              const Icon = stage.icon;
              const isActionStage = stage.isAction;

              return (
                <div
                  key={stage.key}
                  className={cn(
                    'flex flex-col items-center text-center p-4 rounded-lg border-2 transition-all',
                    isActionStage
                      ? 'border-primary bg-primary/5'
                      : 'border-dashed border-muted opacity-70'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-8 w-8 mb-2',
                      isActionStage ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />

                  <span
                    className={cn(
                      'font-medium mb-1',
                      !isActionStage && 'text-muted-foreground'
                    )}
                  >
                    {stage.title}
                  </span>

                  {stage.subtitle && (
                    <span className="text-xs text-muted-foreground">
                      {stage.subtitle}
                    </span>
                  )}

                  {isActionStage && canEdit && (
                    <Button
                      variant="default"
                      size="sm"
                      className="mt-2"
                      onClick={() => setDialogOpen(true)}
                    >
                      Передати на тестування
                    </Button>
                  )}

                  {isActionStage && !canEdit && (
                    <span className="text-xs text-muted-foreground mt-2">
                      Очікує дії розробника
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <QuickHandoffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        requestId={requestId}
        requestCode={requestCode}
        onSuccess={onSuccess}
      />
    </>
  );
}
