import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import JSZip from 'jszip';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

const defaultApiKey = process.env.GEMINI_API_KEY;
let defaultAi: GoogleGenAI | null = null;
if (defaultApiKey) {
  defaultAi = new GoogleGenAI({ apiKey: defaultApiKey });
}

// Resilient list of models to try in sequence if 503 (high demand) or timeout occurs
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
      console.warn(`Model ${model} encounter error: ${errMsg}. Trying alternate model...`);
    }
  }

  throw lastError || new Error('تعذر الحصول على رد من نماذج الذكاء الاصطناعي');
}

// Endpoint to chat with Gemini
app.post('/api/chat', async (req, res) => {
  try {
    const { message, customApiKey } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    const keyToUse = customApiKey || process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      return res.json({
        reply: `مرحباً بك! أنا "روبوتي" 🤖. استلمت أمرك: "${message}". للاتصال المباشر بنموذج الذكاء الاصطناعي، يرجى تزويد مفتاح Gemini API في إعدادات التطبيق أو عبر متغير البيئة GEMINI_API_KEY.`
      });
    }

    const client = customApiKey ? new GoogleGenAI({ apiKey: customApiKey }) : (defaultAi || new GoogleGenAI({ apiKey: keyToUse }));
    const prompt = `أنت روبوت مساعد شخصي. رد بالعربية بوضوح وإيجاز. الأمر: ${message}`;

    const reply = await generateWithFallback(client, prompt);
    return res.json({ reply });
  } catch (error: any) {
    console.error('Gemini error after fallbacks:', error);
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
});

// Helper to recursively add files to a zip
function addDirToZip(zip: JSZip, localDirPath: string, zipDirPath: string) {
  if (!fs.existsSync(localDirPath)) return;
  const items = fs.readdirSync(localDirPath);
  for (const item of items) {
    const fullLocal = path.join(localDirPath, item);
    const fullZip = zipDirPath ? `${zipDirPath}/${item}` : item;
    const stat = fs.statSync(fullLocal);
    if (stat.isDirectory()) {
      addDirToZip(zip, fullLocal, fullZip);
    } else {
      const content = fs.readFileSync(fullLocal);
      zip.file(fullZip, content);
    }
  }
}

// Endpoint to download the full Android project zip
app.get('/api/download/project-zip', async (_req, res) => {
  try {
    const zip = new JSZip();
    const androidDir = path.resolve(__dirname, 'android');
    addDirToZip(zip, androidDir, 'MyRobot');

    // Also include GitHub Actions workflow & Vercel deployment files in root
    const workflowPath = path.resolve(__dirname, '.github/workflows/android-build.yml');
    if (fs.existsSync(workflowPath)) {
      zip.file('MyRobot/.github/workflows/android-build.yml', fs.readFileSync(workflowPath));
    }
    const vercelConfigPath = path.resolve(__dirname, 'vercel.json');
    if (fs.existsSync(vercelConfigPath)) {
      zip.file('MyRobot/vercel.json', fs.readFileSync(vercelConfigPath));
    }
    const apiChatPath = path.resolve(__dirname, 'api/chat.ts');
    if (fs.existsSync(apiChatPath)) {
      zip.file('MyRobot/api/chat.ts', fs.readFileSync(apiChatPath));
    }
    const gitignorePath = path.resolve(__dirname, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      zip.file('MyRobot/.gitignore', fs.readFileSync(gitignorePath));
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="MyRobot-Full-Project.zip"');
    res.send(buffer);
  } catch (err: any) {
    console.error('Zip generation error:', err);
    res.status(500).send('Error generating zip');
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
