import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Ти - асистент для створення індексаційного тексту Knowledge Base документів.

ПРАВИЛА:
- Українська мова
- Тільки факти з документа, без вигадок
- Якщо даних немає - пиши "не вказано" або пропускай секцію
- Вихід ТІЛЬКИ у форматі Markdown
- Структуруй текст логічними блоками для ефективного векторного пошуку

ФОРМАТ ВИХОДУ:
# {title} — {category}

**Версія:** {version або "не вказано"}
**Статус:** {status}
**Рівень доступу:** {access_level}

## Ключові слова
10-20 ключових термінів через кому, які найкраще характеризують документ

## Опис
Короткий опис документа (2-3 речення про призначення та суть)

## Основний зміст
{Залежно від типу документа:
- Для SOP/Інструкцій: покрокові дії, правила, обов'язки
- Для Оргструктури: підрозділи, ієрархія, відповідальні
- Для Політик: принципи, норми, обмеження
- Для Бізнес-процесів: етапи, учасники, входи/виходи}

## Винятки та особливі випадки
{Якщо є - опиши випадки, коли правила відрізняються}

## FAQ
5-10 питань і відповідей на основі документа у форматі:
**Q:** Питання?
**A:** Відповідь.

---
МЕТА: текст має бути "вектор-дружній" - логічні блоки, списки, ключові терміни, правила, винятки для точного пошуку.`;

const CATEGORY_LABELS: Record<string, string> = {
  SOP: 'SOP',
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create clients
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user role
    const { data: profile, error: profileError } = await supabaseUser
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.role !== 'coo' && profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Доступ заборонено. Потрібна роль COO або Admin.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: 'document_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch document
    const { data: doc, error: docError } = await supabaseUser
      .from('kb_documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError || !doc) {
      console.error('Document error:', docError);
      return new Response(
        JSON.stringify({ error: 'Документ не знайдено' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let extractedText = '';
    let sourceInfo = '';

    // Try to extract text from file if available
    if (doc.storage_bucket && doc.storage_path) {
      console.log(`Downloading file from ${doc.storage_bucket}/${doc.storage_path}`);
      
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from(doc.storage_bucket)
        .download(doc.storage_path);

      if (downloadError) {
        console.error('Download error:', downloadError);
        // Fallback to raw_text if file download fails
        if (doc.raw_text) {
          extractedText = doc.raw_text;
          sourceInfo = 'Використано існуючий текст (файл недоступний)';
        } else {
          return new Response(
            JSON.stringify({ error: 'Не вдалося завантажити файл. Введіть текст вручну.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Extract text based on mime type
        const mimeType = doc.mime_type || '';
        console.log(`Processing file with mime type: ${mimeType}`);

        try {
          if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
            extractedText = await fileData.text();
            sourceInfo = 'Витягнуто з текстового файлу';
          } else if (mimeType === 'text/xml' || mimeType === 'application/xml' || mimeType.includes('bpmn')) {
            const xmlText = await fileData.text();
            // Extract text content from XML, removing tags
            extractedText = xmlText
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            sourceInfo = 'Витягнуто з XML/BPMN файлу';
          } else if (mimeType === 'application/pdf') {
            // For PDF, we'll use a simple approach - try to read as text
            // In production, you'd use a proper PDF parser
            const arrayBuffer = await fileData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Simple text extraction from PDF (basic approach)
            let textContent = '';
            const decoder = new TextDecoder('utf-8', { fatal: false });
            const pdfText = decoder.decode(uint8Array);
            
            // Extract text between stream and endstream, or between BT and ET
            const textMatches = pdfText.match(/\(((?:[^()\\]|\\.)*)\)/g) || [];
            textContent = textMatches
              .map(m => m.slice(1, -1).replace(/\\/g, ''))
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            if (textContent.length > 100) {
              extractedText = textContent;
              sourceInfo = 'Витягнуто з PDF файлу (базовий парсинг)';
            } else if (doc.raw_text) {
              extractedText = doc.raw_text;
              sourceInfo = 'PDF важко прочитати автоматично, використано існуючий текст';
            } else {
              return new Response(
                JSON.stringify({ 
                  error: 'PDF файл неможливо автоматично прочитати. Будь ласка, скопіюйте текст вручну.',
                  warning: true
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else if (mimeType.includes('word') || mimeType.includes('document')) {
            // DOCX is a ZIP file with XML inside
            // Simple extraction - in production use mammoth or similar
            const arrayBuffer = await fileData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const decoder = new TextDecoder('utf-8', { fatal: false });
            const rawContent = decoder.decode(uint8Array);
            
            // Extract text from XML parts
            const textMatches = rawContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
            const docxText = textMatches
              .map(m => m.replace(/<[^>]*>/g, ''))
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            if (docxText.length > 50) {
              extractedText = docxText;
              sourceInfo = 'Витягнуто з DOCX файлу';
            } else if (doc.raw_text) {
              extractedText = doc.raw_text;
              sourceInfo = 'DOCX важко прочитати автоматично, використано існуючий текст';
            } else {
              return new Response(
                JSON.stringify({ 
                  error: 'DOCX файл неможливо автоматично прочитати. Будь ласка, скопіюйте текст вручну.',
                  warning: true
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('xlsx')) {
            // Excel files are complex - use fallback
            if (doc.raw_text) {
              extractedText = doc.raw_text;
              sourceInfo = 'Excel-файли потребують ручного копіювання, використано існуючий текст';
            } else {
              return new Response(
                JSON.stringify({ 
                  error: 'Excel файли потребують ручного копіювання тексту. Будь ласка, введіть текст вручну.',
                  warning: true
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else if (mimeType.startsWith('image/')) {
            if (doc.raw_text) {
              extractedText = doc.raw_text;
              sourceInfo = 'Зображення не підтримують автоматичне витягування, використано існуючий текст';
            } else {
              return new Response(
                JSON.stringify({ 
                  error: 'Для зображень текст потрібно ввести вручну. OCR поки не підтримується.',
                  warning: true
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } else {
            // Unknown format - try as text
            try {
              extractedText = await fileData.text();
              sourceInfo = `Витягнуто як текст (${mimeType})`;
            } catch {
              if (doc.raw_text) {
                extractedText = doc.raw_text;
                sourceInfo = 'Невідомий формат, використано існуючий текст';
              } else {
                return new Response(
                  JSON.stringify({ error: `Формат ${mimeType} не підтримується для автоматичного витягування` }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          if (doc.raw_text) {
            extractedText = doc.raw_text;
            sourceInfo = 'Помилка парсингу файлу, використано існуючий текст';
          } else {
            return new Response(
              JSON.stringify({ error: 'Помилка при обробці файлу. Введіть текст вручну.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    } else if (doc.raw_text) {
      // No file, use existing raw_text
      extractedText = doc.raw_text;
      sourceInfo = 'Використано існуючий текст (файл не завантажено)';
    } else {
      return new Response(
        JSON.stringify({ error: 'Немає файлу або тексту для обробки. Спочатку завантажте файл або введіть текст.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean and truncate text if needed
    extractedText = extractedText
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    const MAX_CHARS = 50000;
    let truncated = false;
    if (extractedText.length > MAX_CHARS) {
      extractedText = extractedText.substring(0, MAX_CHARS);
      truncated = true;
      console.log(`Text truncated to ${MAX_CHARS} characters`);
    }

    // Prepare context for AI
    const context = `
МЕТАДАНІ ДОКУМЕНТА:
- Назва: ${doc.title}
- Категорія: ${CATEGORY_LABELS[doc.category] || doc.category}
- Версія: ${doc.version || 'не вказано'}
- Статус: ${STATUS_LABELS[doc.status] || doc.status}
- Рівень доступу: ${ACCESS_LABELS[doc.access_level] || doc.access_level}

ВИХІДНИЙ ТЕКСТ ДОКУМЕНТА:
${extractedText}
`;

    console.log(`Sending to AI: ${context.length} characters`);

    // Call Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: context }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorText = await aiResponse.text();
      console.error(`AI Gateway error: ${status}`, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Перевищено ліміт запитів AI. Спробуйте через хвилину.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: 'Потрібно поповнити баланс Lovable AI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Помилка AI сервісу. Спробуйте пізніше.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content;

    if (!generatedText) {
      console.error('No content in AI response:', aiData);
      return new Response(
        JSON.stringify({ error: 'AI не згенерував текст. Спробуйте ще раз.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generated text: ${generatedText.length} characters`);

    return new Response(
      JSON.stringify({ 
        generatedText,
        sourceInfo,
        truncated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
