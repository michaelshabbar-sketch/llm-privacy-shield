// Node test for the redaction engine. Run: node test/test-redactor.js
const R = require("../src/redactor.js");
let pass = 0, fail = 0;
function ok(name, cond) { cond ? (pass++, console.log("  ✓ " + name)) : (fail++, console.log("  ✗ FAIL: " + name)); }

console.log("Redaction engine tests:\n");

// 1. Email is masked and reversible
{
  const { redacted, map } = R.redact("Contact me at michael.shabbar@gmail.com please");
  ok("email redacted", !redacted.includes("michael.shabbar@gmail.com") && /⟦EMAIL_1⟧/.test(redacted));
  ok("email reversible", R.unredact(redacted, map) === "Contact me at michael.shabbar@gmail.com please");
}

// 2. Multiple PII types in one prompt
{
  const t = "My SSN is 123-45-6789, card 4111 1111 1111 1111, call 415-555-0199.";
  const { redacted, map } = R.redact(t);
  ok("ssn masked", !redacted.includes("123-45-6789"));
  ok("card masked", !redacted.includes("4111 1111 1111 1111"));
  ok("phone masked", !redacted.includes("415-555-0199"));
  ok("multi reversible", R.unredact(redacted, map) === t);
}

// 3. Secrets/tokens
{
  const t = "key sk-abcdefghij1234567890 and ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
  const { redacted } = R.redact(t);
  ok("openai-style key masked", !redacted.includes("sk-abcdefghij1234567890"));
  ok("github pat masked", !redacted.includes("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"));
}

// 4. Same value -> same placeholder (consistency, so the LLM can reason)
{
  const { redacted } = R.redact("a@x.com wrote to a@x.com");
  const matches = redacted.match(/⟦EMAIL_1⟧/g) || [];
  ok("repeat value reuses placeholder", matches.length === 2 && !/⟦EMAIL_2⟧/.test(redacted));
}

// 5. Custom terms (names/employer the user lists)
{
  const { redacted, map } = R.redact("Michael Shabbar works at Raytheon", { customTerms: ["Michael Shabbar", "Raytheon"] });
  ok("custom name masked", !redacted.includes("Michael Shabbar"));
  ok("custom employer masked", !redacted.includes("Raytheon"));
  ok("custom reversible", R.unredact(redacted, map) === "Michael Shabbar works at Raytheon");
}

// 6. The full round-trip an LLM would do: redact -> (LLM answers using placeholder) -> unredact
{
  const prompt = "Write a refund email for order from john@acme.io about invoice 4929 4929 4929 4929";
  const { redacted, map } = R.redact(prompt);
  ok("cloud never sees the email", !redacted.includes("john@acme.io"));
  // simulate an LLM answer that echoes the placeholder
  const fakeAnswer = "Sure! Email ⟦EMAIL_1⟧ and reference card ⟦CARD_1⟧ for the refund.";
  const restored = R.unredact(fakeAnswer, map);
  ok("answer restored locally", restored.includes("john@acme.io") && restored.includes("4929 4929 4929 4929"));
}

// 7. No false-positive corruption of clean text
{
  const t = "The quick brown fox jumps over the lazy dog.";
  const { redacted, map } = R.redact(t);
  ok("clean text untouched", redacted === t && Object.keys(map.byPlaceholder).length === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
