'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const L = require('./logic.js');

describe('RejectionLogic helpers', () => {
  it('redacts spaced and unspaced ID patterns, phones, emails, and long numbers', () => {
    const spaced = L.redactPII('id 1234 5678 9012 ok');
    assert.equal(spaced.count, 1);
    assert.doesNotMatch(spaced.text, /1234\s?5678\s?9012/);

    const compact = L.redactPII('id 123456789012');
    assert.equal(compact.count, 1);
    assert.doesNotMatch(compact.text, /123456789012/);

    assert.match(L.redactPII('call +91 9876543210').text, /\[phone hidden\]/);
    assert.match(L.redactPII('mail a.b@x.in now').text, /\[email hidden\]/);
    assert.equal(L.redactPII('acct 00123456789').text, 'acct [number hidden]');

    const clean = 'Status: Defective. Income certificate expired in 2024.';
    assert.deepEqual(L.redactPII(clean), { text: clean, count: 0 });
    assert.equal(L.redactPII(null).text, '');
  });

  it('validates notice length and trims whitespace', () => {
    assert.equal(L.validateNotice('').ok, false);
    assert.equal(L.validateNotice('   short ').ok, false);
    assert.equal(L.validateNotice('a'.repeat(L.MAX_LEN + 1)).ok, false);

    const valid = L.validateNotice('  Status: Defective  ');
    assert.deepEqual(valid, { ok: true, text: 'Status: Defective' });
  });

  it('builds case-insensitive, whitespace-normalized cache keys per language', () => {
    assert.equal(L.cacheKey('A  b', 'Tamil'), L.cacheKey(' a b ', 'Tamil'));
    assert.notEqual(L.cacheKey('a b', 'Tamil'), L.cacheKey('a b', 'Hindi'));
  });

  it('maps status tones accurately across matched and unmatched states', () => {
    assert.equal(L.statusTone('Defective', true), 'warn');
    assert.equal(L.statusTone('Payment failed', true), 'warn');
    assert.equal(L.statusTone('Rejected', true), 'bad');
    assert.equal(L.statusTone('Verified', true), 'ok');
    assert.equal(L.statusTone('Rejected', false), 'unknown');
    assert.equal(L.statusTone('Weird', true), 'unknown');
  });

  it('allows only https links in safeLink', () => {
    assert.equal(L.safeLink('https://scholarships.gov.in/'), 'https://scholarships.gov.in/');
    assert.equal(L.safeLink('javascript:alert(1)'), '');
    assert.equal(L.safeLink('http://example.com'), '');
    assert.equal(L.safeLink('not a url'), '');
  });

  it('normalizes malformed or unsafe response payloads cleanly', () => {
    const empty = L.normalizeResponse(null);
    assert.equal(empty.matched, false);
    assert.deepEqual(empty.fix_steps, []);
    assert.equal(empty.official_link, '');

    const filtered = L.normalizeResponse({
      matched: true,
      status: 'Defective',
      fix_steps: ['Do A', 5, ''],
      official_link: 'javascript:x',
      note: 'English only'
    });
    assert.equal(filtered.matched, true);
    assert.deepEqual(filtered.fix_steps, ['Do A']);
    assert.equal(filtered.official_link, '');
    assert.equal(filtered.note, 'English only');
  });
});
