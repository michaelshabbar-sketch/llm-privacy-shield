# 🛡️ LLM Privacy Shield

**Keep your private data out of the cloud — while still getting real answers from any LLM.**

When you chat with ChatGPT, Claude, Gemini, or any other AI, your words go to that
company's servers. LLM Privacy Shield swaps your **private data** (names, emails,
phone numbers, account/card numbers, API keys, addresses, and anything you mark
private) for **safe placeholders** *before* it leaves your machine. The AI answers
the real problem using the placeholders, and the Shield puts your real information
back into the answer **locally** — so the cloud only ever sees `⟦EMAIL_1⟧`, never
`you@example.com`.

> Your data is masked on your computer. Nothing is ever uploaded to us — there is no
> "us." It's 100% local. Free. Works with every LLM.

## How it works

```
Your prompt:   "Email john@acme.io about invoice 4929 4929 4929 4929"
        │  (Shield redacts locally, on your machine)
        ▼
Sent to LLM:   "Email ⟦EMAIL_1⟧ about invoice ⟦CARD_1⟧"
        │  (LLM answers using the placeholders)
        ▼
LLM replies:   "Sure — email ⟦EMAIL_1⟧ and reference ⟦CARD_1⟧ …"
        │  (Shield restores your real data locally)
        ▼
You see:       "Sure — email john@acme.io and reference 4929 4929 4929 4929 …"
```

The LLM still solves your actual problem — it just never sees the sensitive values.

## Two ways to use it

1. **In-page button.** On ChatGPT, Claude, Gemini, Perplexity, Copilot, DeepSeek,
   Grok, Mistral, and more, a floating **🛡️ Redact** button appears. Type your prompt
   and click it (or press ⌘/Ctrl+Shift+R). It then **verifies** the swap actually
   happened:
   - On sites with a normal input box, your prompt is replaced in place — review & send.
   - Some editors (e.g. **ChatGPT's**) lock out programmatic edits. Rather than lie,
     the button **copies the safe version to your clipboard and tells you to clear the
     box and paste** (⌘/Ctrl+V) before sending. It will **never** claim "redacted" while
     your real data is still in the box.
   The AI's reply is automatically decoded back to your real data on screen.
2. **Universal scratchpad (works for ANY LLM/app — the bulletproof path).** Open the
   extension popup, paste your prompt → get a safe copy → paste it into *any* AI. Paste
   the reply back → get your real answer. Always works, because redaction happens before
   you ever copy.

## What it hides

Emails · phone numbers · SSNs · credit-card / IBAN numbers · IP addresses · street
addresses · API keys & secrets (OpenAI, GitHub, Google, AWS, Slack…) · private keys ·
**plus any custom terms you add** (your name, employer, account numbers — the things
only you know are sensitive).

## Install (takes 30 seconds)

1. Download/clone this folder.
2. Open **chrome://extensions** → turn on **Developer mode** (top-right).
3. Click **Load unpacked** → select this folder.
4. Pin the 🛡️ icon. Open it once to add your private terms (your name, etc.).

That's it. Works in Chrome, Edge, Brave, and any Chromium browser.

## Privacy & design

- **Fully local.** All redaction happens in your browser. No servers, no telemetry,
  no account. Your data and your custom terms never leave your machine.
- **Reversible & consistent.** The same value always maps to the same placeholder, so
  the AI can reason about it; your real data is restored only on your screen.
- **Reliable by design.** Redaction is *user-triggered* (you click before sending), so
  there's no race condition that could leak data. The scratchpad is fully manual for
  total certainty.
- **No blocklist can be perfect** — review the safe version before you send, and add
  your own sensitive terms in the popup.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome MV3 extension manifest |
| `src/redactor.js` | The reversible redaction engine (the core; covered by tests) |
| `src/content.js` | In-page 🛡️ button + automatic answer decoding on LLM sites |
| `src/popup.html` / `src/popup.js` | Universal scratchpad + your private-terms settings |
| `test/test-redactor.js` | Engine tests — `node test/test-redactor.js` |

## License

MIT — free for anyone to use, share, and build on.
