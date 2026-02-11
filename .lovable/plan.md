

## Виправлення OG-зображення при шерінгу посилання

### Проблема

У файлі `index.html` в мета-тегах `og:image` та `twitter:image` вказано зображення Lovable за замовчуванням (`https://lovable.dev/opengraph-image-p98pqg.png`). Саме тому при відправці посилання в месенджерах відображається заставка Lovable.

### Рішення

1. **Створити OG-зображення** для FoodTech (рекомендований розмір: 1200x630 px) на основі логотипу FoodTech з оливково-зеленим брендовим кольором
2. **Розмістити** його в папці `public/og-image.png`
3. **Оновити `index.html`** -- замінити URL зображення в мета-тегах

### Зміни

| Файл | Дія | Опис |
|------|-----|------|
| `public/og-image.png` | Створити | OG-зображення 1200x630 з логотипом FoodTech |
| `index.html` | Редагувати | Замінити URL в og:image та twitter:image |

### Деталі змін в `index.html`

Замінити:
```html
<meta property="og:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
<meta name="twitter:image" content="https://lovable.dev/opengraph-image-p98pqg.png" />
```

На:
```html
<meta property="og:image" content="https://rd.foodtech.org.ua/og-image.png" />
<meta name="twitter:image" content="https://rd.foodtech.org.ua/og-image.png" />
```

### Примітка

OG-зображення буде згенеровано через AI (Nano banana) з логотипом FoodTech на оливково-зеленому фоні. Після публікації може знадобитись деякий час, щоб месенджери оновили кеш превью.

