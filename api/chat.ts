import { GoogleGenAI } from '@google/genai';

const MODELS_TO_TRY = [
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash'
];

async function generateWithFallback(client: GoogleGenAI, prompt: string): Promise<string> {
  let lastError: any = null;

  for (const model of MODELS_TO_TRY) {
    try {
      const responsePromise = client.models.generateContent({
        model,
        contents: prompt,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Model timeout after 12s')), 12000)
      );

      const response = await Promise.race([responsePromise, timeoutPromise]);
      if (response && response.text && response.text.trim()) {
        return response.text.trim();
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || '';
      console.warn(`Model ${model} error: ${errMsg}. Trying alternate...`);
    }
  }

  throw lastError || new Error('تعذر الحصول على رد من نماذج الذكاء الاصطناعي');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, customApiKey } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    const keyToUse = customApiKey || process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      return res.json({
        reply: `مرحباً بك! أنا "روبوتي" 🤖. استلمت أمرك: "${message}". للاتصال المباشر بنموذج الذكاء الاصطناعي، يرجى تزويد مفتاح Gemini API في متغيرات بيئة Vercel أو إعدادات التطبيق.`
      });
    }

    const client = new GoogleGenAI({ apiKey: keyToUse });
    const prompt = `أنت روبوت مساعد شخصي. رد بالعربية بوضوح وإيجاز. الأمر: ${message}`;

    const reply = await generateWithFallback(client, prompt);
    return res.json({ reply });
  } catch (error: any) {
    console.error('Vercel API Gemini error:', error);
    const msg = error?.message || '';
    if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
      return res.status(503).json({
        error: '⚠️ خوادم Gemini تشهد ضغطاً مؤقتاً (خطأ 503). يرجى الضغط على زر إعادة المحاولة بعد لحظات.'
      });
    }
    return res.status(500).json({
      error: `⚠️ خطأ: ${msg || 'فشل الاتصال بـ Gemini'}`
    });
  }
}
