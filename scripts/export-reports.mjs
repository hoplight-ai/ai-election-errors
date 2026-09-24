// Pulls every report out of private storage into exports/ as one JSONL file and one CSV,
// ready to load into a database or spreadsheet.
//   npm run export      (needs BLOB_READ_WRITE_TOKEN in .env.local, from `vercel env pull`)
import { list, get } from '@vercel/blob';
import { mkdirSync, writeFileSync } from 'node:fs';

const rows = [];
let cursor;
do {
  const page = await list({ prefix: 'reports/', cursor, limit: 1000 });
  for (const b of page.blobs) {
    const res = await get(b.pathname, { access: 'private' });
    if (res?.statusCode !== 200) continue;
    rows.push(JSON.parse(await new Response(res.stream).text()));
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

rows.sort((a, b) => String(a.received_at).localeCompare(String(b.received_at)));
mkdirSync('exports', { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
writeFileSync(`exports/reports-${stamp}.jsonl`, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

const cols = [
  'id', 'received_at', 'occurred_on', 'occurred_time', 'issue_types', 'issue_other', 'product', 'product_other',
  'model_shown', 'paid_plan', 'surface', 'surface_detail', 'device', 'web_search_on', 'language',
  'election_state', 'election_locality', 'election_about', 'reporter_state', 'reporter_zip',
  'net_country', 'net_region', 'net_city', 'reproduced', 'acted_on_it', 'prompt', 'response',
  'sources_cited', 'what_was_wrong', 'correct_info', 'share_link', 'attachment_count',
  'evidence_level', 'reporting_mode', 'has_contact', 'ok_to_follow_up', 'ok_to_publish', 'reporter_hash',
];
const cell = (v) => {
  const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(
  c === 'net_country' ? r.network_location?.country
    : c === 'net_region' ? r.network_location?.region
    : c === 'net_city' ? r.network_location?.city
    : c === 'attachment_count' ? (r.attachments || []).length
    : r[c],
)).join(','))).join('\n') + '\n';
writeFileSync(`exports/reports-${stamp}.csv`, csv);
console.log(`${rows.length} reports -> exports/reports-${stamp}.jsonl and .csv (no contact details)`);

// Contact details come out only when asked for, into their own file.
if (process.argv.includes('--with-contacts')) {
  const contacts = [];
  let c;
  do {
    const page = await list({ prefix: 'contacts/', cursor: c, limit: 1000 });
    for (const b of page.blobs) {
      const res = await get(b.pathname, { access: 'private' });
      if (res?.statusCode === 200) contacts.push(JSON.parse(await new Response(res.stream).text()));
    }
    c = page.hasMore ? page.cursor : undefined;
  } while (c);
  writeFileSync(`exports/contacts-${stamp}.jsonl`, contacts.map((x) => JSON.stringify(x)).join('\n') + '\n');
  console.log(`${contacts.length} contact records -> exports/contacts-${stamp}.jsonl`);
}
