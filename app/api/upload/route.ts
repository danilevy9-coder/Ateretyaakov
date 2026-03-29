import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Images are saved to /public/images/ inside the project.
// On a self-hosted server (VPS, DigitalOcean, etc.) these files persist forever.
// On Vercel (serverless) they are ephemeral — use the /api/images route to check.

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const targetPath = formData.get('path') as string; // e.g. "images/staff/rabbi-liff.jpg"

    if (!file || !targetPath) {
      return NextResponse.json({ error: 'Missing file or path' }, { status: 400 });
    }

    // Security: only allow writing inside images/
    const cleanPath = targetPath.replace(/\.\./g, '').replace(/^\//, '');
    if (!cleanPath.startsWith('images/')) {
      return NextResponse.json({ error: 'Invalid path — must be inside images/' }, { status: 400 });
    }

    // Preserve the original file extension, override the stem with the target name
    const targetExt = path.extname(cleanPath);       // e.g. .jpg
    const uploadExt = path.extname(file.name);        // e.g. .png

    // If extensions differ (user uploaded .png but slot expects .jpg), save with
    // the uploaded extension and also write the target path so both work.
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fullPath = path.join(process.cwd(), 'public', cleanPath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);

    // Also write with the upload's original extension if different
    if (uploadExt && uploadExt.toLowerCase() !== targetExt.toLowerCase()) {
      const altPath = fullPath.replace(targetExt, uploadExt);
      await writeFile(altPath, buffer);
    }

    return NextResponse.json({
      success: true,
      path: `/${cleanPath}`,
      message: 'Image saved to public folder — visible immediately on this server.',
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed', detail: String(err) }, { status: 500 });
  }
}
