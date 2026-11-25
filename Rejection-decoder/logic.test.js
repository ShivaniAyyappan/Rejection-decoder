const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

test('redactPII hides Aadhaar numbers with and without spaces', () => {
  assert.equal(L.redactPII('id 1234 5678 9012 ok').text, 'id [Aadhaar hidden] ok');
  assert.equal(L.redactPII('id 123456789012').count, 1);
});
test('redactPII hides phone numbers and emails', () => {
  assert.match(L.redactPII('call +91 9876543210').text, /\[phone hidden\]/);
  assert.match(L.redactPII('mail a.b@x.in now').text, /\[email hidden\]/);
});
test('redactPII hides long account numbers', () => {
  assert.equal(L.redactPII('acct 00123456789').text, 'acct [number hidden]');
});
test('redactPII leaves normal notices untouched', () => {
  const s = 'Status: Defective. Income certificate expired in 2024.';
  const r = L.redactPII(s);
  assert.equal(r.text, s);
  assert.equal(r.count, 0);
});
test('redactPII handles null input', () => assert.equal(L.redactPII(null).text, ''));

test('validateNotice rejects empty and too-short text', () => {
  assert.equal(L.validateNotice('').ok, false);
  assert.equal(L.validateNotice('   short ').ok, false);
});
test('validateNotice rejects over-long text', () => {
  assert.equal(L.validateNotice('a'.repeat(L.MAX_LEN + 1)).ok, false);
});
test('validateNotice trims valid text', () => {
  const v = L.validateNotice('  Status: Defective  ');
  assert.equal(v.ok, true);
  assert.equal(v.text, 'Status: Defective');
});

test('cacheKey ignores case and extra whitespace but not language', () => {
  assert.equal(L.cacheKey('A  b', 'Tamil'), L.cacheKey(' a b ', 'Tamil'));
  assert.notEqual(L.cacheKey('a b', 'Tamil'), L.cacheKey('a b', 'Hindi'));
});

test('statusTone maps statuses', () => {
  assert.equal(L.statusTone('Defective', true), 'warn');
  assert.equal(L.statusTone('Rejected', true), 'bad');
  assert.equal(L.statusTone('Verified', true), 'ok');
  assert.equal(L.statusTone('Rejected', false), 'unknown');
  assert.equal(L.statusTone('Weird', true), 'unknown');
});

test('safeLink allows only https URLs', () => {
  assert.equal(L.safeLink('https://scholarships.gov.in/'), 'https://scholarships.gov.in/');
  assert.equal(L.safeLink('javascript:alert(1)'), '');
  assert.equal(L.safeLink('http://example.com'), '');
  assert.equal(L.safeLink('not a url'), '');
});

test('normalizeResponse fills defaults for garbage input', () => {
  const d = L.normalizeResponse(null);
  assert.equal(d.matched, false);
  assert.deepEqual(d.fix_steps, []);
  assert.equal(d.official_link, '');
});
test('normalizeResponse filters bad steps and unsafe links', () => {
  const d = L.normalizeResponse({ matched: true, status: 'Defective', fix_steps: ['Do A', 5, ''], official_link: 'javascript:x' });
  assert.deepEqual(d.fix_steps, ['Do A']);
  assert.equal(d.official_link, '');
  assert.equal(d.matched, true);
});

test('statusTone treats Payment failed as a warning', () => assert.equal(L.statusTone('Payment failed', true), 'warn'));
test('normalizeResponse keeps the server note', () => assert.equal(L.normalizeResponse({ note: 'English only' }).note, 'English only'));
