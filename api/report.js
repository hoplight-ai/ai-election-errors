// Receives one report and files it as a JSON record in the private Blob store.
// Each record is one row of the archive: reports/<yyyy>/<mm>/<id>.json
import { put } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { validateReport } from '../lib/schema.js';

export async function POST(request) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: 'Could not read the form.' }, { status: 400 });
  }

  // Bots fill the hidden field or submit faster than a person can type.
  if (input.website || (typeof input.elapsed_ms === 'number' && input.elapsed_ms < 4000)) {
    return Response.json({ ok: true, id: 'received' });
  }

  const { report, contact, errors } = validateReport(input);
  if (errors.length) return Response.json({ error: errors.join(' ') }, { status: 400 });

  const h = request.headers;
  const now = new Date();
  const anonymous = report.reporting_mode === 'anonymous';
  report.received_at = now.toISOString();
  // Coarse location from the network. The raw address is never stored. Anonymous reports keep
  // country and state only.
  report.network_location = {
    country: h.get('x-vercel-ip-country') || null,
    region: h.get('x-vercel-ip-country-region') || null,
    city: anonymous ? null : safeDecode(h.get('x-vercel-ip-city')),
  };
  // A one-way fingerprint that groups a burst of reports from one connection (spam), and nothing
  // more. For anonymous reports it changes every day, so reports cannot be linked across days.
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim();
  const salt = (process.env.REPORTER_HASH_SALT || 'unsalted') + (anonymous ? now.toISOString().slice(0, 10) : '');
  report.reporter_hash = ip ? createHash('sha256').update(salt + ip).digest('hex').slice(0, 16) : null;
  report.user_agent = anonymous ? null : (h.get('user-agent') || '').slice(0, 300);
  report.schema_version = 2;

  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  try {
    if (contact) {
      // Filed apart from the report, under a different folder, so exports and anything shared
      // never carry it by accident.
      await put(`contacts/${report.id}.json`, JSON.stringify({ ...contact, received_at: report.received_at }, null, 2), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
      });
    }
    await put(`reports/${yyyy}/${mm}/${report.id}.json`, JSON.stringify(report, null, 2), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  } catch (err) {
    if (/already exists/i.test(String(err?.message))) {
      return Response.json({ ok: true, id: report.id });
    }
    console.error('report store failed', err);
    return Response.json({ error: 'We could not save your report. Please try again in a minute.' }, { status: 500 });
  }

  return Response.json({ ok: true, id: report.id });
}

function safeDecode(v) {
  if (!v) return null;
  try { return decodeURIComponent(v); } catch { return v; }
}
