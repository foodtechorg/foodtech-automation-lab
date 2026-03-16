

## План: Виправити відправку нотифікації при передачі на тестування

### Проблема

У `QuickHandoffDialog` (і частково у `HandoffDialog`) код нотифікації виконується **після** `onSuccess()`, який закриває діалог і перезавантажує дані. Якщо `onSuccess` викликає навігацію або unmount компонента, промис `enqueueNotificationEvent` обривається і нотифікація ніколи не створюється.

### Рішення

Перенести виклик нотифікації **до** закриття діалогу та `onSuccess()`. Обернути у `try/catch`, щоб помилка нотифікації не блокувала основний потік.

### Зміни

**1. `src/components/development/QuickHandoffDialog.tsx`** — переставити порядок:

```text
Поточний порядок (рядки 55-100):
  1. quickHandoffToTesting()
  2. toast
  3. resetForm + closeDialog + onSuccess()  ← unmount
  4. enqueueNotificationEvent()  ← обривається

Новий порядок:
  1. quickHandoffToTesting()
  2. toast
  3. enqueueNotificationEvent()  ← виконується до unmount
  4. resetForm + closeDialog + onSuccess()
```

**2. `src/components/development/HandoffDialog.tsx`** — аналогічно переставити: нотифікацію перед `onOpenChange(false)` та `onSuccess()`.

