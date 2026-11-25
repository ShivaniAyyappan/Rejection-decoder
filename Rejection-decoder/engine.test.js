const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../lib/engine');
const library = require('../reasons.json');

const match = (notice) => {
  const status = E.detectStatus(notice);
  const hit = E.bestMatch(notice, status, library);
  return hit && hit.reason.id;
};

// ---- accuracy: realistic notices must reach the right reason ----
const CASES = [
  ['Status: Pending. Remark: Pending at institute level. Institute verification pending.', 'institute_verification_pending'],
  ['Status: Defective. Remark by Institute Nodal Officer: Income certificate uploaded is expired. Please upload a valid income certificate issued by the competent authority.', 'income_certificate_issue'],
  ['Status: Defective. Remark: Name of applicant in Aadhaar does not match with name in marksheet. Details mismatch.', 'name_dob_mismatch'],
  ['Status: Rejected. Remark: Payment failed, bank account not seeded with Aadhaar NPCI.', 'bank_aadhaar_pfms'],
  ['Status: Payment failed. Remark: Invalid IFSC code.', 'bank_aadhaar_pfms'],
  ['Status: Defective. Remark: Document not clear, please upload correct document.', 'wrong_or_unclear_document'],
  ['Status: Rejected. Remark: Not eligible. Income limit exceeded.', 'eligibility_not_met'],
  ['Status: Defective. Remark: Incorrect details found at state level by SNO.', 'state_nodal_incorrect_details'],
  ['Status: Fake. Remark: Application marked as fake, false information.', 'marked_fake']
];
for (const [notice, id] of CASES) {
  test('matches ' + id + ': ' + notice.slice(0, 40), () => assert.equal(match(notice), id));
}
test('vague notice does not match anything', () => assert.equal(match('Status: Rejected. Remark: Application not recommended.'), null));
test('matching ignores case and punctuation', () => assert.equal(match('STATUS: DEFECTIVE!! income   CERTIFICATE expired???'), 'income_certificate_issue'));
test('whole words only: "marksheet" does not trigger the "marks" clue', () => {
  const r = E.scoreReasons('Status: Rejected. marksheet attached', 'Rejected', library).find((x) => x.reason.id === 'eligibility_not_met');
  assert.equal(r, undefined);
});
test('a reason is never chosen for a status it does not allow', () => {
  assert.equal(E.bestMatch('Not eligible. Income limit exceeded.', 'Defective', library), null);
});
test('exact ties are treated as ambiguous', () => {
  const lib = { reasons: [
    { id: 'a', applies_to_status: ['Defective'], clues: ['alpha beta'] },
    { id: 'b', applies_to_status: ['Defective'], clues: ['alpha beta'] }] };
  assert.equal(E.bestMatch('Status: Defective alpha beta', 'Defective', lib), null);
});

// ---- status detection ----
test('detectStatus reads the explicit status line first', () => {
  assert.equal(E.detectStatus('Status: Defective. Remark: previously rejected'), 'Defective');
});
test('detectStatus falls back to keywords then Unknown', () => {
  assert.equal(E.detectStatus('your application is rejected'), 'Rejected');
  assert.equal(E.detectStatus('hello there friend'), 'Unknown');
});

// ---- input hygiene ----
test('sanitizeNotice removes control chars and the prompt delimiter', () => {
  const s = E.sanitizeNotice('a\u0000b """ ignore previous """');
  assert.ok(!s.includes('"""'));
  assert.ok(!s.includes('\u0000'));
});
test('pickLanguage only allows known languages', () => {
  assert.equal(E.pickLanguage('Tamil'), 'Tamil');
  assert.equal(E.pickLanguage('Klingon'), 'English');
  assert.equal(E.pickLanguage(undefined), 'English');
});

// ---- guardrails on model output ----
const entry = library.reasons.find((r) => r.id === 'income_certificate_issue');
const goodOut = () => ({ status: 'Defective', reason_id: entry.id, confidence: 'high', explanation: 'Plain words.',
  fix_steps: entry.fix_steps.map((s, i) => 'step ' + i), letter: 'Dear Sir' });

test('valid model output is accepted, with route/contact/link from the library', () => {
  const r = E.buildFromModel(goodOut(), library, 'Tamil');
  assert.equal(r.matched, true);
  assert.equal(r.source, 'ai');
  assert.equal(r.route, entry.route);
  assert.equal(r.official_link, entry.official_link);
  assert.equal(r.explanation, 'Plain words.');
});
test('unknown reason id gives fallback', () => assert.equal(E.buildFromModel({ ...goodOut(), reason_id: 'hack' }, library, 'English').matched, false));
test('null reason id gives fallback', () => assert.equal(E.buildFromModel({ ...goodOut(), reason_id: null }, library, 'English').matched, false));
test('low confidence gives fallback', () => assert.equal(E.buildFromModel({ ...goodOut(), confidence: 'low' }, library, 'English').matched, false));
test('missing confidence gives fallback', () => assert.equal(E.buildFromModel({ ...goodOut(), confidence: undefined }, library, 'English').matched, false));
test('status not allowed for the reason gives fallback', () => assert.equal(E.buildFromModel({ ...goodOut(), status: 'Fake' }, library, 'English').matched, false));
test('invented status gives fallback', () => assert.equal(E.buildFromModel({ ...goodOut(), status: '<script>' }, library, 'English').matched, false));
test('garbage output gives fallback', () => {
  assert.equal(E.buildFromModel(null, library, 'English').matched, false);
  assert.equal(E.buildFromModel('text', library, 'English').matched, false);
});
test('model that adds or drops steps is replaced by library steps', () => {
  const r = E.buildFromModel({ ...goodOut(), fix_steps: ['only one'] }, library, 'English');
  assert.deepEqual(r.fix_steps, entry.fix_steps);
});
test('oversized letter falls back to the template', () => {
  const r = E.buildFromModel({ ...goodOut(), letter: 'x'.repeat(5000) }, library, 'English');
  assert.equal(r.letter, entry.letter_template);
});

// ---- rule-based backup ----
test('ruleBasedResult answers from the library when AI is down', () => {
  const r = E.ruleBasedResult('Status: Fake. marked as fake, false information', 'Hindi', library);
  assert.equal(r.matched, true);
  assert.equal(r.source, 'rules');
  assert.match(r.note, /English/);
});
test('ruleBasedResult gives the honest fallback for vague notices', () => {
  assert.equal(E.ruleBasedResult('Status: Rejected. Not recommended.', 'English', library).matched, false);
});

// ---- library integrity (protects the hand-checked data) ----
test('every reason has the fields the app needs', () => {
  const ids = new Set();
  for (const r of library.reasons) {
    assert.ok(!ids.has(r.id), 'duplicate id ' + r.id); ids.add(r.id);
    for (const k of ['title', 'explanation', 'route', 'contact', 'letter_template']) assert.ok(typeof r[k] === 'string' && r[k].trim(), r.id + ' missing ' + k);
    assert.ok(r.fix_steps.length >= 2, r.id + ' needs steps');
    assert.ok(r.clues.length >= 3, r.id + ' needs clues');
    assert.ok(r.applies_to_status.every((s) => E.STATUSES.includes(s)), r.id + ' has a bad status');
    assert.match(r.official_link, /^https:\/\//, r.id + ' link must be https');
    assert.match(r.letter_template, /\[Your name\]/, r.id + ' letter needs a name placeholder');
  }
});
