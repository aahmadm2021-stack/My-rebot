import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vjoaxuusbmwfiygntbjv.supabase.co';

export default async function handler(req: any, res: any) {
  const supabaseKey =
    req.headers['x-supabase-key'] ||
    process.env.SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_UaicqMAXrbFFbiyBHFf6YA_CNpI8qBJ';

  if (!supabaseKey) {
    return res.status(400).json({
      connected: false,
      error: 'يرجى تزويد Supabase Key للاتصال بقاعدة البيانات.',
      url: SUPABASE_URL
    });
  }

  const supabase = createClient(SUPABASE_URL, supabaseKey);

  if (req.method === 'GET') {
    try {
      // Test querying api_keys
      const { data, error } = await supabase
        .from('api_keys')
        .select('service, updated_at')
        .limit(5);

      if (error) {
        return res.status(200).json({
          connected: true,
          tableExists: false,
          error: error.message,
          message: 'تم الاتصال بـ Supabase بنجاح ولكن جدول api_keys غير موجود بعد. يرجى تشغيل كود الـ SQL المرفق في SQL Editor.',
          url: SUPABASE_URL
        });
      }

      const hasGeminiKey = data && data.some((item: any) => item.service === 'gemini');

      return res.status(200).json({
        connected: true,
        tableExists: true,
        hasGeminiKey,
        recordsCount: data ? data.length : 0,
        url: SUPABASE_URL
      });
    } catch (err: any) {
      return res.status(500).json({
        connected: false,
        error: err.message,
        url: SUPABASE_URL
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const { geminiApiKey } = req.body || {};
      if (!geminiApiKey || typeof geminiApiKey !== 'string') {
        return res.status(400).json({ error: 'مفتاح Gemini مطلوب' });
      }

      // Upsert into api_keys table
      const { data, error } = await supabase
        .from('api_keys')
        .upsert(
          {
            service: 'gemini',
            api_key: geminiApiKey,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'service' }
        )
        .select();

      if (error) {
        return res.status(500).json({
          error: `فشل الحفظ في قاعدة البيانات: ${error.message}. تأكد من إنشاء جدول api_keys.`
        });
      }

      return res.status(200).json({
        success: true,
        message: 'تم حفظ المفتاح بنجاح في قاعدة بيانات Supabase!',
        data
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
