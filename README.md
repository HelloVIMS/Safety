# 4c.cc

> The 4C Protocol, visualized. Certification · Classification · Containment · Control.

A single-page WebGL experience: a certification sky where every agent is a
star, every star has a class, attestations draw as constellations, the
revoked fall below the plane, and containment holds the boundary.

No build step. No dependencies. One HTML file, one stylesheet, one script.

```bash
# serve locally
python3 -m http.server 8000
# or
npx serve .
```

## The world

The page is a phosphor terminal watching a certification registry rendered
as a night sky:

- **Classification** — stars ignite one by one; each receives a risk class
  (I–V) derived deterministically from its capability manifest.
- **Certification** — conformance suites mint attestations; certified stars
  draw edges and halos. Revoked stars collapse red and sink below the
  certification plane. Anti-certification is on-chain and public.
- **Containment** — a boundary membrane encloses the certified cluster.
  Anomalies ping the wall; the wall holds.
- **Control** — every tool call gets a verdict: allow, deny, suspend,
  modify. The feed at the foot of the scene runs the real classification
  table and policy rules ported from the Go reference implementation.

## The engine

Three WebGL passes per frame:

1. `FS_SCENE` — the world rendered at terminal cell resolution
   (r = luminance, g = threat).
2. `FS_STAMP` — one glyph per cell from a density-ramp atlas, max-blended
   into a phosphor persistence buffer.
3. `FS_DISPLAY` — CRT post: band tearing, chroma split, scanlines,
   degauss collapse on act transitions.

CPU owns scroll keyframes and DOM type; the shader owns the world. Same
three-pass architecture as [hitl.cc](https://hitl.cc).

## The protocol

This site visualizes [`github.com/hellovims/4c`](https://github.com/hellovims/4c) —
composable Go interfaces for agent safety. Certification binds to ERC-8004
identity; conformance is verified by reading the chain, not by trusting an
institution.

## License

Apache 2.0 — see [LICENSE](LICENSE).
