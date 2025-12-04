import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

type Status = 'PENDING' | 'IN_PROGRESS' | 'SENT_FOR_TEST' | 'APPROVED_FOR_PRODUCTION' | 'REJECTED_BY_CLIENT' | 'CANCELLED';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusConfig = (status: Status) => {
    switch (status) {
      case 'PENDING':
        return {
          label: t.status('PENDING'),
          className: 'bg-warning/10 text-warning border-warning/20',
        };
      case 'IN_PROGRESS':
        return {
          label: t.status('IN_PROGRESS'),
          className: 'bg-info/10 text-info border-info/20',
        };
      case 'SENT_FOR_TEST':
        return {
          label: t.status('SENT_FOR_TEST'),
          className: 'bg-primary/10 text-primary border-primary/20',
        };
      case 'APPROVED_FOR_PRODUCTION':
        return {
          label: t.status('APPROVED_FOR_PRODUCTION'),
          className: 'bg-success/10 text-success border-success/20',
        };
      case 'REJECTED_BY_CLIENT':
        return {
          label: t.status('REJECTED_BY_CLIENT'),
          className: 'bg-destructive/10 text-destructive border-destructive/20',
        };
      case 'CANCELLED':
        return {
          label: t.status('CANCELLED'),
          className: 'bg-muted text-muted-foreground border-muted/20',
        };
      default:
        return {
          label: t.status(status),
          className: 'bg-muted text-muted-foreground',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
