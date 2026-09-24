// Issues short-lived upload tokens so the browser can send screenshots straight to the
// private Blob store. Nothing uploaded through here is publicly readable.
import { handleUpload } from '@vercel/blob/client';

const ALLOWED = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf', 'video/mp4', 'video/quicktime', 'video/webm', 'text/plain',
];
const MAX_BYTES = 50 * 1024 * 1024;
const PATH = /^attachments\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[\w.\- ]{1,120}$/;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Bad request' }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!PATH.test(pathname)) throw new Error('Bad upload path');
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 400 });
  }
}
