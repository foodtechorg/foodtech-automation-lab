import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft } from 'lucide-react';

export default function NoAccess() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <ShieldX className="h-16 w-16 text-destructive mb-6" />
      <h1 className="text-3xl font-bold mb-2">403 — Доступ заборонено</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        У вас немає доступу до модуля "Розробка". 
        <br />
        Цей модуль доступний лише для ролей Адміністратор та СОО.
      </p>
      <Button onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        На головну
      </Button>
    </div>
  );
}
