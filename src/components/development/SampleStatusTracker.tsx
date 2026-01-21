import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DevelopmentSampleStatus } from '@/services/samplesApi';

interface SampleStatusTrackerProps {
  status: DevelopmentSampleStatus;
  compact?: boolean;
}

const stages = [
  { 
    key: 'prepared', 
    label: 'Підготовлений',
    compactLabel: 'Підг.',
    statuses: ['Prepared', 'Lab', 'LabDone', 'Pilot', 'PilotDone', 'ReadyForHandoff', 'HandedOff'] 
  },
  { 
    key: 'lab', 
    label: 'Лабораторні тестування',
    compactLabel: 'Лаб.',
    statuses: ['LabDone', 'Pilot', 'PilotDone', 'ReadyForHandoff', 'HandedOff'] 
  },
  { 
    key: 'pilot', 
    label: 'Пілот/дегустація',
    compactLabel: 'Пілот',
    statuses: ['PilotDone', 'ReadyForHandoff', 'HandedOff'] 
  },
  { 
    key: 'testing', 
    label: 'Тестування',
    compactLabel: 'Тест.',
    statuses: ['ReadyForHandoff', 'HandedOff'] 
  },
  { 
    key: 'approved', 
    label: 'Погоджений',
    compactLabel: 'Погодж.',
    statuses: ['HandedOff'] 
  },
];

export function SampleStatusTracker({ status, compact = false }: SampleStatusTrackerProps) {
  const isDraft = status === 'Draft';
  const isArchived = status === 'Archived';

  if (compact) {
    return (
      <div className="flex flex-col gap-0.5">
        {stages.map(stage => {
          const isCompleted = stage.statuses.includes(status);
          return (
            <div 
              key={stage.key}
              className={cn(
                "flex items-center gap-1 text-[10px] leading-tight",
                isCompleted 
                  ? "text-primary" 
                  : (isDraft || isArchived)
                    ? "text-muted-foreground/40"
                    : "text-muted-foreground/60"
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
              ) : (
                <Circle className="h-3 w-3 flex-shrink-0" />
              )}
              <span>{stage.compactLabel}</span>
            </div>
          );
        })}
      </div>
    );
  }
  
  return (
    <div className="flex flex-wrap gap-2">
      {stages.map(stage => {
        const isCompleted = stage.statuses.includes(status);
        return (
          <div 
            key={stage.key} 
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium",
              isCompleted 
                ? "bg-primary/10 border-primary/30 text-primary" 
                : (isDraft || isArchived)
                  ? "bg-muted/50 border-border text-muted-foreground/50"
                  : "bg-muted/50 border-border text-muted-foreground"
            )}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Circle className="h-3.5 w-3.5" />
            )}
            <span>{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}
