

## План: Спрощений процес тестування для заявок 1-го рівня складності

### Огляд

Реалізація спрощеного workflow для заявок R&D з рівнем складності "1 - Легкий" (EASY), що дозволяє пропустити створення рецептів та зразків і відразу надіслати на тестування.

---

### 1. Розширена інформація про заявку в модулі Розробка

**Файл: `src/pages/development/DevelopmentRequestDetail.tsx`**

Додати поля з модуля "Заявки R&D" до картки "Інформація про заявку":

| Поле | Опис |
|------|------|
| Контакт замовника | `customer_contact` |
| Автор | `author_email` (з перетворенням на ім'я) |
| Дата створення | `created_at` |
| Бажана дата завершення | `desired_due_date` |
| Наявність зразка аналогу | `has_sample_analog` (Так/Ні) |
| Рівень складності | `complexity_level` з кольоровим Badge |

**Структура оновленої картки:**

```
| Компанія замовника | 
| Вид продукту       | Напрямок розробки  |
| Автор              | Створено           |
| Бажана дата        | Наявність аналогу  |
| Пріоритет          | Складність         | 
| Опис (на всю ширину)                      |
```

---

### 2. Блок "Наступні кроки" для заявок рівня 1

**Новий компонент: `src/components/development/QuickHandoffBlock.tsx`**

Для заявок з `complexity_level === 'EASY'`:

- Показувати блок "Наступні кроки" одразу на рівні заявки (під вкладками Рецепти/Зразки)
- Всі три етапи (Лабораторія, Пілот, Передача на тестування) активні одночасно
- Кожен етап є опціональним
- Основний CTA: "Передати на тестування" - завжди активний

**Візуалізація:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Наступні кроки                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────────┐  │
│  │ Лабораторія  │   │ Пілот/       │   │ ★ Передача на тестування  │  │
│  │ (опційно)    │   │ Дегустація   │   │                            │  │
│  │              │   │ (опційно)    │   │  [Передати на тестування]  │  │
│  └──────────────┘   └──────────────┘   └────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Новий діалог "Передати на тестування" для рівня 1

**Новий компонент: `src/components/development/QuickHandoffDialog.tsx`**

Поля діалогу:
- **Назва продукту** (обов'язкове) - текстове поле
- **Вага, г** (обов'язкове) - числове поле

**Приклад UI:**

```
┌─────────────────────────────────────────────────────┐
│  ✈ Передати на тестування                           │
├─────────────────────────────────────────────────────┤
│  Заявка RD-0029 буде передано менеджеру для         │
│  тестування у клієнта.                              │
│                                                     │
│  Назва продукту *                                   │
│  ┌────────────────────────────────────────────┐    │
│  │                                            │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  Вага, г *                                          │
│  ┌────────────────────────────────────────────┐    │
│  │                                            │    │
│  └────────────────────────────────────────────┘    │
│                                                     │
│  ┌──────────────────────────────────┐              │
│  │ Відображатиметься як:            │              │
│  │ Маринад Мед-гірчиця (RD-0029/Q1) │              │
│  └──────────────────────────────────┘              │
│                                                     │
│               [Скасувати]   [✈ Передати]           │
└─────────────────────────────────────────────────────┘
```

---

### 4. Нова RPC функція: `quick_handoff_to_testing`

**Файл: Міграція в `supabase/migrations/`**

```sql
CREATE OR REPLACE FUNCTION public.quick_handoff_to_testing(
  p_request_id uuid,
  p_product_name text,
  p_weight_g numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_sample_seq integer;
  v_sample_code text;
  v_display_name text;
  v_sample_id uuid;
  v_actor_email text;
BEGIN
  -- Get request details
  SELECT * INTO v_request FROM requests WHERE id = p_request_id;
  
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  
  -- Verify request complexity is EASY
  IF v_request.complexity_level != 'EASY' THEN
    RAISE EXCEPTION 'Quick handoff is only available for EASY complexity requests';
  END IF;
  
  -- Validate inputs
  IF p_product_name IS NULL OR trim(p_product_name) = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;
  
  IF p_weight_g IS NULL OR p_weight_g <= 0 THEN
    RAISE EXCEPTION 'Weight must be positive';
  END IF;
  
  -- Get actor email
  SELECT email INTO v_actor_email FROM profiles WHERE id = auth.uid();
  
  -- Calculate next sample sequence (Q1, Q2, Q3...)
  SELECT COALESCE(MAX(sample_seq), 0) + 1 INTO v_sample_seq
  FROM development_samples
  WHERE request_id = p_request_id;
  
  -- Generate sample code: RD-XXXX/Q1, RD-XXXX/Q2
  v_sample_code := v_request.code || '/Q' || v_sample_seq;
  
  -- Build display name
  v_display_name := p_product_name || ' (' || v_sample_code || ')';
  
  -- Create quick sample (no recipe, no ingredients)
  INSERT INTO development_samples (
    id,
    request_id,
    recipe_id,  -- NULL for quick samples
    sample_seq,
    sample_code,
    batch_weight_g,
    status,
    working_title,
    created_by
  ) VALUES (
    gen_random_uuid(),
    p_request_id,
    NULL,  -- No recipe for quick handoff
    v_sample_seq,
    v_sample_code,
    p_weight_g,
    'Testing',
    p_product_name,
    auth.uid()
  )
  RETURNING id INTO v_sample_id;
  
  -- Update request status to SENT_FOR_TEST
  UPDATE requests
  SET 
    status = 'SENT_FOR_TEST',
    date_sent_for_test = COALESCE(date_sent_for_test, now()),
    updated_at = now()
  WHERE id = p_request_id;
  
  -- Create testing sample record
  INSERT INTO rd_request_testing_samples (
    request_id,
    sample_id,
    sample_code,
    recipe_code,
    working_title,
    display_name,
    status,
    sent_by,
    sent_at
  ) VALUES (
    p_request_id,
    v_sample_id,
    v_sample_code,
    'Швидка передача',  -- No recipe for quick handoff
    p_product_name,
    v_display_name,
    'Sent',
    auth.uid(),
    now()
  );
  
  -- Log event to request chronology
  INSERT INTO request_events (request_id, actor_email, event_type, payload)
  VALUES (
    p_request_id,
    v_actor_email,
    'SAMPLE_SENT_FOR_TESTING',
    jsonb_build_object(
      'sample_id', v_sample_id,
      'sample_code', v_sample_code,
      'display_name', v_display_name,
      'working_title', p_product_name,
      'weight_g', p_weight_g,
      'quick_handoff', true
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'sample_id', v_sample_id,
    'sample_code', v_sample_code,
    'display_name', v_display_name,
    'request_status', 'SENT_FOR_TEST',
    'testing_sample', jsonb_build_object(
      'sample_id', v_sample_id,
      'sample_code', v_sample_code,
      'request_id', p_request_id
    )
  );
END;
$$;
```

**Модифікація таблиці:**

```sql
-- Allow NULL recipe_id for quick handoff samples
ALTER TABLE development_samples 
ALTER COLUMN recipe_id DROP NOT NULL;
```

---

### 5. API сервіс: `samplesApi.ts`

**Додати нову функцію:**

```typescript
export interface QuickHandoffResult {
  success: boolean;
  sample_id: string;
  sample_code: string;
  display_name: string;
  request_status: string;
  testing_sample: {
    sample_id: string;
    sample_code: string;
    request_id: string;
  };
}

export async function quickHandoffToTesting(
  requestId: string,
  productName: string,
  weightG: number
): Promise<QuickHandoffResult> {
  const { data, error } = await supabase.rpc('quick_handoff_to_testing', {
    p_request_id: requestId,
    p_product_name: productName,
    p_weight_g: weightG
  });

  if (error) throw error;
  return data as QuickHandoffResult;
}
```

---

### 6. Інтеграція в DevelopmentRequestDetail.tsx

**Логіка відображення:**

```typescript
const isEasyComplexity = request?.complexity_level === 'EASY';
const canQuickHandoff = canEdit && isEasyComplexity;

// В JSX після карточки "Інформація про заявку" і перед вкладками:
{canQuickHandoff && (
  <QuickHandoffBlock
    requestId={id!}
    requestCode={request.code}
    canEdit={canEdit}
    onSuccess={() => {
      queryClient.invalidateQueries({ queryKey: ['development-request', id] });
    }}
  />
)}
```

---

### 7. Оновлення локалізації

**Файл: `src/lib/i18n.ts`**

```typescript
quickHandoff: {
  title: 'Передати на тестування',
  description: 'Заявка буде передана менеджеру для тестування у клієнта.',
  productName: 'Назва продукту',
  productNamePlaceholder: 'Введіть назву продукту',
  weight: 'Вага, г',
  weightPlaceholder: 'Введіть вагу в грамах',
  preview: 'Відображатиметься як:',
  cancel: 'Скасувати',
  submit: 'Передати',
  submitting: 'Передача...',
  success: 'Зразок передано на тестування',
  optionalStep: '(опційно)'
}
```

---

### 8. Файли для створення/редагування

| Файл | Дія | Опис |
|------|-----|------|
| `supabase/migrations/XXXXXX_quick_handoff.sql` | Створити | RPC функція + ALTER TABLE |
| `src/services/samplesApi.ts` | Редагувати | Додати `quickHandoffToTesting` |
| `src/components/development/QuickHandoffBlock.tsx` | Створити | UI блок "Наступні кроки" для EASY |
| `src/components/development/QuickHandoffDialog.tsx` | Створити | Діалог з полями Назва/Вага |
| `src/pages/development/DevelopmentRequestDetail.tsx` | Редагувати | Розширена інформація + QuickHandoffBlock |
| `src/lib/i18n.ts` | Редагувати | Додати переклади |

---

### 9. Потік даних

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Заявка RD-0029 (complexity_level = 'EASY')                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  QuickHandoffBlock показує всі 3 етапи як опційні + кнопку "Передати"       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  QuickHandoffDialog: Назва продукту + Вага (г)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  RPC: quick_handoff_to_testing                                              │
│  1. Створює development_sample (recipe_id = NULL, status = 'Testing')      │
│  2. Створює rd_request_testing_samples (status = 'Sent')                   │
│  3. Оновлює requests.status = 'SENT_FOR_TEST'                              │
│  4. Логує подію SAMPLE_SENT_FOR_TESTING                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Модуль "Заявки R&D" → TestingSamplesSection показує новий зразок           │
│  Замовник може: Погодити / Відхилити                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
              ┌─────────────────┐     ┌─────────────────┐
              │ Погоджено       │     │ Відхилено       │
              │ APPROVED_FOR_   │     │ Можна передати  │
              │ PRODUCTION      │     │ ще раз (Q2, Q3) │
              └─────────────────┘     └─────────────────┘
```

---

### 10. Множинні передачі на тестування

Функція підтримує повторні передачі:
- Кожна передача створює новий зразок з унікальним кодом (Q1, Q2, Q3...)
- Якщо зразок відхилено - можна відправити новий
- Якщо зразок погоджено - заявка закривається як APPROVED_FOR_PRODUCTION
- Всі зразки відображаються в "Зразки на тестуванні" в модулі "Заявки R&D"

