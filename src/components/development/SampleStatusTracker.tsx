import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DevelopmentSampleStatus } from '@/services/samplesApi';

interface SampleStatusTrackerProps {
  status: DevelopmentSampleStatus;
}

const stages = [
  { 
    key: 'prepared', 
    label: 'Підготовлений', 
    statuses: ['Prepared', 'Lab', 'LabDone', 'Pilot', 'PilotDone', 'ReadyForHandoff', 'HandedOff'] 
  },
  { 
    key: 'lab', 
    label: 'Лабораторні тестування', 
    statuses: ['LabDone', 'Pilot', 'PilotDone', 'ReadyForHandoff', 'HandedOff'] 
  },
  { 
    key: 'pilot', 
    label: 'Пілот/дегустація', 
    statuses: ['PilotDone', 'ReadyForHandoff', 'HandedOff'] 
  },
  { 
    key: 'testing', 
    label: 'Тестування', 
    statuses: ['ReadyForHandoff', 'HandedOff'] 
  },
  { 
    key: 'approved', 
    label: 'Погоджений', 
    statuses: ['HandedOff'] 
  },
];

export function SampleStatusTracker({ status }: SampleStatusTrackerProps) {
  const isDraft = status === 'Draft';
  const isArchived = status === 'Archived';
  
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
