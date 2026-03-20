

## План: Виправити відображення лабораторних та пілотних результатів

### Проблема

Компоненти `LabResultsForm` та `PilotResultsForm` мають список статусів, при яких дані завантажуються з бази. Цей список **не збігається** зі списком статусів, при яких секція відображається.

**SampleDetail** показує секцію лабораторії при статусах:
`Lab, LabDone, Pilot, PilotDone, Testing, Approved, Rejected, ReadyForHandoff, HandedOff`

**LabResultsForm** завантажує дані лише при:
`Lab, LabDone, Pilot, PilotDone, ReadyForHandoff, HandedOff`

**Відсутні**: `Testing`, `Approved`, `Rejected` — тому при цих статусах форма показується, але дані не запитуються і всі поля порожні ("—").

Аналогічно для **PilotResultsForm** — query увімкнений тільки при `Pilot` та `PilotDone` (рядок 54, 61), а секція показується і при `Testing`, `Approved`, `Rejected`, `ReadyForHandoff`, `HandedOff`.

### Зміни

**1. `src/components/development/LabResultsForm.tsx`** — рядок 54:

Додати `Testing`, `Approved`, `Rejected` до `shouldLoadLabResults`:
```typescript
const shouldLoadLabResults = ['Lab', 'LabDone', 'Pilot', 'PilotDone', 'Testing', 'Approved', 'Rejected', 'ReadyForHandoff', 'HandedOff'].includes(sampleStatus);
```

**2. `src/components/development/PilotResultsForm.tsx`** — рядки 54, 61:

Змінити `showForm` та `enabled`, щоб включити всі пост-пілотні статуси:
```typescript
const showForm = ['Pilot', 'PilotDone', 'Testing', 'Approved', 'Rejected', 'ReadyForHandoff', 'HandedOff'].includes(sampleStatus);
```

Також `isReadOnly` повинен бути `true` для всіх статусів крім `Pilot`:
```typescript
const isReadOnly = sampleStatus !== 'Pilot' || !canEdit;
```

### Результат

Після змін усі користувачі з доступом до модуля Розробка бачитимуть заповнені дані лабораторних аналізів та дегустаційних листів на всіх етапах після їх заповнення.

