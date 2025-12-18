import { useAuth } from '@/hooks/useAuth';
import { t } from '@/lib/i18n';

export default function Dashboard() {
  const { profile } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-2xl font-semibold text-foreground mb-2">
        Вітаємо, {profile?.name}!
      </h1>
      <p className="text-muted-foreground mb-4">
        {profile?.role && t.role(profile.role)}
      </p>
      <p className="text-sm text-muted-foreground max-w-md">
        Оберіть модуль у меню зліва для початку роботи.
      </p>
    </div>
  );
}
