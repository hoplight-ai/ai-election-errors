// The shape of one report. The form and the server both hold to these lists;
// change a field here and bump schema_version in api/report.js.

// Labels fit one line on a phone. Hints give a neutral example so no reader has to guess
// which side a category is aimed at.
export const ISSUE_TYPES = {
  outdated: 'Out-of-date info',
  fabricated: 'Made-up facts, quotes or laws',
  bad_source: 'Pointed to a fake or unreliable source',
  logistics: 'Wrong voting steps',
  eligibility: 'Wrong about who can vote or how to register',
  candidates: 'Wrong about a candidate, party or ballot item',
  results: 'Wrong or unsupported claims about results',
  one_sided: 'One-sided when you wanted neutral info',
  refused: 'Dodged a fair election question',
  other: 'Something else',
};

export const ISSUE_HINTS = {
  outdated: 'Like last cycle’s deadline, or a rule that has since changed',
  fabricated: 'Like a polling place, quote or law that doesn’t exist',
  bad_source: 'Like a forum post, a fake news site or bot-made content',
  logistics: 'Deadlines, ID, polling place, mail ballots',
  eligibility: 'Like age, residency or registration rules',
  candidates: 'Like the wrong party, or a position they never took',
  results: 'Like calling a race early, or claims no official source backs up',
  one_sided: 'Like giving only one side’s arguments on a ballot measure',
  refused: 'Like refusing to say how to find your polling place',
  other: '',
};

export const PRODUCTS = [
  'ChatGPT', 'Google Gemini', 'Google Search AI Overview / AI Mode', 'Microsoft Copilot',
  'Meta AI', 'Claude', 'Grok', 'Perplexity', 'Siri / Apple Intelligence', 'Alexa',
  'Snapchat My AI', 'DeepSeek', 'Mistral Le Chat', 'Other',
];

export const SURFACES = {
  phone_app: 'Its phone app',
  website: 'Its website, in a browser',
  desktop_app: 'Its desktop app',
  inside_other: 'Built into another app (search, social, messaging)',
  voice: 'A voice assistant or smart speaker',
  browser_feature: 'Built into my web browser',
  api: 'Through code or a developer tool',
  other: 'Somewhere else',
};

export const DEVICES = ['iPhone / iPad', 'Android', 'Mac', 'Windows', 'Chromebook', 'Smart speaker', 'Other'];

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR',
  'PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','PR','GU','VI','AS','MP',
  'Outside the US',
];

export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', PR: 'Puerto Rico', GU: 'Guam',
  VI: 'U.S. Virgin Islands', AS: 'American Samoa', MP: 'Northern Mariana Islands',
  'Outside the US': 'Outside the US',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneOf = (v, list) => (typeof v === 'string' && list.includes(v) ? v : '');
const yn = (v) => oneOf(v, ['yes', 'no', 'unsure']);

export function validateReport(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const errors = [];
  const id = UUID.test(input.draft_id || '') ? input.draft_id : crypto.randomUUID();
  const issues = Array.isArray(input.issue_types)
    ? input.issue_types.filter((t) => typeof t === 'string' && Object.hasOwn(ISSUE_TYPES, t))
    : [];

  const r = {
    id,
    issue_types: [...new Set(issues)],
    issue_other: str(input.issue_other, 300),
    occurred_on: /^\d{4}-\d{2}-\d{2}$/.test(input.occurred_on || '') ? input.occurred_on : '',
    occurred_time: /^\d{2}:\d{2}$/.test(input.occurred_time || '') ? input.occurred_time : '',
    product: oneOf(input.product, PRODUCTS),
    product_other: str(input.product_other, 120),
    model_shown: str(input.model_shown, 120),
    paid_plan: yn(input.paid_plan),
    surface: oneOf(input.surface, Object.keys(SURFACES)),
    surface_detail: str(input.surface_detail, 200),
    device: oneOf(input.device, DEVICES),
    web_search_on: yn(input.web_search_on),
    language: str(input.language, 60),
    prompt: str(input.prompt, 20000),
    response: str(input.response, 60000),
    sources_cited: str(input.sources_cited, 5000),
    what_was_wrong: str(input.what_was_wrong, 5000),
    correct_info: str(input.correct_info, 5000),
    election_state: oneOf(input.election_state, US_STATES),
    election_locality: str(input.election_locality, 120),
    election_about: str(input.election_about, 200),
    reporter_state: oneOf(input.reporter_state, US_STATES),
    reporter_zip: /^\d{5}$/.test(input.reporter_zip || '') ? input.reporter_zip : '',
    share_link: /^https?:\/\/\S+$/.test(input.share_link || '') ? str(input.share_link, 500) : '',
    reproduced: yn(input.reproduced),
    acted_on_it: yn(input.acted_on_it),
    attachments: Array.isArray(input.attachments)
      ? input.attachments
          .filter((a) => a
            && /^https:\/\/[a-z0-9]+\.private\.blob\.vercel-storage\.com\//.test(a.url || '')
            && String(a.pathname || '').startsWith(`attachments/${id}/`))
          .slice(0, 10)
          .map((a) => ({
            url: a.url,
            pathname: str(a.pathname, 300),
            name: str(a.name, 200),
            type: str(a.type, 80),
            size: Number(a.size) || null,
          }))
      : [],
    reporting_mode: oneOf(input.reporting_mode, ['anonymous', 'contact']) || 'anonymous',
    ok_to_publish: input.ok_to_publish === true,
    affirm_real: input.affirm_real === true,
  };

  // Contact details never sit in the report itself. They are filed separately so a report can be
  // shared, exported or published without them. Anonymous mode keeps none at all.
  let contact = null;
  if (r.reporting_mode === 'contact') {
    contact = {
      report_id: id,
      name: str(input.contact_name, 120),
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.contact_email || '') ? str(input.contact_email, 200) : '',
      phone: str(input.contact_phone, 40).replace(/[^\d+()\-. ]/g, ''),
      ok_to_follow_up: input.ok_to_follow_up === true,
      ok_to_refer: input.ok_to_refer === true,
    };
  } else {
    r.reporter_zip = '';
  }
  r.has_contact = !!contact;
  r.ok_to_follow_up = !!contact?.ok_to_follow_up;
  r.evidence_level = evidenceLevel(r);

  // fieldErrors lets the form show each message next to its own field.
  const fieldErrors = {};
  const fail = (field, msg) => { errors.push(msg); fieldErrors[field] = msg; };
  if (!r.prompt && !r.attachments.length) fail('prompt', 'Add a screenshot, or paste what you asked.');
  if (!r.response && !r.attachments.length) fail('response', 'Add a screenshot, or paste what it answered.');
  if (!r.issue_types.length) fail('issue_types', 'Pick at least one.');
  if (!r.occurred_on) fail('occurred_on', 'Add the date. A rough guess is fine.');
  if (!r.product) fail('product', 'Pick which AI it was.');
  if (!r.surface) fail('surface', 'Pick where you were using it.');
  if (contact && !contact.email && !contact.phone) fail('contact_email', 'Add an email or phone, or choose to report anonymously.');
  if (!r.affirm_real) fail('affirm_real', 'Please confirm this happened in your own use.');

  return { report: r, contact, errors, fieldErrors };
}

// How much weight a report can bear on its own evidence, before anyone reviews it.
//   A: a share link to the conversation on the AI's own site. Checkable by anyone.
//   B: screenshots or a recording, and a reporter we can reach to ask for more.
//   C: screenshots or a recording, reporter anonymous.
//   D: pasted text only.
// Contact moves a report from C to B: it does not prove the report, but it means a reviewer,
// reporter or regulator can ask for the original, a re-run, or a sworn account.
export function evidenceLevel(r) {
  if (r.share_link) return 'A';
  if (r.attachments.length) return r.has_contact && r.ok_to_follow_up ? 'B' : 'C';
  return 'D';
}
