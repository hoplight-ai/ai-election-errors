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

test('non-object input does not throw', () => {
  assert.doesNotThrow(() => validateReport(null));
  assert.doesNotThrow(() => validateReport('x'));
});
