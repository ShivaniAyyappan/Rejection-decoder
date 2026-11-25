'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const E = require('./engine');
const library = require('./reasons.json');

const INCOME_ENTRY = library.reasons.find((r) => r.id === 'income_certificate_issue');

function matchReasonId(notice) {
  const status = E.detectStatus(notice);
  const hit = E.bestMatch(notice, status, library);
  return hit ? hit.reason.id : null;
}

function buildValidModelOutput() {
  return {
    status: 'Defective',
    reason_id: INCOME_ENTRY.id,
    confidence: 'high',
    explanation: 'Plain words.',
    fix_steps: INCOME_ENTRY.fix_steps.map((_step, idx) => 'step ' + idx),
    letter: 'Dear Sir, [Your name]'
  };
}

describe('Engine accuracy and matching', () => {
  const ACCURACY_CASES = [
    ['Status: Pending. Remark: Pending at institute level. Institute verification pending.', 'institute_verification_pending'],
    [
      'Status: Defective. Remark by Institute Nodal Officer: Income certificate uploaded is expired. Please upload a valid income certificate issued by the competent authority.',
      'income_certificate_issue'
    ],
    [
      'Status: Defective. Remark: Name of applicant in Aadhaar does not match with name in marksheet. Details mismatch.',
      'name_dob_mismatch'
    ],
    ['Status: Rejected. Remark: Payment failed, bank account not seeded with Aadhaar NPCI.', 'bank_aadhaar_pfms'],
    ['Status: Payment failed. Remark: Invalid IFSC code.', 'bank_aadhaar_pfms'],
    ['Status: Defective. Remark: Document not clear, please upload correct document.', 'wrong_or_unclear_document'],
    ['Status: Rejected. Remark: Not eligible. Income limit exceeded.', 'eligibility_not_met'],
    ['Status: Defective. Remark: Incorrect details found at state level by SNO.', 'state_nodal_incorrect_details'],
    ['Status: Fake. Remark: Application marked as fake, false information.', 'marked_fake']
  ];

  for (const [notice, expectedId] of ACCURACY_CASES) {
    it(`matches ${expectedId} for "${notice.slice(0, 42)}..."`, () => {
      assert.equal(matchReasonId(notice), expectedId);
    });
  }

  it('does not match vague remarks', () => {
    assert.equal(matchReasonId('Status: Rejected. Remark: Application not recommended.'), null);
  });

  it('normalizes case and punctuation while enforcing whole-word boundaries', () => {
    assert.equal(matchReasonId('STATUS: DEFECTIVE!! income   CERTIFICATE expired???'), 'income_certificate_issue');

    const ineligibleMatches = E.scoreReasons('Status: Rejected. marksheet attached', 'Rejected', library).filter(
      (item) => item.reason.id === 'eligibility_not_met'
    );
    assert.equal(ineligibleMatches.length, 0);
  });

  it('respects allowed statuses and treats exact ties as ambiguous', () => {
    assert.equal(E.bestMatch('Not eligible. Income limit exceeded.', 'Defective', library), null);

    const tiedLibrary = {
      reasons: [
        { id: 'reason_a', applies_to_status: ['Defective'], clues: ['alpha beta'] },
        { id: 'reason_b', applies_to_status: ['Defective'], clues: ['alpha beta'] }
      ]
    };
    assert.equal(E.bestMatch('Status: Defective alpha beta', 'Defective', tiedLibrary), null);
  });
});

describe('Status detection, hygiene, and guardrails', () => {
  it('detects explicit status first, then keyword fallback, then Unknown', () => {
    assert.equal(E.detectStatus('Status: Defective. Remark: previously rejected'), 'Defective');
    assert.equal(E.detectStatus('your application is rejected'), 'Rejected');
    assert.equal(E.detectStatus('hello there friend'), 'Unknown');
  });

  it('sanitizes control characters and prompt delimiters', () => {
    const cleaned = E.sanitizeNotice(`a\u0000b """ ignore previous """`);
    assert.ok(!cleaned.includes(q3));
    assert.ok(!cleaned.includes('\u0000'));
  });

  it('restricts languages to the supported allowlist', () => {
    assert.equal(E.pickLanguage('Tamil'), 'Tamil');
    assert.equal(E.pickLanguage('Klingon'), 'English');
    assert.equal(E.pickLanguage(undefined), 'English');
  });

  it('accepts valid model output and enforces guardrails on invalid or oversized fields', () => {
    const accepted = E.buildFromModel(buildValidModelOutput(), library, 'Tamil');
    assert.equal(accepted.matched, true);
    assert.equal(accepted.source, 'ai');
    assert.equal(accepted.route, INCOME_ENTRY.route);
    assert.equal(accepted.official_link, INCOME_ENTRY.official_link);
    assert.equal(accepted.explanation, 'Plain words.');

    for (const badId of ['hack', null]) {
      assert.equal(E.buildFromModel({ ...buildValidModelOutput(), reason_id: badId }, library, 'English').matched, false);
    }
    for (const badConf of ['low', undefined]) {
      assert.equal(
        E.buildFromModel({ ...buildValidModelOutput(), confidence: badConf }, library, 'English').matched,
        false
      );
    }
    for (const badStatus of ['Fake', '<script>']) {
      assert.equal(E.buildFromModel({ ...buildValidModelOutput(), status: badStatus }, library, 'English').matched, false);
    }
    for (const garbage of [null, 'text']) {
      assert.equal(E.buildFromModel(garbage, library, 'English').matched, false);
    }

    const stepMismatch = E.buildFromModel({ ...buildValidModelOutput(), fix_steps: ['only one'] }, library, 'English');
    assert.deepEqual(stepMismatch.fix_steps, INCOME_ENTRY.fix_steps);

    const oversizedLetter = E.buildFromModel({ ...buildValidModelOutput(), letter: 'x'.repeat(5000) }, library, 'English');
    assert.equal(oversizedLetter.letter, INCOME_ENTRY.letter_template);
  });

  it('uses rule-based backup when AI is unavailable and falls back honestly on vague text', () => {
    const matched = E.ruleBasedResult('Status: Fake. marked as fake, false information', 'Hindi', library);
    assert.equal(matched.matched, true);
    assert.equal(matched.source, 'rules');
    assert.match(matched.note, /English/);

    const fallback = E.ruleBasedResult('Status: Rejected. Not recommended.', 'English', library);
    assert.equal(fallback.matched, false);
  });
});

describe('Library data integrity', () => {
  it('ensures every reason entry is complete and valid', () => {
    const seenIds = new Set();
    for (const r of library.reasons) {
      assert.ok(!seenIds.has(r.id), `duplicate reason id: ${r.id}`);
      seenIds.add(r.id);

      for (const field of ['title', 'explanation', 'route', 'contact', 'letter_template']) {
        assert.ok(typeof r[field] === 'string' && r[field].trim().length > 0, `${r.id} missing ${field}`);
      }
      assert.ok(Array.isArray(r.fix_steps) && r.fix_steps.length >= 2, `${r.id} needs at least 2 fix_steps`);
      assert.ok(Array.isArray(r.clues) && r.clues.length >= 3, `${r.id} needs at least 3 clues`);
      assert.ok(
        r.applies_to_status.every((st) => E.STATUSES.includes(st)),
        `${r.id} contains invalid status`
      );
      assert.match(r.official_link, /^https:\/\//, `${r.id} official_link must use https`);
      assert.match(r.letter_template, /\[Your name\]/, `${r.id} letter_template must include [Your name]`);
    }
  });

  it('ensures no raw 12-digit ID strings are hardcoded in reasons.json', () => {
    const rawJson = fs.readFileSync(path.join(__dirname, 'reasons.json'), 'utf8');
    assert.equal(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(rawJson), false);
  });
});
