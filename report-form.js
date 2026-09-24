// Fills the form's choices from the shared schema, uploads attachments straight to private
// storage, and sends the report.
import { ISSUE_TYPES, PRODUCTS, SURFACES, DEVICES, US_STATES } from '/lib/schema.js';
import { upload } from '/vendor/blob-client.js';

const $ = (id) => document.getElementById(id);
const draftId = crypto.randomUUID();
const startedAt = Date.now();
const attachments = new Map(); // key -> { file, status, blob }
const MAX_FILES = 10;
const MAX_BYTES = 50 * 1024 * 1024;

// Choices
$('issue-types').innerHTML = Object.entries(ISSUE_TYPES).map(([k, v]) =>
  `<label class="chip"><input type="checkbox" name="issue_types" value="${k}"><span>${v}</span></label>`).join('');
const fill = (sel, items) => { for (const [v, t] of items) sel.add(new Option(t, v)); };
fill($('product'), PRODUCTS.map((p) => [p, p]));
fill($('surface'), Object.entries(SURFACES));
fill($('device'), DEVICES.map((d) => [d, d]));
fill($('election_state'), US_STATES.map((s) => [s, s]));
fill($('reporter_state'), US_STATES.map((s) => [s, s]));
for (const seg of document.querySelectorAll('.seg')) {
  const n = seg.dataset.name;
  seg.innerHTML = [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']]
    .map(([v, t]) => `<label><input type="radio" name="${n}" value="${v}">${t}</label>`).join('');
}
$('product').addEventListener('change', () => { $('product-other-wrap').hidden = $('product').value !== 'Other'; });
$('occurred_on').max = new Date().toISOString().slice(0, 10);

// Attachments
const drop = $('drop');
const list = $('file-list');
$('files').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('files').click(); } });
document.addEventListener('paste', (e) => {
  const files = [...(e.clipboardData?.files || [])];
  if (files.length && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) addFiles(files);
});

function safeName(name) {
  const cleaned = name.normalize('NFKD').replace(/[^\w.\- ]+/g, '_').replace(/_+/g, '_').trim();
  return (cleaned || 'file').slice(-100);
}

function addFiles(files) {
  for (const file of files) {
    if (attachments.size >= MAX_FILES) break;
    const key = crypto.randomUUID();
    const entry = { file, status: 'uploading', blob: null };
    attachments.set(key, entry);
    if (file.size > MAX_BYTES) { entry.status = 'too big (50 MB max)'; render(); continue; }
    render();
    upload(`attachments/${draftId}/${safeName(file.name)}`, file, {
      access: 'private',
      handleUploadUrl: '/api/upload',
      contentType: file.type || undefined,
    }).then((blob) => {
      entry.blob = blob; entry.status = 'done';
    }).catch((err) => {
      console.error(err); entry.status = 'failed';
    }).finally(render);
  }
}

function render() {
  list.innerHTML = '';
  for (const [key, a] of attachments) {
    const li = document.createElement('li');
    const cls = a.status === 'done' ? 'ok' : a.status === 'uploading' ? '' : 'err';
    const label = a.status === 'done' ? 'Uploaded' : a.status === 'uploading' ? 'Uploading…' : a.status === 'failed' ? 'Failed, remove and retry' : a.status;
    li.innerHTML = `<span class="nm"></span><span class="st ${cls}">${label}</span><button type="button" aria-label="Remove">×</button>`;
    li.querySelector('.nm').textContent = a.file.name;
    li.querySelector('button').onclick = () => { attachments.delete(key); render(); };
    list.appendChild(li);
  }
}

// Submit
const form = $('report');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errors = $('errors');
  errors.textContent = '';
  if ([...attachments.values()].some((a) => a.status === 'uploading')) {
    errors.textContent = 'Your files are still uploading. Give it a moment and send again.';
    return;
  }
  const fd = new FormData(form);
  const radio = (n) => form.querySelector(`input[name="${n}"]:checked`)?.value || '';
  const payload = {
    draft_id: draftId,
    elapsed_ms: Date.now() - startedAt,
    website: fd.get('website') || '',
    issue_types: fd.getAll('issue_types'),
    issue_other: fd.get('issue_other'),
    occurred_on: fd.get('occurred_on'),
    occurred_time: fd.get('occurred_time'),
    product: fd.get('product'),
    product_other: fd.get('product_other'),
    model_shown: fd.get('model_shown'),
    paid_plan: radio('paid_plan'),
    surface: fd.get('surface'),
    surface_detail: fd.get('surface_detail'),
    device: fd.get('device'),
    web_search_on: radio('web_search_on'),
    language: fd.get('language'),
    prompt: fd.get('prompt'),
    response: fd.get('response'),
    sources_cited: fd.get('sources_cited'),
    share_link: fd.get('share_link'),
    election_state: fd.get('election_state'),
    election_locality: fd.get('election_locality'),
    election_about: fd.get('election_about'),
    what_was_wrong: fd.get('what_was_wrong'),
    correct_info: fd.get('correct_info'),
    reporter_state: fd.get('reporter_state'),
    reporter_zip: fd.get('reporter_zip'),
    reproduced: radio('reproduced'),
    acted_on_it: radio('acted_on_it'),
    contact_email: fd.get('contact_email'),
    ok_to_contact: $('ok_to_contact').checked,
    ok_to_publish: $('ok_to_publish').checked,
    affirm_real: $('affirm_real').checked,
    source_page: location.href,
    attachments: [...attachments.values()].filter((a) => a.status === 'done').map((a) => ({
      url: a.blob.url, pathname: a.blob.pathname, name: a.file.name, type: a.file.type, size: a.file.size,
    })),
  };

  const btn = $('submit');
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const res = await fetch('/api/report', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
    form.hidden = true;
    document.querySelector('.hero').hidden = true;
    $('ref').textContent = out.id.slice(0, 8).toUpperCase();
    $('thanks').style.display = 'block';
    $('thanks').focus();
    window.scrollTo({ top: 0 });
  } catch (err) {
    errors.textContent = err.message;
    errors.scrollIntoView({ block: 'center' });
  } finally {
    btn.disabled = false; btn.textContent = 'Send report';
  }
});
