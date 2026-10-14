import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';

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

export default async function handler(_req: any, res: any) {
  try {
    const zip = new JSZip();
    const androidDir = path.resolve(process.cwd(), 'android');
    addDirToZip(zip, androidDir, 'MyRobot');

    const workflowPath = path.resolve(process.cwd(), '.github/workflows/android-build.yml');
    if (fs.existsSync(workflowPath)) {
      zip.file('MyRobot/.github/workflows/android-build.yml', fs.readFileSync(workflowPath));
    }
    const vercelConfigPath = path.resolve(process.cwd(), 'vercel.json');
    if (fs.existsSync(vercelConfigPath)) {
      zip.file('MyRobot/vercel.json', fs.readFileSync(vercelConfigPath));
    }
    const apiChatPath = path.resolve(process.cwd(), 'api/chat.ts');
    if (fs.existsSync(apiChatPath)) {
      zip.file('MyRobot/api/chat.ts', fs.readFileSync(apiChatPath));
    }
    const gitignorePath = path.resolve(process.cwd(), '.gitignore');
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
}
