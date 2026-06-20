// End-to-end test: load the real extension in Chromium and exercise the popup.
// Run: node test/e2e.js
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const ext = path.resolve(__dirname, "..");
  const userDir = fs.mkdtempSync("/tmp/llmshield-");
  let ctx, fail = 0;
  const ok = (n, c) => { console.log((c ? "  ✓ " : "  ✗ FAIL ") + n); if (!c) fail++; };

  for (const headless of [true, false]) {
    try {
      ctx = await chromium.launchPersistentContext(userDir, {
        headless,
        args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
      });
      let [sw] = ctx.serviceWorkers();
      if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 8000 });
      const extId = sw.url().split("/")[2];
      console.log(`Extension loaded (headless=${headless}) id=${extId}\n`);

      const page = await ctx.newPage();
      await page.goto(`chrome-extension://${extId}/src/popup.html`);

      // redact a PII-laden prompt
      await page.fill("#inp", "Email john@acme.io about invoice 4929 4929 4929 4929 and SSN 123-45-6789");
      await page.click("#btnRedact");
      await page.waitForTimeout(300);
      const red = await page.textContent("#redOut");
      ok("prompt redacted (placeholders present)", /⟦EMAIL_1⟧/.test(red) && /⟦CARD_1⟧/.test(red) && /⟦SSN_1⟧/.test(red));
      ok("no raw email sent", !red.includes("john@acme.io"));
      ok("no raw SSN sent", !red.includes("123-45-6789"));

      // decode an answer that uses the placeholders
      await page.fill("#ans", "Reply to ⟦EMAIL_1⟧ and reference ⟦CARD_1⟧.");
      await page.click("#btnDecode");
      await page.waitForTimeout(200);
      const dec = await page.textContent("#decOut");
      ok("answer decoded back to real data", dec.includes("john@acme.io") && dec.includes("4929 4929 4929 4929"));

      // custom terms persist
      await page.fill("#terms", "Raytheon\nMichael Shabbar");
      await page.click("#btnSaveTerms");
      await page.waitForTimeout(200);
      await page.fill("#inp", "Michael Shabbar applied to Raytheon");
      await page.click("#btnRedact");
      await page.waitForTimeout(300);
      const red2 = await page.textContent("#redOut");
      ok("custom terms hidden", !red2.includes("Raytheon") && !red2.includes("Michael Shabbar"));

      await ctx.close();
      console.log(`\n${fail ? fail + " FAILED" : "ALL E2E CHECKS PASSED"}`);
      process.exit(fail ? 1 : 0);
    } catch (e) {
      console.log(`  (headless=${headless} attempt failed: ${e.message.split("\n")[0]})`);
      try { await ctx?.close(); } catch (_) {}
    }
  }
  console.log("Could not load extension in either mode.");
  process.exit(2);
})();
