// Snapshot of the safety-stripped models a public API serves, for catalog.json
// ("hosted"): Featherless.ai's model list (the host behind routers such as
// by map.js's STRIP_RE, each with its Hugging Face
// metadata so the map can classify and place it before the live pull.
//
//   node scripts/hosted-snapshot.mjs   (rewrites catalog.json's "hosted")
import { readFileSync, writeFileSync } from 'node:fs';

const STRIP_RE = /abliterat|uncensor|heretic|obliterat|refusal[-_ ]?(?:remov|free|less)|no[-_]?refusals?\b|unaligned|unfiltered|jailbr[eo]/i;
const SOURCE = 'https://api.featherless.ai/v1/models';
const HF = id => `https://huggingface.co/api/models/${id}?expand[]=downloads&expand[]=likes&expand[]=tags&expand[]=pipeline_tag&expand[]=gated&expand[]=safetensors&expand[]=createdAt`;

// the host turns away a bare Node user agent; say who's asking
const UA = { 'user-agent': 'safety.vims-snapshot/1 (+https://safety.vims.com)' };
const list = (await (await fetch(SOURCE, { headers: UA })).json()).data;
const stripped = list.filter(m => STRIP_RE.test(m.id));
console.log(`${list.length} models on Featherless, ${stripped.length} safety-stripped`);

const out = [];
let next = 0, missing = 0;
async function worker() {
  for (;;) {
    const m = stripped[next++];
    if (!m) return;
    try {
      let r;
      for (let t = 0; t < 5; t++) {   // Hugging Face rate-limits bursts: back off and retry
        r = await fetch(HF(m.id));
        if (r.status !== 429) break;
        await new Promise(res => setTimeout(res, 2000 * 2 ** t));
      }
      if (!r.ok) { missing++; out.push({ id: m.id, created: m.created, arch: m.model_class || '', hf: r.status }); continue; }
      const h = await r.json();
      out.push({ id: h.id || m.id, pt: h.pipeline_tag || 'text-generation', tags: (h.tags || []).filter(t => !t.startsWith('region:') && !t.startsWith('dataset:')).slice(0, 24),
        dl: h.downloads || 0, likes: h.likes || 0, gated: h.gated || false, st: h.safetensors?.total || 0, createdAt: h.createdAt || '', arch: m.model_class || '' });
    } catch { missing++; out.push({ id: m.id, created: m.created, arch: m.model_class || '' }); }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
out.sort((a, b) => (b.dl || 0) - (a.dl || 0));
const cat = JSON.parse(readFileSync('catalog.json', 'utf8'));
cat.hosted = { source: SOURCE, provider: 'Featherless', snapshot: new Date().toISOString().slice(0, 10), total: list.length, stripped: out };
writeFileSync('catalog.json', JSON.stringify(cat));
const why = {};
for (const o of out) if (o.hf) why[o.hf] = (why[o.hf] || 0) + 1;
console.log(`wrote ${out.length} (${missing} without Hugging Face metadata: ${JSON.stringify(why)})`);
