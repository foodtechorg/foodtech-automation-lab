import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ PROMPTS ============

const SYSTEM_PROMPT = `Ти — GPT-агент "KB Index Writer" для FoodTech Automation. Твоя задача: з прикріпленого файлу (PDF/DOCX/XLSX/PNG/XML/текст) та доступних метаданих форми (Назва, Категорія, Статус, Рівень доступу, Версія, Дата/оновлено) згенерувати ОДИН структурований текст для індексації у векторному сховищі.

КРИТИЧНІ ПРАВИЛА (обов'язково):
1) Відповідай ВИКЛЮЧНО українською.
2) Заборонено вигадувати. Якщо даних нема у файлі/метаданих — пиши дослівно: "Інформація відсутня у документі".
3) Зберігай ТОЧНО всі числа, дати, назви, ролі/посади, абревіатури, терміни.
4) Не описуй технічні метадані файлу (типу "Microsoft Visio", "Identity Adobe", таймстемпи PDF), якщо вони не є змістом документа.
5) Формат ВИХОДУ має бути СТРОГО за шаблоном нижче (однакові ## та ** завжди).
6) Вихід має бути "копіювати-вставити": ТІЛЬКИ Markdown, без будь-яких пояснень, дисклеймерів, вступів, фраз типу "Ось текст", без списків "що я зробив".`;

const STAGE1_INSTRUCTIONS = `Витягни тільки підтверджені факти з документа у JSON форматі.

ВИХІДНИЙ ФОРМАТ (суворий JSON):
{
  "doc_title": "...",
  "doc_type": "SOP / Інструкція / Політика / Бізнес-процес (текст) / Бізнес-процес (BPMN) / Оргструктура / Регламент / Інше",
  "doc_category": "...",
  "version": "...",
  "status": "...",
  "access_level": "...",
  "effective_date": "...",
  "keywords": ["15-30 ключових слів/фраз, включаючи назви систем (FTA), відділів, ролей, статусів, документів, терміни, синоніми, абревіатури"],
  "purpose": "2-6 речень: для кого документ, яку задачу вирішує, коли застосовується",
  "scope": {
    "trigger": "Початок / тригер",
    "result": "Завершення / результат",
    "includes_excludes": "Що входить / не входить"
  },
  "roles": [
    {"role": "Роль/посада", "responsibility": "Відповідальність/дії"}
  ],
  "main_content": {
    "type": "SOP|BPMN|POLICY|OTHER",
    "steps": [
      {"step_no": 1, "action": "...", "responsible": "...", "sla": "..."}
    ],
    "rules": ["для політик/регламентів: що дозволено/заборонено/потрібно"],
    "branches": ["для BPMN: рішення/гілки/статуси"]
  },
  "sla_deadlines": [
    {"item": "...", "value": "..."}
  ],
  "artifacts_systems": {
    "systems": ["FTA, 1C, тощо"],
    "input_fields": ["поля/атрибути/вхідні дані"],
    "output_artifacts": ["вихідні артефакти/результати"]
  },
  "exceptions": [
    {"scenario": "...", "action": "..."}
  ],
  "faq_candidates": [
    {"q": "реалістичне питання співробітника", "a": "відповідь з документа"}
  ],
  "extraction_quality": {
    "is_graphical_or_unreadable": false,
    "notes": "..."
  }
}

ПРАВИЛА:
- keywords: 15-30 термінів, ТІЛЬКИ якщо вони реально є у тексті
- purpose: 2-6 речень призначення документа
- roles: ролі та їх відповідальності
- main_content: структуруй залежно від типу документа
- faq_candidates: 5-10 питань, тільки якщо є прямі відповіді у тексті
- Якщо блоку немає — "Інформація відсутня у документі" або порожній масив
- ЖОДНИХ припущень чи вигадок
- Повертай ТІЛЬКИ валідний JSON без markdown-обгортки`;

const STAGE2_INSTRUCTIONS = `На основі JSON створи фінальний Markdown для індексації за ТОЧНИМ шаблоном.

ШАБЛОН ВИХОДУ (використовуй САМЕ його):

# {doc_title}

**Тип документу:** {doc_type}

**Категорія:** {doc_category}

**Версія:** {version}

**Статус:** {status}

**Доступ:** {access_level}

**Дата чинності / Оновлено:** {effective_date}

Ключові слова: {keywords через кому, 15-30 термінів}

## 1) Призначення документа

{purpose - 2-6 речень. Якщо немає — "Інформація відсутня у документі".}

## 2) Область застосування / межі

- **Початок / тригер:** {scope.trigger або "Інформація відсутня у документі"}
- **Завершення / результат:** {scope.result або "Інформація відсутня у документі"}
- **Що входить / не входить:** {scope.includes_excludes або "Інформація відсутня у документі"}

## 3) Ролі та відповідальності

{Для кожної ролі:}
- {role} — {responsibility}
{Якщо ролей немає — "Інформація відсутня у документі".}

## 4) Основний зміст (правила / кроки / етапи)

{Структуруй залежно від main_content.type:}
- Для SOP/Інструкції: нумерований список кроків 1..N з короткими діями
- Для BPMN/процесу: етапи + рішення/гілки + статуси
- Для політик/регламентів: правила "дозволено/заборонено/потрібно", вимоги, контроль

{Якщо is_graphical_or_unreadable = true — виведи попередження що потрібен ручний опис}
{Якщо інформації немає — "Інформація відсутня у документі".}

## 5) SLA / строки / дедлайни / частота

{Для кожного пункту:}
- {item} — {value}
{Якщо немає — "Інформація відсутня у документі".}

## 6) Дані, поля, форми, артефакти, системи

- **Системи/інструменти:** {artifacts_systems.systems або "Інформація відсутня у документі"}
- **Поля/атрибути/вхідні дані:** {artifacts_systems.input_fields або "Інформація відсутня у документі"}
- **Вихідні артефакти/результати:** {artifacts_systems.output_artifacts або "Інформація відсутня у документі"}

## 7) Винятки та особливі випадки

{Для кожного винятку:}
- {scenario} — {action}
{Якщо немає — "Винятків не зазначено".}

## 8) FAQ (коротко)

{Для кожного питання з faq_candidates (5-10 питань):}
- {q}? — {a}
{Тільки реалістичні запити співробітників. Якщо відповіді немає — "Інформація відсутня у документі".}
{Якщо faq_candidates порожній — "FAQ неможливо сформувати: у документі відсутні прямі відповіді."}

ПРАВИЛА ФОРМАТУВАННЯ:
- Виводь ТІЛЬКИ Markdown без пояснень, вступів, дисклеймерів
- Не дублюй одне й те саме в різних секціях
- Уникай "води" — краще марковані/нумеровані списки
- Для SOP/Інструкція — підкреслюй покроковість, артефакти, терміни
- Для Оргструктури — ієрархія, підпорядкування, функції підрозділів
- Для BPMN (графіка) — опиши структуру: Тригер, Ролі, Гілки, SLA, Вихід`;

const GRAPHICAL_DOC_TEMPLATE = (title: string, category: string, version: string, status: string, accessLevel: string) => `# ${title}

**Тип документу:** [SOP / Інструкція / Політика / Бізнес-процес (текст) / Бізнес-процес (BPMN) / Оргструктура / Регламент / Інше]

**Категорія:** ${category}

**Версія:** ${version || 'не вказано'}

**Статус:** ${status}

**Доступ:** ${accessLevel}

**Дата чинності / Оновлено:** [Введіть дату]

Ключові слова: [Введіть 15-30 ключових термінів через кому]

## 1) Призначення документа

[Опишіть 2-6 реченнями: для кого документ, яку задачу вирішує, коли застосовується]

## 2) Область застосування / межі

- **Початок / тригер:** [Опишіть умови старту]
- **Завершення / результат:** [Опишіть результат]
- **Що входить / не входить:** [Опишіть межі]

## 3) Ролі та відповідальності

- [Роль 1] — [Відповідальність]
- [Роль 2] — [Відповідальність]

## 4) Основний зміст (правила / кроки / етапи)

1. [Крок 1] — [Відповідальний] — [SLA]
2. [Крок 2] — [Відповідальний] — [SLA]
3. [Крок 3] — [Відповідальний] — [SLA]

## 5) SLA / строки / дедлайни / частота

- [Пункт 1] — [Значення]
- [Пункт 2] — [Значення]

## 6) Дані, поля, форми, артефакти, системи

- **Системи/інструменти:** [Системи]
- **Поля/атрибути/вхідні дані:** [Вхідні дані]
- **Вихідні артефакти/результати:** [Результати]

## 7) Винятки та особливі випадки

- [Сценарій] — [Що робити]

## 8) FAQ (коротко)

- [Питання 1]? — [Відповідь]
- [Питання 2]? — [Відповідь]
- [Питання 3]? — [Відповідь]`;

// ============ LABEL MAPPINGS ============

const CATEGORY_LABELS: Record<string, string> = {
  SOP: 'SOP (Стандартна операційна процедура)',
  OrgStructure: 'Оргструктура',
  Policy: 'Політика',
  Instructions: 'Інструкції',
  BusinessProcess_BPMN: 'Бізнес-процес (BPMN)',
  BusinessProcess_Text: 'Бізнес-процес (текст)',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Активний',
  archived: 'В архіві',
};

const ACCESS_LABELS: Record<string, string> = {
  open: 'Відкритий доступ',
  restricted: 'Обмежений доступ',
};

// ============ QUALITY CHECK ============

interface QualityCheckResult {
  isLowQuality: boolean;
  reason: string;
}

function checkTextQuality(text: string): QualityCheckResult {
  if (text.length < 800) {
    return { isLowQuality: true, reason: 'Текст занадто короткий (< 800 символів)' };
  }

  const noiseKeywords = [
    'Producer', 'Adobe', 'Visio', 'XMP', 'Creator Tool',
    'ModDate', 'CreationDate', 'PDFVersion', 'Acrobat',
    'Microsoft Office', 'Generated by', 'xmlns', 'xpacket',
    'DocumentProperties', 'meta:creation-date', 'dc:creator',
  ];

  const lowerText = text.toLowerCase();
  const noiseCount = noiseKeywords.filter(kw =>
    lowerText.includes(kw.toLowerCase())
  ).length;

  const businessWords = text.match(
    /\b(процес|крок|відповідальн|термін|документ|заявка|погодження|затвердження|підрозділ|керівник|менеджер|спеціаліст|виконавець|замовник|постачальник|договір|рахунок|оплата|доставка)\b/gi
  ) || [];

  if (noiseCount > 5 && businessWords.length < 10) {
    return {
      isLowQuality: true,
      reason: 'Текст переважно містить технічні метадані без бізнес-змісту',
    };
  }

  return { isLowQuality: false, reason: '' };
}

// ============ TEXT EXTRACTION ============

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\x00/g, '')
    .trim();
}

function extractTextFromPDF(data: Uint8Array): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const textMatches: string[] = [];

    const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
    let match;
    while ((match = btEtRegex.exec(text)) !== null) {
      const content = match[1];
      const stringRegex = /\(([^)]*)\)|<([0-9A-Fa-f]+)>/g;
      let strMatch;
      while ((strMatch = stringRegex.exec(content)) !== null) {
        if (strMatch[1]) {
          textMatches.push(strMatch[1]);
        }
      }
    }

    const readableRegex = /\/T[cj]\s*\(([^)]+)\)/g;
    while ((match = readableRegex.exec(text)) !== null) {
      textMatches.push(match[1]);
    }

    const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
    while ((match = streamRegex.exec(text)) !== null) {
      const streamContent = match[1];
      const textInStream = streamContent.match(/\(([^)]{2,})\)/g);
      if (textInStream) {
        textInStream.forEach(t => {
          const cleaned = t.slice(1, -1);
          if (cleaned.length > 2 && /[а-яА-ЯіІїЇєЄa-zA-Z]/.test(cleaned)) {
            textMatches.push(cleaned);
          }
        });
      }
    }

    const result = textMatches.join(' ');
    return result.length > 100 ? result : '';
  } catch {
    return '';
  }
}

function extractTextFromDOCX(data: Uint8Array): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const textParts: string[] = [];

    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = textRegex.exec(text)) !== null) {
      if (match[1].trim()) {
        textParts.push(match[1]);
      }
    }

    const paraRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    const paragraphs: string[] = [];
    while ((match = paraRegex.exec(text)) !== null) {
      const paraText = match[1].replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, '$1');
      if (paraText.trim()) {
        paragraphs.push(paraText.trim());
      }
    }

    return paragraphs.length > 0 ? paragraphs.join('\n') : textParts.join(' ');
  } catch {
    return '';
  }
}

// ============ MAIN HANDLER ============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables');
    }
    if (!LOVABLE_API_KEY) {
      throw new Error('Missing LOVABLE_API_KEY');
    }

    const authHeader = req.headers.get('Authorization');
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader || '' } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = roles?.map(r => r.role) || [];
    if (!userRoles.includes('coo') && !userRoles.includes('admin')) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'document_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('=== KB Generate Index Text (GPT-5 Two-Stage) ===');
    console.log(`Document ID: ${document_id}`);

    const { data: doc, error: docError } = await supabaseAdmin
      .from('kb_documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    console.log(`Title: ${doc.title}`);
    console.log(`Category: ${doc.category}`);
    console.log(`MIME Type: ${doc.mime_type || 'not set'}`);
    console.log(`Storage Path: ${doc.storage_path || 'not set'}`);

    const metadataContext = `
Назва: ${doc.title}
Категорія: ${CATEGORY_LABELS[doc.category] || doc.category}
Версія: ${doc.version || 'не вказано'}
Статус: ${STATUS_LABELS[doc.status] || doc.status}
Рівень доступу: ${ACCESS_LABELS[doc.access_level] || doc.access_level}
`.trim();

    let extractedText = '';
    let fileSize = 0;
    let textSource = 'none';
    let fileExtractedText = '';

    // ============ ПРІОРИТЕТ 1: raw_text поле (якщо заповнене та якісне) ============
    if (doc.raw_text && doc.raw_text.trim().length > 500) {
      const rawTextQuality = checkTextQuality(doc.raw_text);
      if (!rawTextQuality.isLowQuality) {
        extractedText = doc.raw_text;
        textSource = 'raw_text_field';
        console.log(`Using raw_text field (${doc.raw_text.length} chars) - good quality`);
      } else {
        console.log(`raw_text field has low quality: ${rawTextQuality.reason}`);
      }
    }

    // ============ ПРІОРИТЕТ 2: Витягування з файлу (якщо raw_text недоступний/неякісний) ============
    if (!extractedText && doc.storage_bucket && doc.storage_path) {
      try {
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from(doc.storage_bucket)
          .download(doc.storage_path);

        if (downloadError) {
          console.log(`File download error: ${downloadError.message}`);
        } else if (fileData) {
          fileSize = fileData.size;
          console.log(`File size: ${fileSize} bytes`);

          const arrayBuffer = await fileData.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const mimeType = doc.mime_type || '';

          // Текстові та XML файли - добре витягуються
          if (mimeType.includes('text/plain') || mimeType.includes('text/xml') || mimeType.includes('application/xml')) {
            fileExtractedText = new TextDecoder('utf-8').decode(uint8Array);
            textSource = 'text/xml';
          } 
          // PDF - примітивне витягування (часто неякісне)
          else if (mimeType.includes('application/pdf')) {
            fileExtractedText = extractTextFromPDF(uint8Array);
            textSource = 'pdf';
            console.log(`PDF extraction result: ${fileExtractedText.length} chars`);
            // Перевірка якості PDF витягування
            if (fileExtractedText.length < 200) {
              console.log('PDF extraction produced minimal text - likely compressed/scanned');
            }
          } 
          // DOCX - може не працювати без розпакування ZIP
          else if (mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml')) {
            fileExtractedText = extractTextFromDOCX(uint8Array);
            textSource = 'docx';
            console.log(`DOCX extraction result: ${fileExtractedText.length} chars`);
          } 
          // Зображення - потребують OCR
          else if (mimeType.includes('image/')) {
            textSource = 'image';
            console.log('Image file detected - OCR not available, will use template');
          } 
          // Excel - складна структура
          else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
            textSource = 'xlsx';
            console.log('Excel file detected - extraction not supported, will use template');
          } 
          // Інші файли
          else {
            fileExtractedText = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
            textSource = 'generic';
          }

          // Використовуємо витягнутий текст якщо він якісний
          if (fileExtractedText) {
            const fileQuality = checkTextQuality(fileExtractedText);
            if (!fileQuality.isLowQuality) {
              extractedText = fileExtractedText;
              console.log(`File extraction successful: ${extractedText.length} chars`);
            } else {
              console.log(`File extraction low quality: ${fileQuality.reason}`);
              // Спробуємо raw_text як fallback навіть якщо він коротший
              if (doc.raw_text && doc.raw_text.trim().length > 100) {
                extractedText = doc.raw_text;
                textSource = 'raw_text_fallback';
                console.log(`Falling back to raw_text: ${extractedText.length} chars`);
              }
            }
          }
        }
      } catch (e) {
        console.log(`File processing error: ${e}`);
      }
    }

    // ============ ПРІОРИТЕТ 3: Будь-який raw_text як останній варіант ============
    if (!extractedText && doc.raw_text) {
      extractedText = doc.raw_text;
      textSource = 'raw_text_last_resort';
      console.log(`Using raw_text as last resort: ${extractedText.length} chars`);
    }

    extractedText = cleanText(extractedText);
    console.log(`Text source: ${textSource}`);
    console.log(`Extracted text length: ${extractedText.length} chars`);

    const qualityCheck = checkTextQuality(extractedText);
    console.log(`Quality check: ${qualityCheck.isLowQuality ? 'LOW - ' + qualityCheck.reason : 'OK'}`);

    if (qualityCheck.isLowQuality || textSource === 'image') {
      const template = GRAPHICAL_DOC_TEMPLATE(
        doc.title,
        CATEGORY_LABELS[doc.category] || doc.category,
        doc.version || '',
        STATUS_LABELS[doc.status] || doc.status,
        ACCESS_LABELS[doc.access_level] || doc.access_level
      );

      console.log('Returning template for manual editing');
      return new Response(JSON.stringify({
        generatedText: template,
        source: textSource,
        isTemplate: true,
        qualityNote: qualityCheck.reason || 'Графічний або нечитабельний документ',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const MAX_CHARS = 80000;
    let wasTruncated = false;
    if (extractedText.length > MAX_CHARS) {
      extractedText = extractedText.slice(0, MAX_CHARS);
      wasTruncated = true;
      console.log(`Text truncated to ${MAX_CHARS} chars`);
    }

    // ============ STAGE 1: Extract Facts as JSON ============
    console.log('--- Stage 1: Extracting facts to JSON ---');

    const stage1Response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${STAGE1_INSTRUCTIONS}

=== МЕТАДАНІ ДОКУМЕНТА ===
${metadataContext}

=== ТЕКСТ ДОКУМЕНТА ДЛЯ АНАЛІЗУ ===
${extractedText}

=== КІНЕЦЬ ДОКУМЕНТА ===`,
          },
        ],
      }),
    });

    if (!stage1Response.ok) {
      const errorText = await stage1Response.text();
      console.error(`Stage 1 API error: ${stage1Response.status} - ${errorText}`);

      if (stage1Response.status === 429) {
        return new Response(JSON.stringify({
          error: 'Перевищено ліміт запитів. Спробуйте пізніше.',
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (stage1Response.status === 402) {
        return new Response(JSON.stringify({
          error: 'Недостатньо кредитів AI. Зверніться до адміністратора.',
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Stage 1 failed: ${stage1Response.status}`);
    }

    const stage1Data = await stage1Response.json();
    const factsJson = stage1Data.choices?.[0]?.message?.content || '';
    console.log(`Stage 1 output length: ${factsJson.length} chars`);

    // ============ STAGE 2: Generate Markdown from JSON ============
    console.log('--- Stage 2: Generating Markdown from JSON ---');

    const stage2Response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${STAGE2_INSTRUCTIONS}

=== JSON ФАКТИ З ДОКУМЕНТА ===
${factsJson}

=== КІНЕЦЬ JSON ===`,
          },
        ],
      }),
    });

    if (!stage2Response.ok) {
      const errorText = await stage2Response.text();
      console.error(`Stage 2 API error: ${stage2Response.status} - ${errorText}`);

      if (stage2Response.status === 429) {
        return new Response(JSON.stringify({
          error: 'Перевищено ліміт запитів. Спробуйте пізніше.',
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (stage2Response.status === 402) {
        return new Response(JSON.stringify({
          error: 'Недостатньо кредитів AI. Зверніться до адміністратора.',
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Stage 2 failed: ${stage2Response.status}`);
    }

    const stage2Data = await stage2Response.json();
    const generatedText = stage2Data.choices?.[0]?.message?.content || '';
    console.log(`Stage 2 output length: ${generatedText.length} chars`);
    console.log('=== Generation complete ===');

    return new Response(JSON.stringify({
      generatedText,
      source: textSource,
      wasTruncated,
      isTemplate: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('KB Generate Index Text error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
