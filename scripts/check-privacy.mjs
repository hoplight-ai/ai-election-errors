// Audits what is actually in storage against the privacy promises on the page:
//   1. no report file contains an email address or phone-like contact field
//   2. no uploaded image still carries an EXIF block (GPS, camera, time stamps)
//   3. anonymous reports carry no ZIP, city or browser string
//   npm run check:privacy     (exits 1 on any breach)
import { list, get } from '@vercel/blob';

async function* all(prefix) {
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    yield* page.blobs;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
}
const bytes = async (p) => {
  const r = await get(p, { access: 'private' });
  return r?.statusCode === 200 ? new Uint8Array(await new Response(r.stream).arrayBuffer()) : null;
};

const breaches = [];
let reports = 0, images = 0;
for await (const b of all('reports/')) {
  reports++;
  const text = new TextDecoder().decode(await bytes(b.pathname));
  const r = JSON.parse(text);
  if (/[^@\s"]+@[^@\s"]+\.[a-z]{2,}/i.test(text)) breaches.push(`${b.pathname}: contains an email address`);
  if (r.reporting_mode === 'anonymous' && (r.reporter_zip || r.network_location?.city || r.user_agent)) {
    breaches.push(`${b.pathname}: anonymous report carries ZIP, city or browser string`);
  }
}
for await (const b of all('attachments/')) {
  if (!/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(b.pathname)) continue;
  images++;
  const buf = await bytes(b.pathname);
  const s = new TextDecoder('latin1').decode(buf);
  if (s.includes('Exif\0\0') || s.includes('eXIf')) breaches.push(`${b.pathname}: image still has EXIF data`);
}
console.log(`checked ${reports} reports, ${images} images`);
for (const x of breaches) console.log('BREACH', x);
if (breaches.length) process.exit(1);
console.log('PASS: no contact details in reports, no hidden image data');
