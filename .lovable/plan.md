

## План: Виправити вибір позиції сировини з випадаючого списку

### Проблема

Dropdown рендериться через React Portal в `document.body`, але обробник кліку зовні (`handleClickOutside`) перевіряє лише `containerRef` (обгортку input). Клік по кнопці у dropdown-списку спрацьовує як "клік зовні" — dropdown закривається **до** того, як спрацює `onClick` на кнопці. Тому вибір не фіксується.

### Зміна

**`src/components/purchase/RawMaterialAutocomplete.tsx`** — додати ref для dropdown і враховувати його в `handleClickOutside`:

1. Додати `dropdownRef = useRef<HTMLDivElement>(null)`.
2. Обгорнути весь dropdown-контент у `<div ref={dropdownRef}>`.
3. В `handleClickOutside` перевіряти обидва ref: якщо клік всередині `containerRef` **або** `dropdownRef` — не закривати.

```typescript
// Було:
if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
  setOpen(false);
}

// Стане:
const clickedInContainer = containerRef.current?.contains(e.target as Node);
const clickedInDropdown = dropdownRef.current?.contains(e.target as Node);
if (!clickedInContainer && !clickedInDropdown) {
  setOpen(false);
}
```

