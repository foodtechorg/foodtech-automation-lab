import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Microscope, ClipboardList, Send, CheckCircle2, XCircle } from 'lucide-react';
import { DevelopmentSampleStatus } from '@/services/samplesApi';
import { cn } from '@/lib/utils';

interface NextStepsBlockProps {
  sampleId: string;
  sampleStatus: DevelopmentSampleStatus;
  onTransitionToLab: () => void;
  onTransitionToPilot: () => void;
  onTransitionToHandoff: () => void;
  isLabTransitioning?: boolean;
  isPilotTransitioning?: boolean;
}

type StageState = 'completed' | 'active' | 'pending' | 'rejected';

interface StageConfig {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  getState: (status: DevelopmentSampleStatus) => StageState;
  activeText: string;
  completedText: string;
  pendingText: string;
  rejectedText?: string;
}

const stages: StageConfig[] = [
  {
    key: 'lab',
    icon: Microscope,
    title: 'Лабораторія',
    getState: (status) => {
      if (['Lab', 'LabDone', 'Pilot', 'PilotDone', 'Testing', 'Approved', 'Rejected', 'ReadyForHandoff', 'HandedOff'].includes(status)) {
        return 'completed';
      }
      if (status === 'Prepared') return 'active';
      return 'pending';
    },
    activeText: 'Зафіксувати лабораторні аналізи',
    completedText: 'Лабораторні тести завершено',
    pendingText: 'Буде доступно пізніше',
  },
  {
    key: 'pilot',
    icon: ClipboardList,
    title: 'Пілот/Дегустація',
    getState: (status) => {
      if (['Pilot', 'PilotDone', 'Testing', 'Approved', 'Rejected', 'ReadyForHandoff', 'HandedOff'].includes(status)) {
        return 'completed';
      }
      if (status === 'LabDone') return 'active';
      return 'pending';
    },
    activeText: 'Перейти до дегустації',
    completedText: 'Дегустацію завершено',
    pendingText: 'Буде доступно пізніше',
  },
  {
    key: 'handoff',
    icon: Send,
    title: 'Передача на тестування',
    getState: (status) => {
      if (status === 'Approved') return 'completed';
      if (status === 'Rejected') return 'rejected';
      if (status === 'Testing') return 'completed';
      if (status === 'PilotDone') return 'active';
      return 'pending';
    },
    activeText: 'Передати на тестування',
    completedText: 'Передано на тестування',
    pendingText: 'Буде доступно пізніше',
    rejectedText: 'Відхилено',
  },
];

export function NextStepsBlock({
  sampleStatus,
  onTransitionToLab,
  onTransitionToPilot,
  onTransitionToHandoff,
  isLabTransitioning,
  isPilotTransitioning,
}: NextStepsBlockProps) {
  // Don't show for Draft or Archived
  if (sampleStatus === 'Draft' || sampleStatus === 'Archived') {
    return null;
  }

  const handleStageClick = (stageKey: string, state: StageState) => {
    if (state !== 'active') return;
    
    if (stageKey === 'lab') {
      onTransitionToLab();
    } else if (stageKey === 'pilot') {
      onTransitionToPilot();
    } else if (stageKey === 'handoff') {
      onTransitionToHandoff();
    }
  };

  const isTransitioning = (stageKey: string): boolean => {
    if (stageKey === 'lab') return !!isLabTransitioning;
    if (stageKey === 'pilot') return !!isPilotTransitioning;
    return false;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Наступні кроки</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stages.map((stage) => {
            const state = stage.getState(sampleStatus);
            const Icon = stage.icon;
            const transitioning = isTransitioning(stage.key);

            return (
              <div
                key={stage.key}
                className={cn(
                  'flex flex-col items-center text-center p-4 rounded-lg border-2 transition-all',
                  state === 'completed' && 'bg-muted/30 border-muted',
                  state === 'active' && 'border-primary bg-primary/5',
                  state === 'pending' && 'opacity-50 border-dashed border-muted',
                  state === 'rejected' && 'bg-destructive/10 border-destructive/30'
                )}
              >
                {state === 'completed' ? (
                  <CheckCircle2 className="h-8 w-8 text-primary mb-2" />
                ) : state === 'rejected' ? (
                  <XCircle className="h-8 w-8 text-destructive mb-2" />
                ) : (
                  <Icon className={cn(
                    'h-8 w-8 mb-2',
                    state === 'active' ? 'text-primary' : 'text-muted-foreground'
                  )} />
                )}
                
                <span className={cn(
                  'font-medium mb-1',
                  state === 'pending' && 'text-muted-foreground',
                  state === 'rejected' && 'text-destructive'
                )}>
                  {stage.title}
                </span>

                {state === 'completed' && (
                  <span className="text-xs text-muted-foreground">
                    {stage.completedText}
                  </span>
                )}

                {state === 'rejected' && (
                  <span className="text-xs text-destructive">
                    {stage.rejectedText}
                  </span>
                )}

                {state === 'active' && (
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-2"
                    onClick={() => handleStageClick(stage.key, state)}
                    disabled={transitioning}
                  >
                    {transitioning ? 'Обробка...' : stage.activeText}
                  </Button>
                )}

                {state === 'pending' && (
                  <span className="text-xs text-muted-foreground">
                    {stage.pendingText}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
