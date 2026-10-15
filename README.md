# safety.vims

> **The 4C model of AI safety, as a live instrument.**
> Certification · Classification · Containment · Control

An interactive classification sky. Models from a live registry are plotted on
a certification plane by capability-derived risk class. Drag to traverse the
sky, click any star to inspect its attestation evidence, or classify any model
on Hugging Face yourself.

```
DRAG TO PAN · SCROLL TO ZOOM · CLICK A STAR TO INSPECT
CLASSIFY ▸ owner/model     (or press /)
```

![classification sky](og-card.png)

## The four Cs, mapped

- **Classification** — every model gets a continuous capability score
  (parameter scale + tool-use, code, multimodal, and reasoning signals read
  from its model card). The score maps onto a spectral band:
  `I INERT → II STATELESS → III STATEFUL → IV SIDE-EFFECTING → V PRIVILEGED`.
  Position on the diagonal *is* the score — a Hertzsprung–Russell diagram for
  models.
- **Certification** — the bright horizontal plane. Above it: self-attested
  models carrying a real manifest (declared license, safetensors, card data).
  Below it: restricted models — license-gated or pickle-only serialization.
  A star's manifest hash is a genuine SHA-256 over its fetched card JSON,
  computed in-browser via WebCrypto.
- **Containment** — the boundary membrane enclosing the attested field.
- **Control** — the policy layer: verdict rings and call-traffic edges.
  The Go reference implementation lives in
  [`hellovims/4c`](https://github.com/hellovims/4c) — ToolCall → Verdict
  evaluation, conformance suites, revocation registries.

## Interacting

- **Drag** to pan · **scroll** to zoom · **click** a star or roster row for
  the inspector — status, pipeline, downloads, license, manifest, the full
  classification evidence chain, and self-reported benchmark tables.
- **`CLASSIFY ▸`** (top center, or `/`) — type `owner/model` or paste a
  huggingface.co URL. The card is fetched, scored, and the star ignites on
  the sky with a birth flare. `Esc` dismisses.
- **Legend** chips isolate a risk class; counts are live.

## Data — what's real

- **Live**: `huggingface.co/api/models` — public, no keys, CORS-open. Fetches
  top-downloaded, top generative, and gated cohorts at load.
- **Bundled**: `catalog.json` — a snapshot of real model cards so the map
  populates instantly and offline. `SRC` reads `SNAPSHOT → LIVE` when the
  hub answers.
- **Honest**: classification is deterministic from model-card metadata — a
  *provisional* class, not an evaluation. Benchmarks in the inspector are
  self-reported by model authors (`cardData.model-index`), labeled as such.
  Nothing here claims formal certification — that requires conformance
  suites, which is what the protocol layer is for.

## Stack

Vanilla JS + WebGL. Three passes per frame:

1. `FS_SCENE` — the sky at glyph-cell resolution (r luminance, g threat,
   b class hue). The registry arrives as uniform arrays — the shader renders
   the data, not a formula.
2. `FS_STAMP` — one glyph per cell, max-blended into a phosphor
   persistence buffer.
3. `FS_DISPLAY` — CRT post: chroma split, scanlines, band tearing.

No build step, no dependencies. Static files deploy anywhere.

```bash
python3 -m http.server 8471     # local
npx wrangler deploy             # cloudflare (assets-only worker)
```

## Layout

| file | role |
|---|---|
| `index.html` `map.js` `console.css` | the live classification console |
| `catalog.json` | bundled model-card snapshot |
| `story.html` `script.js` | the narrative scroll deck |

## License

Apache-2.0 — see [LICENSE](LICENSE).
