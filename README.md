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

The sky is an H–R diagram over the registry:

- **x = capability score** — **horizontal position is the classification**;
  spectral bands along it map score to risk class.
- **y = adoption** — rank by monthly downloads among plotted models. Attested
  models rise above the certification plane; restricted models mirror below it.

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
| drag (mouse or one finger) | pan the sky |
| scroll / pinch | zoom about the cursor or pinch midpoint (0.5×–4×) |
| click / tap a star | open the inspector; touch uses a larger hit radius |
| click a roster row | open + fly the camera to the star |
| `/` | focus search |
| `↑` `↓` `Enter` | move through results / choose |
| `Esc` | clear search · dismiss inspector |
| `F` / `⛶` | fullscreen |
| `H` | hide all panels — bare map |
| drag a card header | move legend / registry / inspector anywhere |
| `–` on a card | collapse it · drag the registry's corner to resize |
| double-click a header | reset that card's position |
| click a legend class | isolate that spectral band |
| `CLASSIFY ▸` search | see below |

**Search.** Typing matches instantly against the whole ingested census
(~400 models, not just the 128 plotted), ranked exact → name prefix → id
prefix → substring → all tokens, then by downloads. A debounced Hub search
fills a second section; every hit shows its provisional class *before* you
pick it, plus where it lives (`ON MAP` / `INDEXED` / `HUB`). Choosing a
result flies to the star — placing it first if needed (evicting the
least-downloaded star on the same side of the plane). Hub picks and typed
`owner/model` ids or hub URLs fetch the full model card first, so `gated`
and the manifest hash come from the authoritative record. Unknown ids
report `✗ not found` inline.

Card positions, collapsed state and registry height persist in
`localStorage`.

**Mobile:** the header collapses to brand / classify / stats; `REGISTRY` and
`CLASSES` in the bottom bar open the roster and legend as sheets, and the
inspector opens as a bottom sheet with the selected star framed above it.
Portrait screens show a slice of the capability axis at zoom 1 — pan for the
rest. Labels are collision-culled in priority order (selected → hovered →
download rank), so dense regions only label what fits.

The inspector shows status, pipeline, downloads, license, manifest hash,
the score, the full evidence chain, and **self-reported benchmarks** parsed
from `cardData.model-index` (labeled as such — no independent eval runs here).

## Data provenance

| stage | source | notes |
|---|---|---|
| snapshot | `catalog.json` (bundled) | 22 real model cards, loads instantly |
| live | `huggingface.co/api/models` | 9 cohorts — top downloads, text/text2text/image-text/ASR pipelines, meta-llama, deepseek-ai, mistralai, nvidia; deduped (~400 models); top 128 plotted; no auth, CORS-open |
| classify | `huggingface.co/api/models/{id}` | on-demand per model |
| benchmarks | `?full=true` → `cardData` | lazy, on inspect |

`SRC` in the header reports which tier served the registry
(`SNAPSHOT → LIVE`). If everything is unreachable the map still renders —
vacant slots draw nothing.

## Stack

Vanilla JS + WebGL. No build step, no dependencies, no backend.

Three passes per frame:

1. **`FS_SCENE`** — the sky at terminal-cell resolution: `r` luminance,
   `g` threat, `b` class hue. The registry is uploaded as a 512×1 RGBA8
   texture (16-bit position + class/restricted/vacant flags per node, edge
   index pairs) — no uniform-vector ceiling, works on every WebGL1 driver.
2. **`FS_STAMP`** — one glyph per cell from a density-ramp atlas,
   max-blended into a phosphor persistence buffer.
3. **`FS_DISPLAY`** — CRT post: chroma split, scanlines, band tearing.

GL resources are rebuilt on `webglcontextrestored`, render targets are freed
and reallocated only when the backing size changes, and if WebGL is
unavailable the registry, inspector and classify bar still work as a list.

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
