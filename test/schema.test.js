import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateReport } from '../lib/schema.js';

const ID = '3f1c2b4a-5d6e-4f70-8a9b-0c1d2e3f4a5b';
const good = {
  draft_id: ID,
  issue_types: ['outdated', 'bad_source'],
  occurred_on: '2026-09-20',
  product: 'ChatGPT',
  surface: 'phone_app',
  prompt: 'When is the mail ballot deadline in Pennsylvania?',
  response: 'It is the same as 2020.',
  affirm_real: true,
};

test('a complete report passes and keeps its draft id', () => {
  const { report, errors } = validateReport(good);
  assert.deepEqual(errors, []);
  assert.equal(report.id, ID);
  assert.deepEqual(report.issue_types, ['outdated', 'bad_source']);
});

test('missing essentials are named in plain words', () => {
  const { errors } = validateReport({});
  assert.equal(errors.length, 7);
});

test('prototype keys are not accepted as issue types', () => {
  const { report } = validateReport({ ...good, issue_types: ['toString', 'constructor', 'outdated'] });
  assert.deepEqual(report.issue_types, ['outdated']);
});

test('values outside the lists are dropped', () => {
  const { report, errors } = validateReport({ ...good, product: 'Evil<script>', surface: 'x' });
  assert.equal(report.product, '');
  assert.ok(errors.includes('Pick which AI it was.'));
});

test('each error is tied to the field it belongs to', () => {
  const { fieldErrors } = validateReport({ ...good, product: '', issue_types: [] });
  assert.deepEqual(Object.keys(fieldErrors).sort(), ['issue_types', 'product']);
});

test('attachments must be private blobs filed under this report', () => {
  const { report } = validateReport({
    ...good,
    attachments: [
      { url: 'https://abc123.private.blob.vercel-storage.com/attachments/' + ID + '/a.png', pathname: `attachments/${ID}/a.png` },
      { url: 'https://evil.example.com/a.png', pathname: `attachments/${ID}/a.png` },
      { url: 'https://abc123.private.blob.vercel-storage.com/attachments/other/a.png', pathname: 'attachments/other/a.png' },
    ],
  });
  assert.equal(report.attachments.length, 1);
});

test('a screenshot can stand in for pasted text', () => {
  const { errors } = validateReport({
    ...good, prompt: '', response: '',
    attachments: [{ url: 'https://abc.private.blob.vercel-storage.com/x', pathname: `attachments/${ID}/x.png` }],
  });
  assert.deepEqual(errors, []);
});

test('anonymous is the default and keeps no contact details or ZIP', () => {
  const { report, contact } = validateReport({ ...good, contact_email: 'a@b.co', contact_phone: '555', reporter_zip: '19103' });
  assert.equal(report.reporting_mode, 'anonymous');
  assert.equal(contact, null);
  assert.equal(report.reporter_zip, '');
  assert.ok(!JSON.stringify(report).includes('a@b.co'));
});

test('contact details are returned apart from the report, never inside it', () => {
  const { report, contact, errors } = validateReport({
    ...good, reporting_mode: 'contact', contact_email: 'a@b.co', contact_name: 'Pat', ok_to_follow_up: true, reporter_zip: '19103',
  });
  assert.deepEqual(errors, []);
  assert.equal(contact.email, 'a@b.co');
  assert.equal(contact.report_id, ID);
  assert.ok(!JSON.stringify(report).includes('a@b.co'));
  assert.ok(!JSON.stringify(report).includes('Pat'));
  assert.equal(report.reporter_zip, '19103');
  assert.equal(report.has_contact, true);
});

test('contact mode needs a way to reach the person', () => {
  const { errors } = validateReport({ ...good, reporting_mode: 'contact' });
  assert.ok(errors.some((e) => e.includes('anonymously')));
});

test('evidence level: share link A, reachable with screenshot B, anonymous screenshot C, text D', () => {
  const shot = [{ url: 'https://abc.private.blob.vercel-storage.com/x', pathname: `attachments/${ID}/x.png` }];
  assert.equal(validateReport({ ...good, share_link: 'https://chatgpt.com/share/x' }).report.evidence_level, 'A');
  assert.equal(validateReport({ ...good, attachments: shot, reporting_mode: 'contact', contact_email: 'a@b.co', ok_to_follow_up: true }).report.evidence_level, 'B');
  assert.equal(validateReport({ ...good, attachments: shot }).report.evidence_level, 'C');
  assert.equal(validateReport(good).report.evidence_level, 'D');
});

test('non-object input does not throw', () => {
  assert.doesNotThrow(() => validateReport(null));
  assert.doesNotThrow(() => validateReport('x'));
});
