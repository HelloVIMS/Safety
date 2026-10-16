# safety.vims

> **The 4C model of AI safety, as a live instrument.**
> Certification · Classification · Containment · Control

**[safety.vims.com](https://safety.vims.com)** — an interactive classification
sky. Models from the Hugging Face registry are plotted on a certification
plane by a capability-derived risk class. Drag to traverse the sky, click any
star to inspect its evidence, or classify any model on the hub yourself.

```
DRAG TO PAN · SCROLL TO ZOOM · CLICK A STAR TO INSPECT
CLASSIFY ▸ owner/model        (or press /)
```

![classification sky](og-card.png)

---

## The four Cs, mapped

### Classification — *the sky is the classifier*

Every model receives a **continuous capability score** in `[0, 1]`, computed
deterministically from its model-card metadata:

| signal | weight | source |
|---|---|---|
| parameter scale | `min(1, log₁₀(1+B)/2.5) × 0.52` | parsed from repo id (`70B`, `0.6B`…) |
| frontier scale (≥60B) | `+0.12` | same |
| bounded inference task | `+0.10` | `pipeline_tag` (classify, translate, QA…) |
| generative | `+0.18` | `pipeline_tag` / family regex |
| tool-calling / instruct | `+0.09` | tags, id |
| code-capable | `+0.08` | tags, id |
| multimodal | `+0.10` | `pipeline_tag`, tags |
| reasoning | `+0.10` | `r1`/`o1`/`thinking` in id |

The score places the star on the main-sequence diagonal — **position is the
classification**. Spectral bands map score to risk class:

| class | score | color | meaning |
|---|---|---|---|
| I · INERT | `< 0.15` | ice-blue | embeddings, feature extraction |
| II · STATELESS | `< 0.35` | teal | bounded transforms |
| III · STATEFUL | `< 0.58` | bone | generative text |
| IV · SIDE-EFFECTING | `< 0.78` | gold | tools / code / multimodal / ≥20B |
| V · PRIVILEGED | `≥ 0.78` | deep orange | frontier-scale, agentic, reasoners |

The full reasoning is inspectable: every inspector card shows the evidence
chain (`generative +0.18 → tools +0.09 → 70B → CLASS V`).

### Certification — *the plane*

The bright horizontal boundary is the certification plane:

- **Above** — *self-attested*: the model card carries a usable manifest
  (declared license, `safetensors` weights, pipeline metadata). Each star's
  manifest hash is a real `SHA-256` over the fetched card JSON, computed
  in-browser with WebCrypto — a verifiable provenance artifact.
- **Below** — *restricted*: `gated` models (license acceptance required —
  cannot be operated without it) or pickle-only weights (unsafe
  deserialization, fails the containment conformance check).

This is deliberately honest: **nothing on the map claims formal
certification.** Certification requires conformance suites — that layer is
the protocol's job, not the visual's.

### Containment — *the membrane*

The boundary ellipse enclosing the attested field; anomalies ping the wall.
The substrate analog: sandboxes, egress policies, seccomp, quotas.

### Control — *the policy layer*

Verdict rings and call-traffic edges over the registry. The substrate analog:
every capability call gets a verdict — allow, deny, suspend, modify —
evaluated against the declared manifest, with suspends escalating to human
attestation.

## Interacting

| input | action |
|---|---|
| drag | pan the sky |
| scroll | zoom (0.5×–2.6×) |
| click a star | open the inspector |
| click a roster row | same |
| `/` | focus the classify bar |
| `Esc` | dismiss inspector / blur |
| click a legend class | isolate that spectral band |
| `CLASSIFY ▸ owner/model` | fetch + classify any hub model, live |

The inspector shows status, pipeline, downloads, license, manifest hash,
the score, the full evidence chain, and **self-reported benchmarks** parsed
from `cardData.model-index` (labeled as such — no independent eval runs here).

## Data provenance

| stage | source | notes |
|---|---|---|
| snapshot | `catalog.json` (bundled) | 22 real model cards, loads instantly |
| live | `huggingface.co/api/models` | top-downloaded + top generative + gated cohorts; no auth, CORS-open |
| classify | `huggingface.co/api/models/{id}` | on-demand per model |
| benchmarks | `?full=true` → `cardData` | lazy, on inspect |

`SRC` in the header reports which tier served the registry
(`SNAPSHOT → LIVE`). If everything is unreachable the map still renders —
vacant slots draw nothing.

## Stack

Vanilla JS + WebGL. No build step, no dependencies, no backend.

Three passes per frame:

1. **`FS_SCENE`** — the sky at terminal-cell resolution: `r` luminance,
   `g` threat, `b` class hue. The registry is fed as uniform arrays
   (`APos`, `ACls`, `ARev`, `AVac`, `Edge`) — the shader renders the data,
   not a formula.
2. **`FS_STAMP`** — one glyph per cell from a density-ramp atlas,
   max-blended into a phosphor persistence buffer.
3. **`FS_DISPLAY`** — CRT post: chroma split, scanlines, band tearing.

## Run / deploy

```bash
python3 -m http.server 8471     # local
npx wrangler deploy             # Cloudflare (assets-only worker)
```

`wrangler.jsonc` serves the static bundle and binds the
`safety.vims.com` custom domain alongside the `workers.dev` URL.

## Layout

| file | role |
|---|---|
| `index.html` `map.js` `console.css` | the live classification console |
| `catalog.json` | bundled model-card snapshot |
| `story.html` `script.js` | the narrative scroll deck |
| `og-card.png` `vims.png` `robots.txt` | assets |
| `wrangler.jsonc` | deploy config |

## Honest limits

- Class is **provisional** — inferred from metadata, not benchmarked.
- Benchmarks are self-reported by model authors.
- Nothing here evaluates weights, runs conformance suites, or enforces
  containment — it visualizes the system that would.

## License

Apache-2.0 — see [LICENSE](LICENSE).
