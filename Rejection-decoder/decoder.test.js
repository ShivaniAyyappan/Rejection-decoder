const test = require("node:test");
const assert = require("node:assert/strict");
const {
  maskSensitiveText,
  classifyRemark,
  setCachedExplanation,
  getCachedExplanation,
  MAX_CACHE_ENTRIES
} = require("../logic.js");

test("maskSensitiveText masks emails, IDs, phones, and long numbers without spaces", () => {
  const input = "Email:student@example.com ID:1234-5678-9012 Phone:+919876543210 Acct:1234567890123";
  const { cleaned, maskedCount } = maskSensitiveText(input);
  assert.equal(maskedCount, 4);
  assert.ok(!cleaned.includes("student@example.com"));
  assert.ok(!cleaned.includes("1234-5678-9012"));
  assert.ok(!cleaned.includes("9876543210"));
  assert.ok(!cleaned.includes("1234567890123"));
});

test("classifyRemark categorizes common scholarship remarks", () => {
  assert.equal(classifyRemark("Income certificate expired"), "income");
  assert.equal(classifyRemark("Applicant name mismatch"), "name");
  assert.equal(classifyRemark("Bank NPCI seeding pending"), "bank");
  assert.equal(classifyRemark("Generic remark"), "unclear");
});

test("bounded cache evicts oldest entry when full", () => {
  for (let i = 0; i < MAX_CACHE_ENTRIES + 5; i++) {
    setCachedExplanation(`k-${i}`, i);
  }
  assert.equal(getCachedExplanation("k-0"), null);
  assert.equal(getCachedExplanation(`k-${MAX_CACHE_ENTRIES + 4}`), MAX_CACHE_ENTRIES + 4);
});
