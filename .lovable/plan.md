

## План: Покращення панелі нотифікацій

### Огляд змін

Оновлення панелі "Правила нотифікацій" та "Outbox нотифікацій" з новими функціями локалізації, редагування статусу та покращеного відображення даних.

---

### 1. Зміни в локалізації (i18n.ts)

Додати новий блок `notificationEventType` для локалізації типів подій нотифікацій:

```typescript
notificationEventType: {
  INVOICE_SENT_FOR_APPROVAL: "Рахунок надіслано на погодження",
  INVOICE_PAID: "Рахунок оплачено",
  SAMPLE_READY_FOR_TESTING: "Зразок готовий до тестування"
}
```

Та новий метод-хелпер:
```typescript
notificationEventType: (key: string) => translations.notificationEventType[key] || key
```

---

### 2. База даних: RLS політика для UPDATE

Потрібно створити нову RLS політику, яка дозволить admin та COO оновлювати поле `is_enabled` в таблиці `notification_rules`:

```sql
CREATE POLICY "Admin and COO can update notification_rules"
ON public.notification_rules
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coo'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coo'::app_role)
);
```

---

### 3. Зміни в NotificationsPanel.tsx

#### 3.1 Правила нотифікацій (вкладка "rules")

| Зміна | Деталі |
|-------|--------|
| Прибрати колонку "Код" | Видалити TableHead та TableCell для `code` |
| Локалізувати "Тип події" | Використати `t.notificationEventType(rule.event_type)` |
| Редагований статус | Замінити Badge на Switch або clickable Badge з можливістю toggle |
| Повний текст шаблону | Прибрати `truncateText()`, зробити колонку з `whitespace-pre-wrap` |

**Редагування статусу:**
- Додати функцію `toggleRuleStatus(ruleId, newStatus)`
- При кліку на Badge статусу викликати `supabase.update()` з `is_enabled: !current`
- Показувати toast при успіху/помилці
- Оновити список після зміни

#### 3.2 Outbox нотифікацій (вкладка "outbox")

| Зміна | Деталі |
|-------|--------|
| Замінити Telegram ID на ім'я | JOIN з `profiles` через `profile_id`, показувати `name` |
| Локалізувати "Тип події" | Використати `t.notificationEventType(entry.event_type)` |
| Повний текст повідомлення | Прибрати `truncateText()`, зробити колонку з `whitespace-pre-wrap` |

**Оновлена структура запиту outbox:**
```typescript
const { data, error } = await supabase
  .from('notification_outbox')
  .select(`
    *,
    profiles:profile_id (name)
  `)
  .order('created_at', { ascending: false })
  .limit(50);
```

---

### 4. Оновлений інтерфейс даних

```typescript
interface NotificationOutboxEntry {
  id: string;
  event_id: string;
  event_type: string;
  telegram_user_id: number;
  profile_id: string | null;
  message_text: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'canceled';
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  profiles?: { name: string | null } | null;
}
```

---

### 5. Візуальні зміни

**Правила нотифікацій:**

```
До:
| Код | Тип події | Канал | Статус | Отримувачі | Шаблон (обрізано) | Оновлено |

Після:
| Тип події (локалізовано) | Канал | Статус (clickable) | Отримувачі | Шаблон (повний) | Оновлено |
```

**Outbox:**

```
До:
| Створено | Тип події | Telegram ID | Статус | Спроб | Повідомлення (обрізано) | Помилка |

Після:
| Створено | Тип події (локалізовано) | Отримувач (ім'я) | Статус | Спроб | Повідомлення (повний) | Помилка |
```

---

### 6. Файли для редагування

1. **src/lib/i18n.ts** - додати `notificationEventType` блок
2. **supabase/migrations/...** - додати UPDATE RLS policy
3. **src/components/admin/NotificationsPanel.tsx** - основні зміни UI

---

### Технічні деталі

#### Функція toggle статусу:

```typescript
const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null);

const toggleRuleStatus = async (ruleId: string, currentStatus: boolean) => {
  setUpdatingRuleId(ruleId);
  try {
    const { error } = await supabase
      .from('notification_rules')
      .update({ is_enabled: !currentStatus })
      .eq('id', ruleId);
    
    if (error) throw error;
    
    // Оновити локальний стан
    setRules(rules.map(r => 
      r.id === ruleId ? { ...r, is_enabled: !currentStatus } : r
    ));
    
    toast({ title: 'Успішно', description: 'Статус правила оновлено' });
  } catch (error) {
    toast({ title: 'Помилка', description: 'Не вдалося оновити статус', variant: 'destructive' });
  } finally {
    setUpdatingRuleId(null);
  }
};
```

#### Оновлений опис в CardDescription:

```typescript
// Було:
<CardDescription>
  Налаштування правил Telegram-нотифікацій по подіях системи (read-only)
</CardDescription>

// Стане:
<CardDescription>
  Налаштування правил Telegram-нотифікацій по подіях системи
</CardDescription>
```

