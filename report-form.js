// Runs the report form: one step at a time, checks each step before moving on, keeps a draft
// if the tab reloads, cleans and uploads attachments straight to private storage, and sends.
import {
  ISSUE_TYPES, ISSUE_HINTS, PRODUCTS, SURFACES, DEVICES, US_STATES, STATE_NAMES, validateReport,
} from '/lib/schema.js';
import { upload } from '/vendor/blob-client.js';

const $ = (id) => document.getElementById(id);
const form = $('report');
const steps = [...form.querySelectorAll('fieldset.step')];
const DRAFT_KEY = 'aee-draft-v1';
const MAX_FILES = 10;
const MAX_BYTES = 50 * 1024 * 1024;
const startedAt = Date.now();
let step = 0;
let submitted = false;

// ---------- Choices ----------
$('issue-types').innerHTML = Object.entries(ISSUE_TYPES).map(([k, v]) =>
  `<label class="chip"><input type="checkbox" name="issue_types" value="${k}"><span><span class="l">${v}</span>${
    ISSUE_HINTS[k] ? `<span class="h">${ISSUE_HINTS[k]}</span>` : ''}</span></label>`).join('');
const fill = (sel, items) => { for (const [v, t] of items) sel.add(new Option(t, v)); };
fill($('product'), PRODUCTS.map((p) => [p, p]));
fill($('surface'), Object.entries(SURFACES));
fill($('device'), DEVICES.map((d) => [d, d]));
for (const id of ['election_state', 'reporter_state']) fill($(id), US_STATES.map((s) => [s, STATE_NAMES[s] || s]));
for (const seg of document.querySelectorAll('.seg')) {
  const n = seg.dataset.name;
  seg.innerHTML = [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']]
    .map(([v, t]) => `<label class="pill"><input type="radio" name="${n}" value="${v}">${t}</label>`).join('');
}
$('occurred_on').max = new Date().toISOString().slice(0, 10);
$('product').addEventListener('change', () => { $('product-other-wrap').hidden = $('product').value !== 'Other'; });
const mode = () => form.querySelector('input[name="reporting_mode"]:checked')?.value || 'anonymous';
const syncMode = () => { $('contact-fields').hidden = mode() !== 'contact'; };
for (const r of form.querySelectorAll('input[name="reporting_mode"]')) r.addEventListener('change', syncMode);

// ---------- Draft: survives a reload or an app switch ----------
let draft = {};
try { draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}'); } catch { draft = {}; }
const draftId = draft.id || crypto.randomUUID();
const attachments = new Map(); // key -> { name, status, blob, preview, original }
for (const a of draft.attachments || []) attachments.set(crypto.randomUUID(), { name: a.name, type: a.type, size: a.size, status: 'done', blob: a.blob });

function restore() {
  for (const [name, val] of Object.entries(draft.fields || {})) {
    const els = form.querySelectorAll(`[name="${CSS.escape(name)}"], #${CSS.escape(name)}`);
    for (const el of els) {
      if (el.type === 'checkbox') el.checked = Array.isArray(val) ? val.includes(el.value) : !!val;
      else if (el.type === 'radio') el.checked = el.value === val;
      else el.value = val;
    }
  }
  syncMode();
  $('product-other-wrap').hidden = $('product').value !== 'Other';
}

function collect() {
  const fd = new FormData(form);
  const radio = (n) => form.querySelector(`input[name="${n}"]:checked`)?.value || '';
  const fields = {};
  for (const el of form.querySelectorAll('input[type=text],input[type=email],input[type=url],input[type=date],input[type=time],select,textarea')) {
    if (el.name && el.name !== 'website') fields[el.name] = el.value;
  }
  fields.issue_types = fd.getAll('issue_types');
  for (const n of ['web_search_on', 'paid_plan', 'reproduced', 'acted_on_it', 'reporting_mode']) fields[n] = radio(n);
  for (const id of ['ok_to_follow_up', 'ok_to_refer', 'ok_to_publish', 'affirm_real']) fields[id] = $(id).checked;
  return fields;
}

function uploaded() {
  return [...attachments.values()].filter((a) => a.status === 'done').map((a) => ({
    url: a.blob.url, pathname: a.blob.pathname, name: a.name, type: a.type, size: a.size,
  }));
}

function save() {
  if (submitted) return;
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      id: draftId, step, fields: collect(),
      attachments: [...attachments.values()].filter((a) => a.status === 'done')
        .map((a) => ({ name: a.name, type: a.type, size: a.size, blob: { url: a.blob.url, pathname: a.blob.pathname } })),
    }));
  } catch { /* storage unavailable: the form still works, it just won't survive a reload */ }
}
form.addEventListener('input', save);
form.addEventListener('change', save);
window.addEventListener('beforeunload', (e) => {
  if (!submitted && (attachments.size || $('prompt').value || $('response').value)) e.preventDefault();
});

// ---------- Attachments ----------
const drop = $('drop');
const list = $('file-list');
$('files').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length) { e.preventDefault(); addFiles(files); }
});

function safeName(name) {
  const cleaned = name.normalize('NFKD').replace(/[^\w.\- ]+/g, '_').replace(/_+/g, '_').trim();
  return (cleaned || 'file').slice(-100);
}

// Redraws an image on a blank canvas, which drops everything hidden in the file: GPS location,
// camera, time stamps, editing history. Returns null if this browser cannot read the image.
async function cleanImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close?.();
    const jpeg = /jpe?g|heic|heif/i.test(file.type) || /\.(jpe?g|heic|heif)$/i.test(file.name);
    const type = jpeg ? 'image/jpeg' : 'image/png';
    const out = await new Promise((res) => c.toBlob(res, type, 0.92));
    if (!out) return null;
    return new File([out], file.name.replace(/\.[^.]+$/, '') + (jpeg ? '.jpg' : '.png'), { type });
  } catch {
    return null;
  }
}
const isImage = (f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name);

function addFiles(files) {
  for (const original of files) {
    if (attachments.size >= MAX_FILES) { setFormError('You can add up to 10 files.'); break; }
    const key = crypto.randomUUID();
    const entry = { name: original.name, type: original.type, size: original.size, status: 'uploading', original };
    attachments.set(key, entry);
    if (original.size > MAX_BYTES) { entry.status = 'too-big'; render(); continue; }
    send(entry);
  }
  clearError('prompt'); clearError('response');
}

async function send(entry) {
  entry.status = 'uploading';
  render();
  try {
    const file = isImage(entry.original) ? await cleanImage(entry.original) : entry.original;
    if (!file) { entry.status = 'unreadable'; return; }
    if (file.type.startsWith('image/')) entry.preview = URL.createObjectURL(file);
    entry.name = file.name; entry.type = file.type; entry.size = file.size;
    entry.blob = await upload(`attachments/${draftId}/${safeName(file.name)}`, file, {
      access: 'private', handleUploadUrl: '/api/upload', contentType: file.type || undefined,
    });
    entry.status = 'done';
  } catch (err) {
    console.error(err);
    entry.status = 'failed';
  } finally {
    render();
    save();
  }
}

const STATUS = {
  uploading: ['Uploading…', ''],
  done: ['Added', 'ok'],
  failed: ['Didn’t upload', 'err'],
  'too-big': ['Too big (50 MB max)', 'err'],
  unreadable: ['Couldn’t clean this image. Send a screenshot of it instead.', 'err'],
};

function render() {
  list.innerHTML = '';
  for (const [key, a] of attachments) {
    const li = document.createElement('li');
    const [label, cls] = STATUS[a.status];
    li.innerHTML = `${a.preview ? '<img alt="">' : '<span class="ph" aria-hidden="true"></span>'}<span class="nm"></span><span class="st ${cls}">${label}</span>`;
    if (a.preview) li.querySelector('img').src = a.preview;
    li.querySelector('.nm').textContent = a.name;
    if (a.status === 'failed') {
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = 'Retry';
      retry.setAttribute('aria-label', `Retry ${a.name}`);
      retry.onclick = () => send(a);
      li.appendChild(retry);
    }
    const rm = document.createElement('button');
    rm.type = 'button'; rm.textContent = 'Remove';
    rm.setAttribute('aria-label', `Remove ${a.name}`);
    rm.onclick = () => { attachments.delete(key); render(); save(); };
    li.appendChild(rm);
    list.appendChild(li);
  }
}

// ---------- Steps and checks ----------
const STEP_FIELDS = [
  ['prompt', 'response'],
  ['issue_types'],
  ['product', 'occurred_on', 'surface'],
  ['contact_email', 'affirm_real'],
];

function payload() {
  return {
    ...collect(),
    draft_id: draftId,
    elapsed_ms: Date.now() - startedAt,
    website: $('website').value,
    attachments: uploaded(),
  };
}

function setError(field, msg) {
  const box = $(`err-${field}`);
  if (box) box.textContent = msg;
  const el = field === 'issue_types' ? $('issue-types') : $(field);
  if (el) el.setAttribute('aria-invalid', 'true');
}
function clearError(field) {
  const box = $(`err-${field}`);
  if (box) box.textContent = '';
  const el = field === 'issue_types' ? $('issue-types') : $(field);
  if (el) el.removeAttribute('aria-invalid');
}
function setFormError(msg) { $('form-error').textContent = msg; }
form.addEventListener('input', (e) => clearError(e.target.name === 'issue_types' ? 'issue_types' : e.target.id));
form.addEventListener('change', (e) => clearError(e.target.name === 'issue_types' ? 'issue_types' : e.target.id));

function checkStep(i) {
  const { fieldErrors } = validateReport(payload());
  let first = null;
  for (const f of STEP_FIELDS[i]) {
    clearError(f);
    if (fieldErrors[f]) {
      setError(f, fieldErrors[f]);
      first ||= f === 'issue_types' ? form.querySelector('input[name="issue_types"]') : $(f);
    }
  }
  if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  return !first;
}

function show(i) {
  step = i;
  steps.forEach((s, n) => { s.hidden = n !== i; });
  document.querySelectorAll('.progress span').forEach((s, n) => s.classList.toggle('done', n <= i));
  $('progress-label').textContent = `Step ${i + 1} of ${steps.length}`;
  $('back').hidden = i === 0;
  $('next').textContent = i === steps.length - 1 ? 'Send report' : 'Continue';
  setFormError('');
  save();
}

function focusStep() {
  const legend = steps[step].querySelector('legend');
  legend.setAttribute('tabindex', '-1');
  legend.focus({ preventScroll: true });
  form.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

$('back').addEventListener('click', () => { show(step - 1); focusStep(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setFormError('');
  if ([...attachments.values()].some((a) => a.status === 'uploading')) {
    setFormError('Your files are still uploading. Give it a moment.');
    return;
  }
  if (!checkStep(step)) return;
  if (step < steps.length - 1) { show(step + 1); focusStep(); return; }

  const btn = $('next');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const res = await fetch('/api/report', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload()),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
    submitted = true;
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ }
    form.hidden = true;
    $('hero').hidden = true;
    document.querySelector('.help').hidden = true;
    $('ref').textContent = out.id.slice(0, 8).toUpperCase();
    $('thanks').hidden = false;
    window.scrollTo({ top: 0 });
    $('thanks').focus();
  } catch (err) {
    setFormError(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Send report';
  }
});

$('share').addEventListener('click', async () => {
  const url = location.origin + '/';
  const text = 'Did an AI give you wrong election information? Report it here.';
  try {
    if (navigator.share) { await navigator.share({ title: 'AI Election Errors', text, url }); return; }
    await navigator.clipboard.writeText(url);
    $('share-note').textContent = 'Link copied.';
  } catch { /* the person closed the share sheet */ }
});

restore();
render();
show(Math.min(draft.step || 0, steps.length - 1));
