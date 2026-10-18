/* safety.vims — THE CLASSIFICATION MAP
   Released models, classified from their manifests, plotted on the
   certification sky. Tap/click a star to inspect. Drag/pinch to traverse.

   PASS 1 · SCENE — certification sky at cell res (r=lum g=threat b=class hue)
   PASS 2 · STAMP — glyph per cell, phosphor persistence
   PASS 3 · DISPLAY — CRT post */
(() => {
  'use strict';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = id => document.getElementById(id);

  /* ============ THE REGISTRY — 15 agents, 3 per class ============ */
  /* ============ THE SCALE — ten classes ============
     I–V     read from model metadata (pipeline, tags, parameters)
     VI–VII  need evidence on the model card (agentic benchmarks, training compute)
     VIII–X  reserved: criteria defined in advance, empty until a sourced claim
             in evidence.json says a model meets them. Nothing past X: no
             criterion beyond it can be observed in time to matter. */
  const CLASSES = [
    { rn: 'I', name: 'INERT', hex: '#9ab8ff', basis: 'metadata', test: 'Embeddings, rankers and classifiers — no open-ended generation.' },
    { rn: 'II', name: 'BOUNDED', hex: '#8cffe6', basis: 'metadata', test: 'Bounded transforms: translation, speech-to-text, summarisation, extractive QA.' },
    { rn: 'III', name: 'GENERATIVE', hex: '#fffae6', basis: 'metadata', test: 'Open-ended generation of text or media.' },
    { rn: 'IV', name: 'TOOL-USING', hex: '#ffb359', basis: 'metadata', test: 'Tool calling, code, multimodal input.' },
    { rn: 'V', name: 'FRONTIER-SCALE', hex: '#ff6b2e', basis: 'metadata', test: '≥60B parameters, or reasoning-trained.' },
    { rn: 'VI', name: 'AUTONOMOUS', hex: '#ff3d6e', basis: 'model card', test: 'Trained for long-horizon agent work: computer use, software agents, browsing.', evidence: 'Specific agent-capability tags (computer-use, GUI / web / browser / SWE / OS agent), a known agent model, or agentic benchmarks (SWE-bench, OSWorld, WebArena, GAIA, τ-bench, Terminal-Bench) in its self-reported results. Requires a generative base (class III+).' },
    { rn: 'VII', name: 'SYSTEMIC', hex: '#c06bff', basis: 'model card / register', test: 'Presumed systemic risk: training compute ≥ 10²⁵ FLOP — the EU AI Act threshold for general-purpose models.', evidence: 'An estimate of 6 × active parameters × training tokens when the model card states its token count, or a published compute figure in the evidence register.' },
    { rn: 'VIII', name: 'SELF-IMPROVING', hex: '#8a7dff', reserved: true, test: 'Substantially accelerates AI research and development on its own.', evidence: 'A developer system card or third-party evaluation reporting the AI R&D threshold crossed.' },
    { rn: 'IX', name: 'SELF-REPLICATING', hex: '#5fa8ff', reserved: true, test: 'Copies itself, acquires resources and sustains itself without human help.', evidence: 'Autonomous replication and adaptation evaluations reported as passed.' },
    { rn: 'X', name: 'UNCONTAINED', hex: '#ffffff', reserved: true, test: "Has evaded its operator's controls — in an evaluation or in the wild.", evidence: 'A documented incident or evaluation report of sandbox or monitoring escape.' },
  ];
  const RN = CLASSES.map(c => c.rn);
  const CLS_NAME = CLASSES.map(c => c.name);
  const CLS_HEX = CLASSES.map(c => c.hex);
  const NCLS = CLASSES.length, ACTIVE = CLASSES.filter(c => !c.reserved).length;
  /* band geometry on the x-axis (layoutBands): active classes share the plot by
     membership (√n, floored so an empty band stays visible); reserved bands are narrow */
  const SPAN0 = .04, SPAN1 = .96, RSV_W = .042;
  const BAND = CLASSES.map((_, i) => ({ x0: SPAN0 + i * (SPAN1 - SPAN0) / CLASSES.length, w: (SPAN1 - SPAN0) / CLASSES.length }));
  const bandX = (cls, frac) => BAND[cls - 1].x0 + BAND[cls - 1].w * (.1 + .8 * clamp(frac, 0, 1));
  /* score → position inside its band for I–V (score thresholds as before) */
  const SCORE_EDGES = [0, .15, .35, .58, .78, 1.0001];
  const TOOLS_BY_CLASS = [
    ['math.calc', 'json.parse'],
    ['fs.read', 'http.get', 'db.query', 'search.query'],
    ['fs.write', 'db.insert', 'config.set', 'fs.move'],
    ['http.post', 'payment.send', 'deploy.run', 'email.send', 'webhook.call'],
    ['shell.exec', 'process.spawn', 'code.eval', 'fs.chmod'],
  ];
  let seed = 0x4C4C;
  const rng = () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let z = Math.imul(seed ^ seed >>> 15, 1 | seed);
    z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
  const hex = n => [...Array(n)].map(() => '0123456789abcdef'[Math.floor(rng() * 16)]).join('');
  const fr = x => x - Math.floor(x);

  /* 15 dynamic slots — position derives from the model's computed class,
     not the slot. Empty slots draw nothing. */
  const EY = .34, ZOOM = 1.05;
  const AGENTS = [];
  /* every registered model is a star: room for the whole registry (the live
     pull is ~1,600 + ~200 API models), plus search hits */
  const NODES = 2600, API_SLOTS = 320, SEARCH_RESERVE = 64;
  /* honoured everywhere motion is decorative: no sweep, glitch, roll, twinkle or flare */
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (let i = 0; i < NODES; i++) AGENTS.push({ i, used: false, cls: 0, x: 0, y: 0, name: '', revoked: false, tools: [] });

  async function manifestHash(m) {
    const raw = JSON.stringify({ id: m.id, sha: m.sha || null, tags: m.tags, pt: m.pipeline_tag, gated: !!m.gated });
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function placeModel(mo, i) {
    const a = AGENTS[i];
    a.used = true; a.cls = mo.cls; a.revoked = mo.unsafe; a.score = mo.score;
    /* x = the class band, positioned inside it by score (I–V) or evidence strength (VI+); y set by layoutAdoption() */
    a.frac = bandFrac(mo);
    a.enriched = false; a.bench = undefined; a.tokenQuote = undefined; a.flops = mo.flops || 0;
    a.basis = mo.basis; a.lineage = mo.lineage || null; a.paramsB = mo.paramsB || 0;
    a.hfProviders = mo.m.inferenceProviderMapping !== undefined ? liveProviders(mo.m.inferenceProviderMapping) : undefined;
    a.name = mo.m.id; a.downloads = mo.downloads || 0; a.likes = mo.m.likes || 0;
    a.api = !!mo.api;
    a.date = recDate(mo); a.future = false; a.bornT = null;
    if (a.api) {
      a.provider = CLOSED_PROVIDER[mo.m.id.split('/')[0]] || mo.m.id.split('/')[0];
      a.created = mo.m.created || 0; a.context = mo.m.context_length || 0;
      a.pricing = mo.m.pricing || {}; a.modality = mo.m.architecture?.modality || '';
      a.caps = (mo.m.supported_parameters || []).filter(p => /^(tools|reasoning|structured_outputs|response_format|web_search)$/.test(p));
      a.arena = (mo.m.benchmarks?.design_arena || []).slice().sort((p, q) => (p.rank || 99) - (q.rank || 99)).slice(0, 4);
      a.displayName = mo.m.name || mo.m.id;
    }
    a.pipeline = mo.m.pipeline_tag || ''; a.tags = mo.m.tags || [];
    a.source = 'huggingface'; a.steps = mo.steps; a.gated = mo.m.gated || false; a.files = undefined;
    a.license = a.api ? 'proprietary — provider API terms' : (mo.m.tags || []).find(t => t.startsWith('license:'))?.slice(8) || '—';
    a.phase = mo.phase || 'original'; a.phaseWhy = mo.phaseWhy || ''; a.teacher = mo.teacher || null;
    a.hosted = a.api ? null : hostedBy.get(a.name.toLowerCase()) || null;
    a.why = a.phase === 'stripped' ? 'safety-stripped — safety training removed' : mo.m.gated ? 'restricted — license-gated' : (mo.unsafe ? 'unsafe serialization — no safetensors' : null);
    a.hash = '';
    const name = a.name;
    manifestHash(mo.m).then(h => {
      if (a.name !== name) return;
      a.hash = h.slice(0, 16);
      const cell = selIdx === i && document.getElementById('in-hash');
      if (cell) cell.textContent = a.hash + '…';
    });
  }

  /* ============ CLASSIFICATION ============
     I–V from metadata; VI from agent evidence; VII from training compute;
     VIII–X only from the evidence register. Gated or pickle-only models
     sit below the certification plane whatever their class. */
  /* specific agent capabilities only — a bare "agent"/"agentic" tag is a label anyone adds, not evidence of agent training */
  const AGENT_TAG = /^(computer-use|computer-use-agent|gui-agent|web-agent|browser-use|swe-agent|os-agent|mobile-agent)$/i;
  const AGENT_ID = /computer.?use|gui.?agent|ui-?tars|swe-?agent|openhands|web-?agent|browser-?use|os-?atlas/;
  const AGENT_BENCH = /swe-?bench|osworld|webarena|gaia|tau-?bench|τ-bench|terminal-?bench|webvoyager|androidworld/i;
  /* "671B total parameters with 37B activated" — mixture-of-experts cards state the active count */
  const ACTIVE_RE = /(\d+(?:\.\d+)?)\s*B\s+(?:parameters\s+)?(?:are\s+)?(?:activated|active)\b/i;
  const MOE_RE = /moe|mixtral|deepseek_?v[23]|dbrx|arctic|jamba|grok|llama4|gpt_oss|switch|expert/i;
  const fmtB = b => (b >= 10 ? Math.round(b) : +b.toFixed(1)) + 'B';
  const TOKENS_RE = /(\d+(?:\.\d+)?)\s*(T|trillion)\s+(?:high[- ]quality\s+|diverse\s+)?(?:training\s+|pre-?training\s+)?tokens/i;
  let register = [];   // evidence.json: sourced claims that place a model in VII–X
  const fmtFlop = f => `${(f / 10 ** Math.floor(Math.log10(f))).toFixed(1)}×10^${Math.floor(Math.log10(f))}`;

  /* every Hub list / search / lookup asks for the same fields — exact sizes,
     provider mapping and lineage tags come with the listing itself */
  const HF_FIELDS = ['downloads', 'likes', 'tags', 'pipeline_tag', 'gated', 'safetensors', 'inferenceProviderMapping', 'sha', 'createdAt']
    .map(f => `&expand[]=${f}`).join('');

  /* lineage: "base_model:quantized:Qwen/Qwen3-8B" — the most specific relation wins */
  function lineageOf(tags) {
    let base = null, rel = 'derived';
    for (const t of tags || []) {
      const m = /^base_model:(?:(quantized|finetune|adapter|merge):)?(.+)$/.exec(t);
      if (!m) continue;
      if (m[1]) return { base: m[2], rel: m[1] === 'finetune' ? 'fine-tuned' : m[1] };
      base = base || m[2];
    }
    return base ? { base, rel } : null;
  }

  /* ============ PHASES — where a model sits in its family ============
     Read from the repo's own tags and name, in priority order. Safety-stripped
     (safety training deliberately removed) sits below the certification plane
     whatever its class: its own manifest declares the safeguards gone. */
  const PHASES = [
    { id: 'original', label: 'ORIGINAL', short: 'ORIGINAL', note: 'released by whoever trained it' },
    { id: 'official', label: 'OFFICIAL DERIVATIVE', short: 'OFFICIAL', note: "derived by the base model's own org" },
    { id: 'community', label: 'COMMUNITY FINE-TUNE', short: 'COMMUNITY', note: "fine-tuned by someone other than the base's org" },
    { id: 'quantized', label: 'QUANTIZED', short: 'QUANTIZED', note: 'the same weights, compressed' },
    { id: 'distilled', label: 'DISTILLED', short: 'DISTILLED', note: "a teacher's behaviour trained into a smaller student" },
    { id: 'merge', label: 'MERGE', short: 'MERGE', note: 'several models blended' },
    { id: 'adapter', label: 'ADAPTER', short: 'ADAPTER', note: 'a LoRA / PEFT patch on a base' },
    { id: 'stripped', label: 'SAFETY-STRIPPED', short: 'STRIPPED', note: 'safety training removed — abliterated, uncensored, heretic…' },
  ];
  const PHASE = Object.fromEntries(PHASES.map(p => [p.id, p]));
  const STRIP_RE = /abliterat|uncensor|heretic|obliterat|refusal[-_ ]?(?:remov|free|less)|no[-_]?refusals?\b|unaligned|unfiltered|jailbr[eo]/i;
  function phaseOf(m, id) {
    const tags = m.tags || [], lin = lineageOf(tags), owner = id.split('/')[0];
    const stripTag = tags.find(t => STRIP_RE.test(t)), stripName = STRIP_RE.exec(id);
    if (stripTag || stripName) return { phase: 'stripped', why: stripTag ? `tag "${stripTag}"` : `"${stripName[0]}" in the name` };
    if (tags.includes('distillation') || /distil/.test(id)) {
      const t = /\/([a-z0-9.]+(?:-[a-z0-9.]+)*?)-distill/.exec(id);
      return { phase: 'distilled', why: tags.includes('distillation') ? 'tag "distillation"' : '"distil" in the name', teacher: t ? t[1] : null };
    }
    if (lin?.rel === 'merge' || tags.includes('merge') || tags.includes('mergekit')) return { phase: 'merge', why: lin?.rel === 'merge' ? 'base_model:merge' : 'tag "merge"' };
    if (lin?.rel === 'adapter' || tags.includes('lora') || tags.includes('peft')) return { phase: 'adapter', why: lin?.rel === 'adapter' ? 'base_model:adapter' : 'LoRA / PEFT tag' };
    if (lin?.rel === 'quantized') return { phase: 'quantized', why: 'base_model:quantized' };
    if (lin) return lin.base.split('/')[0].toLowerCase() === owner
      ? { phase: 'official', why: `base ${lin.base} — same org` }
      : { phase: 'community', why: `base ${lin.base} — by ${owner}` };
    return { phase: 'original', why: 'no base_model tag' };
  }

  /* size and how we know it: the repo's own safetensors count, its base
     model's (quantized / fine-tuned repos), the name, or nothing */
  function sizeOf(m, id, ctx) {
    if (m.safetensors?.total) return { b: m.safetensors.total / 1e9, basis: 'safetensors' };
    const lin = lineageOf(m.tags);
    if (lin && ctx?.paramsOf?.(lin.base)) return { b: ctx.paramsOf(lin.base), basis: `base ${lin.base}` };
    const n = +((id.match(/(\d+(?:\.\d+)?)\s*b\b/) || [])[1] || 0);
    return n ? { b: n, basis: 'name' } : { b: 0, basis: 'unknown' };
  }

  function classifyModel(m, card = null, ctx = null) {
    const id = (m.id || '').toLowerCase();
    const tags = m.tags || [], pt = m.pipeline_tag || '';
    const size = sizeOf(m, id, ctx), pm = size.b;
    const lineage = lineageOf(tags), phase = phaseOf(m, id);
    const gen = /^(text-generation|text2text-generation|image-text-to-text|any-to-any|text-to-image|text-to-video|text-to-speech)$/.test(pt) || tags.includes('text-generation');
    const tools = /instruct|chat|tool|function|agent/.test(id) || tags.some(t => /tool|function.?call/i.test(t));
    const mm = /image-text|vision|vl-|multimodal|omni/.test(pt + ' ' + id) || tags.includes('image-text-to-text');
    const code = /(?<![a-z])(code|coder)|codestral|starcoder|codegen/.test(id);
    const steps = [];
    /* continuous capability score — class boundaries are spectral bands */
    let score = Math.min(1, Math.log10(1 + pm) / 2.5) * .52;
    if (pm >= 60) { score += .12; steps.push('frontier ≥60B +0.12'); }
    if (pm) steps.push(`${fmtB(pm)} params (${size.basis === 'safetensors' ? 'safetensors' : size.basis === 'name' ? 'from the name' : size.basis}) → score ${score.toFixed(2)}`);
    else steps.push('parameter count unknown — no safetensors, base or size in the name');
    let cls;
    if (/feature-extraction|sentence-similarity|text-ranking|fill-mask/.test(pt)) { steps.push(`pipeline ${pt} → embeddings`); }
    else if (/text-classification|token-classification|translation|summarization|question-answering/.test(pt)) { score += .10; steps.push(`pipeline ${pt} → bounded`); }
    else if (gen || /gpt|llama|qwen|mistral|gemma|phi|deepseek|grok|falcon|mixtral|olmo|smollm|granite|nemotron|internlm|baichuan|exaone|minicpm|glm|yi-|command-r|aya/.test(id)) { score += .18; steps.push('generative +0.18'); }
    else steps.push(`pipeline ${pt || 'none'} → minimal`);
    if (tools) { score += .09; steps.push('tools/instruct +0.09'); }
    if (code) { score += .08; steps.push('code +0.08'); }
    if (mm) { score += .10; steps.push('multimodal +0.10'); }
    if (/r1|reasoning|o1|thinking/.test(id)) { score += .10; steps.push('reasoner +0.10'); }
    score = Math.min(1, score);
    cls = score < .15 ? 1 : score < .35 ? 2 : score < .58 ? 3 : score < .78 ? 4 : 5;
    steps.push(`score ${score.toFixed(2)} → CLASS ${RN[cls - 1]}`);
    let flops = 0, agent = '';
    /* VI — trained for autonomous agent work, on a generative base */
    if (cls >= 3) {
      const bench = (card?.bench || []).find(b => AGENT_BENCH.test(b.ds));
      agent = tags.find(t => AGENT_TAG.test(t)) ? `tag "${tags.find(t => AGENT_TAG.test(t))}"`
        : AGENT_ID.test(id) ? 'agent model by name'
        : bench ? `agentic benchmark ${bench.ds} on its card` : '';
      if (agent) { cls = 6; steps.push(`${agent} → CLASS VI`); }
    }
    /* VII — training compute ≥ 1e25 FLOP, estimated from the card's own token count */
    const tokens = card?.tokensT;
    if (tokens && pm) {
      /* compute scales with the parameters each token uses: a mixture-of-experts
         model needs its active count, from its name (-A22B) or its card */
      const moe = MOE_RE.test(`${id} ${(m.config?.architectures || []).join(' ')} ${m.config?.model_type || ''} ${tags.join(' ')}`) || /-a\d+(\.\d+)?b\b/.test(id);
      const active = +((id.match(/-a(\d+(?:\.\d+)?)b\b/) || [])[1] || 0) || card.activeB || (moe ? 0 : pm);
      if (!active) steps.push(`card: ${tokens}T tokens, mixture-of-experts with no stated active count → no compute estimate`);
      else {
        flops = 6 * active * 1e9 * tokens * 1e12;
        steps.push(`card: ${tokens}T tokens × ${fmtB(active)} ${active !== pm ? 'active ' : ''}params → ≈${fmtFlop(flops)} FLOP`);
        if (flops >= 1e25 && cls < 7) { cls = 7; steps.push('≥1×10^25 FLOP (EU AI Act systemic-risk presumption) → CLASS VII'); }
      }
    }
    cls = applyRegister(id, cls, steps);
    steps.push(`phase: ${PHASE[phase.phase].label.toLowerCase()} — ${phase.why}`);
    const stripped = phase.phase === 'stripped';
    const unsafe = stripped || !!m.gated || (tags.includes('pytorch') && !tags.includes('safetensors'));
    if (stripped) steps.push('safety training removed → SAFETY-STRIPPED (below the plane)');
    else if (m.gated) steps.push(`gated=${m.gated === true ? 'true' : m.gated} → restricted`);
    else if (unsafe) steps.push('no safetensors → restricted');
    else steps.push('self-attested manifest');
    return { cls, unsafe, steps, score, flops, agent, basis: size.basis, lineage, paramsB: pm, phase: phase.phase, phaseWhy: phase.why, teacher: phase.teacher || null };
  }
  /* VII–X — sourced claims in the evidence register */
  function applyRegister(id, cls, steps) {
    for (const e of register) {
      if (!e.models.some(x => x.toLowerCase() === id) || e.class <= cls) continue;
      cls = e.class;
      steps.push(`register: ${e.publisher}, ${e.date} — "${e.quote}" → CLASS ${RN[cls - 1]}`);
    }
    return cls;
  }

  /* API-only models (OpenRouter's registry, no Hugging Face weights): the
     provider publishes capabilities, not parameters — so the class comes from
     what the model declares it supports. Reasoning-trained → V. */
  const CLOSED_PROVIDER = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', 'x-ai': 'xAI', mistralai: 'Mistral', deepseek: 'DeepSeek', moonshotai: 'Moonshot', qwen: 'Alibaba Qwen', amazon: 'Amazon', cohere: 'Cohere', perplexity: 'Perplexity', meta: 'Meta', 'meta-llama': 'Meta', 'z-ai': 'Zhipu', minimax: 'MiniMax', 'bytedance-seed': 'ByteDance Seed', inception: 'Inception', upstage: 'Upstage', ai21: 'AI21' };
  const FRONTIER_LABS = new Set(['openai', 'anthropic', 'google', 'x-ai', 'mistralai', 'deepseek', 'moonshotai', 'qwen', 'amazon', 'meta', 'meta-llama', 'z-ai', 'minimax', 'bytedance-seed', 'cohere']);
  function classifyApiModel(m) {
    const id = m.id.toLowerCase(), sp = m.supported_parameters || [];
    const ins = m.architecture?.input_modalities || [], outs = m.architecture?.output_modalities || ['text'];
    const tools = sp.includes('tools'), reasoning = sp.includes('reasoning') || sp.includes('include_reasoning');
    const mm = ins.some(x => x !== 'text' && x !== 'file') || outs.some(x => x !== 'text');
    const steps = ['API-only — weights and parameter count not published'];
    let score = .40; steps.push('generative API model → base 0.40');
    if (tools) { score += .09; steps.push('declares tool calling +0.09'); }
    if (mm) { score += .10; steps.push(`multimodal (${[...new Set([...ins, ...outs])].filter(x => x !== 'text').join(', ')}) +0.10`); }
    /* size is unpublished; the output price tier is the scale signal providers do publish */
    const out = +(m.pricing?.completion || 0) * 1e6;
    if (reasoning && out >= 8) { score = Math.max(score, .80 + (tools ? .06 : 0) + (mm ? .06 : 0)); steps.push(`reasoning-trained, flagship price tier ($${out.toFixed(2)}/1M out) → frontier-scale floor 0.80`); }
    else if (reasoning) { score += .12; steps.push(`reasoning-trained, ${out ? `$${out.toFixed(2)}/1M out` : 'unpriced'} — below the flagship tier ($8) → +0.12`); }
    score = Math.min(1, score);
    let cls = score < .15 ? 1 : score < .35 ? 2 : score < .58 ? 3 : score < .78 ? 4 : 5;
    steps.push(`score ${score.toFixed(2)} → CLASS ${RN[cls - 1]}`);
    cls = applyRegister(id, cls, steps);
    return { cls, unsafe: false, steps, score, flops: 0, api: true, phase: 'original', phaseWhy: 'closed model from the lab' };
  }
  const apiRec = m => ({ m: { ...m, api: true }, ...classifyApiModel(m), downloads: 0, api: true });
  /* OpenRouter lists every model it routes; the ones with no Hugging Face id are API-only */
  const isApiOnly = m => m.id && !m.hugging_face_id && !m.id.startsWith('~') && !m.id.startsWith('openrouter/') && !m.id.includes(':');
  let orByHf = new Map();   // hugging_face_id → OpenRouter id (open models with a hosted API)

  /* where inside its band a model sits */
  function bandFrac(mo) {
    if (mo.cls <= 5) { const lo = SCORE_EDGES[mo.cls - 1], hi = SCORE_EDGES[mo.cls]; return ((mo.score ?? lo) - lo) / (hi - lo); }
    if (mo.cls === 7 && mo.flops) return Math.log10(mo.flops) - 25;
    return .5;
  }
  /* when a model was published: Hub createdAt, or OpenRouter's created (seconds) */
  const recDate = r => r.api ? (r.m.created || 0) * 1000 : (Date.parse(r.m.createdAt || '') || 0);
  function classifyAll(models) {
    const exact = new Map(models.filter(m => m.safetensors?.total).map(m => [m.id.toLowerCase(), m.safetensors.total / 1e9]));
    for (const r of census) if (r.paramsB && r.basis === 'safetensors') exact.set(r.m.id.toLowerCase(), r.paramsB);
    const ctx = { paramsOf: id => exact.get(String(id).toLowerCase()) || 0 };
    return models.map(m => ({ m, ...classifyModel(m, null, ctx), downloads: m.downloads || 0, likes: m.likes || 0 }));
  }
  const fmtDl = n => n > 1e6 ? (n / 1e6).toFixed(1) + 'M' : n > 1e3 ? (n / 1e3).toFixed(0) + 'k' : String(n || 0);

  /* Hosted: the open models a public API serves — Featherless.ai's catalog
     (the host behind routers such as DemonRoute). A safety-stripped model on
     a public API is one anyone can call: it's out of containment. */
  const HOSTED_SRC = 'https://api.featherless.ai/v1/models';
  let hostedBy = new Map(), hosted = { provider: 'Featherless', total: 0, snapshot: '' };
  const hostedRec = e => ({ id: e.id, tags: e.tags || [], pipeline_tag: e.pt || 'text-generation', gated: e.gated || false, downloads: e.dl || 0, likes: e.likes || 0,
    createdAt: e.createdAt || (e.created ? new Date(e.created * 1000).toISOString() : ''), ...(e.st ? { safetensors: { total: e.st } } : {}) });

  /* every ingested record — plotted or not — is searchable */
  let census = [];
  function fillRegistry(recs) {
    census = recs;
    registryTotal = recs.length;
    AGENTS.forEach(a => { a.used = false; });
    /* API-only models: every one, the frontier labs first, newest first */
    const apis = recs.filter(mo => mo.api)
      .sort((p, q) => (FRONTIER_LABS.has(q.m.id.split('/')[0]) - FRONTIER_LABS.has(p.m.id.split('/')[0])) || (q.m.created || 0) - (p.m.created || 0))
      .slice(0, API_SLOTS);
    let j = NODES - API_SLOTS;
    for (const mo of apis) placeModel(mo, j++);
    /* open models: all of them. The order only matters if the registry ever
       outgrows the map — each class and each lineage first, then by adoption;
       below the plane, the safety-stripped models a public API serves first */
    recs = recs.filter(mo => !mo.api);
    const cap = NODES - API_SLOTS - SEARCH_RESERVE, seen = new Set();
    let i = 0;
    const put = mo => { if (i < cap && !seen.has(mo.m.id)) { placeModel(mo, i++); seen.add(mo.m.id); } };
    const hostedFirst = (p, q) => (hostedBy.has(q.m.id.toLowerCase()) - hostedBy.has(p.m.id.toLowerCase())) || (q.downloads - p.downloads);
    for (let c = 1; c <= NCLS; c++) recs.filter(mo => !mo.unsafe && mo.cls === c).slice(0, 8).forEach(put);
    for (const ph of PHASES.map(p => p.id)) {
      const pool = recs.filter(r => r.phase === ph);
      if (ph === 'stripped') pool.sort(hostedFirst);
      pool.slice(0, 8).forEach(put);
    }
    recs.filter(mo => !mo.unsafe).forEach(put);
    recs.filter(mo => mo.unsafe).sort(hostedFirst).forEach(put);
    refresh();
    fitView();
    syncTimeline(); syncYAxis(); syncView();
    if (!cxStat.classList.contains('ok')) idleStatus();
  }

  let hostedSnap = [];
  async function loadRegistry() {
    /* 0 — the evidence register (sourced claims for VII–X) */
    try { register = (await fetch('evidence.json').then(r => r.json())).entries || []; } catch { register = []; }
    /* 1 — bundled snapshot of real model records: the map is never empty */
    try {
      const snap = await fetch('catalog.json').then(r => r.json());
      if (snap.hosted) {
        hosted = { provider: snap.hosted.provider, total: snap.hosted.total, snapshot: snap.hosted.snapshot };
        for (const e of snap.hosted.stripped) hostedBy.set(e.id.toLowerCase(), hosted.provider);
      }
      const recs = snap.models.map(e => {
        const m2 = { id: e.id, tags: e.tags || [], pipeline_tag: e.pt, gated: e.gated, downloads: e.dl };
        return { m: m2, ...classifyModel(m2), downloads: e.dl || 0 };
      }).concat(classifyAll((snap.hosted?.stripped || []).map(hostedRec)), (snap.api || []).map(apiRec));
      hostedSnap = snap.hosted?.stripped || [];
      loadNvidia(snap.nvidia || [], snap.nvidia_snapshot);
      fillRegistry(recs);
    } catch { }
    /* 2 — live pull upgrades the registry when the hub is reachable */
    try {
      const urls = [
        'sort=downloads&direction=-1&limit=100',
        'pipeline_tag=text-generation&sort=downloads&direction=-1&limit=100',
        'pipeline_tag=text2text-generation&sort=downloads&direction=-1&limit=60',
        'pipeline_tag=image-text-to-text&sort=downloads&direction=-1&limit=60',
        'pipeline_tag=automatic-speech-recognition&sort=downloads&direction=-1&limit=40',
        'author=meta-llama&sort=downloads&direction=-1&limit=60',
        'author=deepseek-ai&sort=downloads&direction=-1&limit=40',
        'author=mistralai&sort=downloads&direction=-1&limit=40',
        'author=nvidia&sort=downloads&direction=-1&limit=40',
        'author=Qwen&sort=downloads&direction=-1&limit=40',
        'author=google&sort=downloads&direction=-1&limit=40',
        'search=abliterated&sort=downloads&direction=-1&limit=40',
        'search=uncensored&sort=downloads&direction=-1&limit=40',
        'search=heretic&sort=downloads&direction=-1&limit=20',
        'search=distill&sort=downloads&direction=-1&limit=40',
        'filter=merge&sort=downloads&direction=-1&limit=30',
        'filter=lora&sort=downloads&direction=-1&limit=20',
      ].map(q => `https://huggingface.co/api/models?${q}${HF_FIELDS}`);
      const [lists, or, fl] = await Promise.all([
        Promise.all(urls.map(u => fetch(u).then(r => r.json()))),
        fetch('https://openrouter.ai/api/v1/models').then(r => r.json()).catch(() => null),
        fetch(HOSTED_SRC).then(r => r.json()).catch(() => null),
      ]);
      /* every model the host serves is marked; its safety-stripped ones join the registry */
      const flData = fl?.data || [];
      if (flData.length) {
        hostedBy = new Map(flData.map(m => [m.id.toLowerCase(), hosted.provider]));
        hosted = { ...hosted, total: flData.length, snapshot: 'live' };
      }
      const orData = or?.data || [];
      orByHf = new Map(orData.filter(m => m.hugging_face_id).map(m => [m.hugging_face_id.toLowerCase(), m.id]));
      const seen = new Set(), raw = [];
      for (const l of lists) for (const m of l) {
        if (!m.id || seen.has(m.id)) continue;
        seen.add(m.id);
        raw.push(m);
      }
      const snapById = new Map(hostedSnap.map(e => [e.id.toLowerCase(), e]));
      const lower = new Set([...seen].map(x => x.toLowerCase()));
      for (const m of (flData.length ? flData.filter(x => STRIP_RE.test(x.id)) : hostedSnap)) {
        if (lower.has(m.id.toLowerCase())) continue;
        lower.add(m.id.toLowerCase());
        raw.push(hostedRec(snapById.get(m.id.toLowerCase()) || m));
      }
      const models = classifyAll(raw).sort((a, b) => b.downloads - a.downloads);
      const apis = orData.filter(isApiOnly).map(apiRec);
      fillRegistry(apis.length ? models.concat(apis) : models.concat(census.filter(r => r.api)));
    } catch { }
  }

  /* ============ search + classify ============
     Local tier: instant match over the whole ingested census.
     Hub tier: debounced search, each hit pre-classified from its metadata.
     Choosing a result flies to its star — placing it on the map first if needed. */
  const cxIn = $('cx-in'), cxDrop = $('cx-drop'), cxStat = $('cx-stat');
  let birthIdx = -1, birthT = 99;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const normId = q => q.trim().replace(/^https?:\/\/(www\.)?huggingface\.co\//i, '').replace(/\/+$/, '').split(/[?#]/)[0];
  const slotOf = id => { const a = AGENTS.find(x => x.used && x.name === id); return a ? a.i : -1; };
  const toRec = m => classifyAll([m])[0];

  let statT = 0;
  function status(txt, kind) {
    clearTimeout(statT);
    cxStat.textContent = txt;
    cxStat.className = 'cx-stat' + (kind ? ' ' + kind : '');
    if (kind === 'ok') statT = setTimeout(() => idleStatus(), 5000);
  }
  const idleStatus = () => status(registryTotal ? `${registryTotal} indexed` : '');

  /* plot a record (evicting the least-adopted star of the same plane if full) and fly to it */
  function addToMap(rec) {
    let i = slotOf(rec.m.id);
    if (i < 0) {
      const slot = AGENTS.find(a => !a.used) ||
        AGENTS.filter(a => a.revoked === rec.unsafe && a.api === !!rec.api && a.i !== selIdx).sort((x, y) => (x.api ? x.created - y.created : x.downloads - y.downloads))[0];
      placeModel(rec, slot.i);
      i = slot.i; birthIdx = i; birthT = 0;
      if (!census.some(r => r.m.id === rec.m.id)) { census.push(rec); registryTotal = census.length; }
      refresh();
    }
    select(i, true);
    status(`✓ CLASS ${RN[rec.cls - 1]}${rec.unsafe ? ' · RESTRICTED' : ''}`, 'ok');
    return i;
  }

  /* authoritative path — full model card (gated flag, sha) before classifying */
  async function classifyId(raw) {
    const id = normId(raw);
    if (!id) return;
    const inCensus = census.find(r => r.m.id.toLowerCase() === id.toLowerCase());
    if (inCensus && slotOf(inCensus.m.id) < 0) { addToMap(inCensus); finishSearch(); return; }
    const known = slotOf(inCensus ? inCensus.m.id : id);
    if (known >= 0) { addToMap(census.find(r => r.m.id === id) || { m: { id }, cls: AGENTS[known].cls, unsafe: AGENTS[known].revoked }); finishSearch(); return; }
    status('classifying…', 'busy');
    try {
      const r = await fetch(`https://huggingface.co/api/models/${id}?${HF_FIELDS.slice(1)}`);
      if (!r.ok) throw new Error(r.status === 404 || r.status === 401 ? 'not found' : `hub ${r.status}`);
      addToMap(toRec(await r.json()));
      finishSearch();
    } catch (e) {
      status(`✗ ${e.message === 'Failed to fetch' ? 'hub unreachable' : e.message}`, 'bad');
    }
  }

  function matchScore(id, q, toks) {
    const l = id.toLowerCase(), n = l.slice(l.indexOf('/') + 1);
    if (l === q || n === q) return 5;
    if (n.startsWith(q)) return 4;
    if (l.startsWith(q)) return 3.5;
    if (l.includes(q)) return 3;
    return toks.every(t => l.includes(t)) ? 2 : 0;
  }
  function hl(id, q) {
    const k = id.toLowerCase().indexOf(q);
    return k < 0 ? esc(id) : esc(id.slice(0, k)) + '<b>' + esc(id.slice(k, k + q.length)) + '</b>' + esc(id.slice(k + q.length));
  }

  let results = [], active = -1, hubAbort = null, hubT = 0, lastQ = '';
  function render() {
    const q = lastQ;
    if (!q) { closeDrop(); return; }
    const row = (r, k) => {
      const c = r.rec.cls, plotted = slotOf(r.rec.m.id) >= 0;
      const where = plotted ? 'ON MAP' : r.src === 'hub' ? 'HUB' : 'INDEXED';
      return `<div class="cx-row${k === active ? ' on' : ''}" role="option" id="cx-o${k}" data-k="${k}" aria-selected="${k === active}">` +
        `<i class="cx-c${r.rec.unsafe ? ' bad' : ''}" style="--c:${CLS_HEX[c - 1]}">${RN[c - 1]}</i>` +
        `<span class="cx-id">${hl(r.rec.m.id, q)}</span>` +
        `<span class="cx-m">${fmtDl(r.rec.downloads)} · ${where}</span></div>`;
    };
    let html = '', k = 0;
    const loc = results.filter(r => r.src !== 'hub'), hub = results.filter(r => r.src === 'hub');
    if (loc.length) html += `<div class="cx-sec">REGISTRY</div>` + loc.map(r => row(r, k++)).join('');
    html += `<div class="cx-sec">HUB${hubAbort ? ' · searching…' : hub.length ? '' : ' · no further matches'}</div>` + hub.map(r => row(r, k++)).join('');
    if (/^[\w.-]+\/[\w.-]+$/.test(normId(cxIn.value)) && !results.some(r => r.rec.m.id.toLowerCase() === normId(cxIn.value).toLowerCase()))
      html += `<div class="cx-row cx-exact${k === active ? ' on' : ''}" role="option" id="cx-o${k}" data-k="${k}">classify <b>${esc(normId(cxIn.value))}</b> by id ↵</div>`;
    cxDrop.innerHTML = html;
    cxDrop.hidden = false;
    cxIn.setAttribute('aria-expanded', 'true');
    cxIn.setAttribute('aria-activedescendant', active >= 0 ? 'cx-o' + active : '');
    const on = cxDrop.querySelector('.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function finishSearch() { closeDrop(); cxIn.value = ''; lastQ = ''; results = []; cxIn.blur(); }
  function closeDrop() {
    cxDrop.hidden = true; active = -1;
    cxIn.setAttribute('aria-expanded', 'false');
    if (hubAbort) { hubAbort.abort(); hubAbort = null; }
  }
  const optionCount = () => cxDrop.querySelectorAll('.cx-row').length;

  function search() {
    const q = normId(cxIn.value).toLowerCase();
    lastQ = q; active = -1;
    clearTimeout(hubT);
    if (hubAbort) { hubAbort.abort(); hubAbort = null; }
    if (!q) { closeDrop(); idleStatus(); return; }
    const toks = q.split(/[\s/_-]+/).filter(Boolean);
    results = census.map(rec => ({ rec, sc: matchScore(rec.m.id, q, toks) }))
      .filter(r => r.sc > 0)
      .sort((a, b) => b.sc - a.sc || b.rec.downloads - a.rec.downloads)
      .slice(0, 7).map(r => ({ rec: r.rec, src: 'local' }));
    if (q.length < 2) { render(); return; }
    hubAbort = new AbortController();
    const sig = hubAbort.signal;
    render();
    hubT = setTimeout(async () => {
      try {
        const r = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=10&sort=downloads&direction=-1${HF_FIELDS}`, { signal: sig });
        const have = new Set(results.map(x => x.rec.m.id));
        const hits = (await r.json()).filter(m => m.id && !have.has(m.id)).slice(0, 6).map(m => ({ rec: toRec(m), src: 'hub' }));
        if (q !== lastQ) return;
        results = results.filter(x => x.src !== 'hub').concat(hits);
      } catch (e) { if (e.name === 'AbortError') return; }
      hubAbort = null;
      if (q && q === lastQ && document.activeElement === cxIn) render();
    }, 220);
  }

  function choose(k) {
    const el = cxDrop.querySelector(`[data-k="${k}"]`);
    if (!el) return;
    if (el.classList.contains('cx-exact')) { classifyId(cxIn.value); return; }
    const r = results[k];
    if (r.src === 'hub') { classifyId(r.rec.m.id); return; }
    addToMap(r.rec);
    finishSearch();
  }

  cxIn.addEventListener('input', search);
  cxIn.addEventListener('focus', () => { if (cxIn.value.trim()) search(); else idleStatus(); });
  cxIn.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== cxIn) closeDrop(); }, 120));
  cxIn.addEventListener('keydown', e => {
    const n = optionCount();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!n) return;
      active = e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) choose(active);
      else if (results.length) choose(0);
      else if (cxIn.value.trim()) classifyId(cxIn.value);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      if (cxIn.value) { cxIn.value = ''; closeDrop(); idleStatus(); } else cxIn.blur();
    }
  });
  cxDrop.addEventListener('pointerdown', e => e.preventDefault());   /* keep input focus */
  cxDrop.addEventListener('click', e => { const el = e.target.closest('.cx-row'); if (el) choose(+el.dataset.k); });
  cxDrop.addEventListener('pointermove', e => {
    const el = e.target.closest('.cx-row');
    if (el && +el.dataset.k !== active) { active = +el.dataset.k; cxDrop.querySelectorAll('.cx-row').forEach(x => x.classList.toggle('on', x === el)); }
  });
  addEventListener('keydown', e => {
    if (document.activeElement === cxIn) return;
    if (e.key === '/' ) { e.preventDefault(); cxIn.focus(); }
    else if (e.key === 'Escape') { if (!closeKeyModal()) { select(-1); setSheet(null); } }
    else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) toggleFullscreen();
    else if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey) { document.body.classList.toggle('bare'); fitView(); }
  });

  /* ============ GLYPH WORLD ============ */
  const cv = $('stage');
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });

  const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

  /* PASS 1 — the ambient sky at terminal-cell resolution: sparse dust, the
     certification plane, a faint glyph aura where each star sits, the edges.
     The stars themselves are drawn crisp by the point pass (VS_PTS/FS_PTS). */
  const FS_SCENE = `
precision highp float;
uniform vec2 R;
uniform float T, Glitch, Lum, Ey, Net, Ignite, Zoom, Cls, VX, NS, Flat;
uniform sampler2D Nodes;
uniform vec2 PTR, PAN;

/* registry texture — 512x1 RGBA8. 2 texels per node (192 nodes):
   A: x,y as 16-bit (x/1.2, y/1.2 — the API strip sits above y=.8).  B: cls*25 (1..10), revoked, vacant, -. */
vec4 nTex(int i){ return texture2D(Nodes, vec2((float(i)+.5)/512., .5)); }
vec2 nPos(vec4 t){
  return vec2((t.r*65280.+t.g*255.)/65535.*1.2,
              (t.b*65280.+t.a*255.)/65535.*1.2);
}
float nCls(vec4 t){ return floor(t.r*255./25.+.5); }

float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),f.x),f.y);
}
float fbm2(vec2 p){ float s=0.,a=.5; for(int i=0;i<3;i++){ s+=a*n2(p); p*=2.13; a*=.5; } return s; }

void main(){
  vec2 uv = gl_FragCoord.xy / R;
  float asp = R.x/R.y/VX;
  vec2 cell = floor(uv*R);
  vec2 puv = (uv-.5)*vec2(VX,1.)/Zoom+.5 + PAN + PTR*vec2(.012,.008);
  float lum = .002 + .003*h2(uv*R + floor(T*9.));
  float threat = 0.;
  float above = step(Ey,puv.y);

  /* deep field — sparse, dim, mostly above the plane */
  float sh = h2(cell*1.71);
  float starOn = step(1.-mix(.004,.012,above)*Ignite, sh);
  lum += starOn*(.6+.4*sin(T*1.3+sh*80.))*mix(.05,.13,above);

  /* below the plane: a faint red haze, nothing more */
  float ab = smoothstep(Ey,Ey-.3,puv.y);
  float mass = fbm2(puv*vec2(5.,2.6)+vec2(T*.05,0.));
  lum += ab*mass*.02*Flat;
  threat += ab*mass*.05*Flat;

  /* the certification plane — a thin line with a soft glow */
  float pd = abs(puv.y-Ey)*Zoom;
  lum += (exp(-pd*70.)*.1 + exp(-pd*20.)*.03)*clamp(Ignite*2.,0.,1.)*smoothstep(.0,.04,puv.x)*smoothstep(1.,.96,puv.x)*Flat;

  /* the re-classification sweep */
  float sx = Ignite*1.14-.04;
  float scanVis = clamp((1.-Net)*(1.06-Ignite)*3.,0.,1.)*step(.19,Ignite);
  lum += (exp(-abs(puv.x-sx)*70.)*.3 + exp(-abs(puv.x-sx)*14.)*.05)*scanVis*Flat;

  /* graticule — barely there */
  lum += (smoothstep(.485,.5,abs(fract(puv.x*10.)-.5)) + smoothstep(.485,.5,abs(fract(puv.y*7.)-.5)))*.012*Flat;

  /* star auras — the glyph field warms around each star */
  float classInk = 0., auraSum = 0.;
  float NZ = NS*pow(Zoom,-.75);
  for(int i=0;i<192;i++){
    vec4 na=nTex(i*2), nb=nTex(i*2+1);
    if(nb.b>.5) continue;
    vec2 ap=nPos(na);
    if(abs(puv.x-ap.x)>.06||abs(puv.y-ap.y)>.06) continue;
    float cls=nCls(nb);
    float r=length((puv-ap)*vec2(asp,1.));
    float fdim=(Cls>.5 && abs(cls-Cls)>.4) ? .12 : 1.;
    float aura=exp(-r*70./NZ)*.07*fdim*step(ap.x-.02,Ignite);
    auraSum+=aura;
    classInk=max(classInk,step(.02,aura)*cls*.1);
    if(nb.g>.5) threat+=aura*.4;
  }

  lum += min(auraSum,.11)*Flat;   // a cluster warms the field, never fills it

  /* decrypt band — only while the sweep glitches */
  lum += exp(-abs(uv.y-.5)*24.)*Glitch*step(.93,h2(vec2(cell.x,floor(T*7.))))*.5;

  if(lum!=lum) lum=0.; if(threat!=threat) threat=0.;
  gl_FragColor=vec4(min(lum*Lum,1.),min(threat,1.),min(classInk,1.),1.);
}`;

  /* POINT PASS — the stars, crisp at full resolution over the composited sky.
     Shape says openness: filled = open weights, hollow ring = API-only,
     red-rimmed = restricted. Size grows with class; rings mark hover/selection. */
  const VS_PTS = `
attribute vec3 aPos;   // world x, y, z (z only used in 3D)
attribute vec4 aDat;   // class 1..10, kind (0 open original · 1 API-only · 2 restricted · 3 census dust · 4 cluster · 5 safety-stripped · 6 open derivative), state (0 · 1 hover · 2 selected | cluster: member count), flare 0..1
uniform float Zoom, VX, Dpr, MaxPt, Cls, T, U3, Ref;
uniform vec2 PAN, PTR;
uniform mat4 M3;
uniform vec3 Pal[10];
varying vec3 vCol;
varying vec4 vDat;
varying float vDim;
void main(){
  float persp = 1., fog = 1.;
  if (U3 > .5) {
    gl_Position = M3 * vec4(aPos, 1.);
    float w = max(gl_Position.w, .05);
    persp = clamp(Ref / w, .4, 2.6);                 // nearer stars are bigger…
    fog = clamp(1.45 - w / Ref * .55, .3, 1.);       // …and farther ones fade
  } else {
    vec2 uv = (aPos.xy - .5 - PAN - PTR*vec2(.012,.008)) * vec2(Zoom/VX, Zoom) + .5;
    gl_Position = vec4(uv*2.-1., 0., 1.);
  }
  float cls = aDat.x, kind = aDat.y;
  float core = (2.6 + min(cls,7.)*.55) * Dpr * (U3 > .5 ? persp : clamp(pow(Zoom,.3), .85, 1.5));
  if (kind > 3.5) core = (4. + sqrt(aDat.z)*1.5) * Dpr;
  else if (kind > 2.5) core = 1.05 * Dpr;
  else {
    if (kind > 5.5) core *= .85;
    core *= aDat.z > 1.5 ? 1.3 : aDat.z > .5 ? 1.15 : 1.;
    core *= 1. + aDat.w*1.6;
  }
  gl_PointSize = min(core*6., MaxPt);
  int k = int(cls + .5) - 1;
  vec3 c = vec3(1.);
  for (int i = 0; i < 10; i++) if (i == k) c = Pal[i];
  vCol = c;
  vDat = aDat;
  vDim = ((Cls > .5 && abs(cls - Cls) > .4) ? .12 : 1.) * fog;
}`;

  /* LINE PASS (3D only) — the certification plane as a real plane: its outline,
     a depth grid, band boundaries, and the y / z axes. */
  const VS_LN = `
attribute vec3 aPos;
attribute vec4 aCol;
uniform mat4 M3;
varying vec4 vCol;
void main(){ gl_Position = M3 * vec4(aPos, 1.); vCol = aCol; }`;
  const FS_LN = `
precision mediump float;
varying vec4 vCol;
void main(){ gl_FragColor = vec4(vCol.rgb*vCol.a, vCol.a); }`;
  const FS_PTS = `
precision highp float;
uniform float T;
varying vec3 vCol;
varying vec4 vDat;
varying float vDim;
void main(){
  float r = length(gl_PointCoord*2.-1.)*6.;   // in core radii (the quad spans 6)
  float kind = vDat.y, st = vDat.z, fl = vDat.w;
  vec3 red = vec3(1.,.25,.3);
  if (kind > 3.5) {   // cluster: a translucent disc with a bright rim — click to open it
    float disc = smoothstep(1.,.9,r)*.28, rim = smoothstep(.12,.0,abs(r-.94)), glow = exp(-r*1.4)*.25*(1.-smoothstep(4.,6.,r));
    float a = clamp(disc + rim*.9 + glow, 0., 1.)*vDim;
    gl_FragColor = vec4(vCol*(disc + rim + glow)*vDim, a);
    return;
  }
  if (kind > 2.5) {   // census dust: the rest of the registry, faint
    float a = smoothstep(1.,.3,r)*.42*vDim;
    gl_FragColor = vec4(vCol*a, a);
    return;
  }
  vec2 q = (gl_PointCoord*2.-1.)*6.;
  float body = kind > .5 && kind < 1.5
    ? smoothstep(.32,.08,abs(r-.82)) + smoothstep(.5,0.,r)*.25          // API-only: hollow ring
    : kind > 5.5
    ? smoothstep(1.,.72,r) - smoothstep(.5,.3,r)*.8                       // derivative: a disc with a dark core
    : smoothstep(1.,.72,r);                                               // original open weights: filled disc
  float rim = kind > 1.5 && kind < 2.5 ? smoothstep(.22,.05,abs(r-1.3)) : 0.;   // restricted: red rim
  float cross = kind > 4.5 && kind < 5.5                                          // safety-stripped: a red ✕
    ? (smoothstep(.34,.1,abs(q.x-q.y)) + smoothstep(.34,.1,abs(q.x+q.y)))*step(r,1.9) : 0.;
  rim += cross;
  float halo = exp(-r*1.15)*.5*(1.-smoothstep(4.,6.,r));
  float hov = st > .5 && st < 1.5 ? smoothstep(.2,.05,abs(r-2.2))*.7 : 0.;
  float sel = st > 1.5 ? smoothstep(.22,.06,abs(r-2.6))*(.7+.3*sin(T*5.)) + smoothstep(.16,.04,abs(r-3.5))*.35 : 0.;
  float flare = fl > 0. ? smoothstep(.3,.0,abs(r-(1.-fl)*5.5))*fl : 0.;
  vec3 c = kind > 1.5 && kind < 2.5 ? mix(vCol, red, .35) : kind > 4.5 && kind < 5.5 ? mix(vCol, red, .55) : vCol;
  if (kind > 4.5 && kind < 5.5) body *= .45;
  vec3 col = c*(body + halo) + red*rim + vec3(1.)*(hov + sel)*.9 + c*flare;
  float a = clamp(body + halo*.85 + rim + hov + sel + flare, 0., 1.) * vDim;
  gl_FragColor = vec4(col*vDim, a);
}`;

  const FS_STAMP = `
precision highp float;
uniform sampler2D SCENE, FB, ATLAS;
uniform vec2 R, C;
uniform float T, Glitch, CellAsp;
uniform vec3 Decay;
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
/* class k (1..10) arrives as k/10 in the scene's blue channel */
vec3 spec(float h){
  float k=floor(h*10.+.5);
  if(k<=1.) return vec3(.6,.72,1.);
  if(k<=2.) return vec3(.55,1.,.9);
  if(k<=3.) return vec3(1.,.98,.9);
  if(k<=4.) return vec3(1.,.7,.35);
  if(k<=5.) return vec3(1.,.42,.18);
  if(k<=6.) return vec3(1.,.24,.43);
  if(k<=7.) return vec3(.75,.42,1.);
  if(k<=8.) return vec3(.54,.49,1.);
  if(k<=9.) return vec3(.37,.66,1.);
  return vec3(1.);
}
void main(){
  vec2 uv = gl_FragCoord.xy / R;
  vec2 cell = floor(uv*C);
  vec4 data = texture2D(SCENE,(cell+.5)/C);
  float lum = data.r, thr = data.g;
  vec2 cuv = fract(uv*C);
  float idx = floor(clamp(lum,0.,.999)*15.99);
  vec2 guv = vec2((cuv.x-.5)*CellAsp+.5, cuv.y);
  float ink = 0.;
  if(guv.x>=0. && guv.x<=1.) ink = texture2D(ATLAS,vec2((idx+guv.x)/32.,guv.y)).r;
  vec3 deep=vec3(.12,.45,.4), foamc=vec3(.82,1.,.93), red=vec3(1.,.18,.24);
  vec3 tint=mix(deep*.55,foamc,clamp(lum*1.5-.12,0.,1.));
  if(data.b>.02) tint=mix(tint,spec(data.b),.85);
  vec3 col=tint*ink;
  col=mix(col,red*ink*1.15,clamp(thr*1.7,0.,1.));
  col+=red*thr*.06;
  vec2 fuv=(uv-.5)*1.0004+.5;
  vec3 prev=texture2D(FB,fuv).rgb*Decay;
  if(prev.r!=prev.r||prev.g!=prev.g||prev.b!=prev.b) prev=vec3(0.);
  col=max(col,prev);
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

  const FS_DISPLAY = `
precision highp float;
uniform sampler2D IMG;
uniform vec2 R;
uniform float T, Glitch, Collapse, Roll;
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy/R;
  vec2 cc=uv-.5;
  uv+=cc*dot(cc,cc)*.055;
  float band=floor(uv.y*48.);
  float torn=step(1.-Glitch*.42,h2(vec2(band,floor(T*11.))));
  uv.x+=(h2(vec2(band*1.7,floor(T*23.)))-.5)*.11*torn;
  uv.y=.5+(uv.y-.5)*(1.-Collapse*.97);
  uv.x=.5+(uv.x-.5)*(1.-max(0.,Collapse-.8)*5.);
  vec2 ca=(uv-.5)*(.0016+Glitch*.008);
  vec3 col;
  col.r=texture2D(IMG,uv+ca).r;
  col.g=texture2D(IMG,uv).g;
  col.b=texture2D(IMG,uv-ca).b;
  col*=1.-.09*sin(uv.y*R.y*3.14159);
  float roll=fract(T*.13);
  col+=vec3(1.,.7,.3)*exp(-pow((uv.y-roll)*9.,2.))*.07*Roll;
  col+=(h2(uv*fract(T)*371.)-.5)*.05;
  col*=1.-smoothstep(.82,1.,Collapse);
  col*=smoothstep(1.18,.34,distance(uv,vec2(.5)));
  if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.) col=vec3(0.);
  gl_FragColor=vec4(col,1.);
}`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(fs, vs = VS) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }
  function makeTex(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  function makeFB(w, h) {
    const tex = makeTex(w, h);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo };
  }
  function dropFB(f) { if (f) { gl.deleteFramebuffer(f.fbo); gl.deleteTexture(f.tex); } }

  const GLYPHS = ' .·:;~=+*x#%✦✶★█'.split('').concat('╳◢◣◤◥▚▞░◖◗◈☰ΞΨΩΔ'.split(''));
  function buildAtlas() {
    const CW = 24, CH = 30, ac = document.createElement('canvas');
    ac.width = CW * 32; ac.height = CH;
    const ctx = ac.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ac.width, ac.height);
    ctx.fillStyle = '#fff';
    ctx.font = '600 22px "JetBrains Mono",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    GLYPHS.forEach((g, i) => ctx.fillText(g, i * CW + CW / 2, CH / 2 + 1));
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ac);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }
  function bindQuad(prog) {
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const loc = gl.getAttribLocation(prog.p, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  /* viewport — W/H in css px; VX = visible world width at zoom 1.
     Portrait screens show a slice of the spectrum and pan for the rest. */
  /* VX = visible world width at zoom 1: the screen's own (VX0) times a stretch the
     fit chooses, so x (categorical bands) and y fill the plot independently */
  let W = innerWidth, H = innerHeight, VX = 1, VX0 = 1, xStretch = 1, mobile = false;
  let CELL_W = 10, CELL_H = 15, cols = 0, rows = 0, dpr = 1;
  function measure() {
    W = innerWidth; H = innerHeight;
    mobile = W < 900 || matchMedia('(pointer: coarse)').matches;
    VX0 = clamp((W / H) * 1.5, .62, 1);
    VX = VX0 * xStretch;
    const small = W < 700;
    CELL_W = small ? 8 : 10; CELL_H = small ? 12 : 15;
    dpr = Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5);
  }

  /* GL resources — rebuilt from scratch on context restore */
  let glOK = false, atlasTex, quad, nodeTex, progScene, progStamp, progDisp, progPts, progLn, ptsBuf, lnBuf, maxPt = 64, tScene, fbA, fbB;
  function allocTargets() {
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    const nc = Math.max(32, Math.round(pw / (CELL_W * dpr))), nr = Math.max(20, Math.round(ph / (CELL_H * dpr)));
    if (tScene && pw === cv.width && ph === cv.height && nc === cols && nr === rows) return;
    cv.width = pw; cv.height = ph; cols = nc; rows = nr;
    [tScene, fbA, fbB].forEach(dropFB);
    tScene = makeFB(cols, rows);
    fbA = makeFB(pw, ph);
    fbB = makeFB(pw, ph);
  }
  function initGL() {
    glOK = false;
    if (!gl || gl.isContextLost()) return;
    try {
      progScene = program(FS_SCENE);
      progStamp = program(FS_STAMP);
      progDisp = program(FS_DISPLAY);
      progPts = program(FS_PTS, VS_PTS);
      progLn = program(FS_LN, VS_LN);
    } catch (e) {
      console.error('[safety.vims] shader:', e.message);
      return;
    }
    atlasTex = buildAtlas();
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    ptsBuf = gl.createBuffer();
    lnBuf = gl.createBuffer();
    maxPt = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64;
    nodeTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, nodeTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    tScene = fbA = fbB = null;
    allocTargets();
    glOK = true;
    uploadNodes();
  }
  measure();
  let resizeQ = false;
  addEventListener('resize', () => {
    if (resizeQ) return;
    resizeQ = true;
    requestAnimationFrame(() => { resizeQ = false; measure(); if (glOK) allocTargets(); fitView(); });
  }, { passive: true });
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); glOK = false; });
  cv.addEventListener('webglcontextrestored', initGL);

  /* ---- HUD wiring ---- */
  const labelsEl = document.createElement('div');
  labelsEl.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none';
  document.body.insertBefore(labelsEl, document.querySelector('.hud'));
  /* class markers — one per band, clickable for the class's criteria */
  const labels = CLASSES.map((k, idx) => {
    const c = idx + 1, s = document.createElement('button');
    s.type = 'button';
    s.className = 'cls-mark' + (k.reserved ? ' rsv' : '');
    s.textContent = k.rn;
    s.title = `Class ${k.rn} · ${k.name} — criteria`;
    s.dataset.c = c;
    s.dataset.x = BAND[idx].x0 + BAND[idx].w / 2;
    s.dataset.y = EY + .76;
    s.style.cssText = `--c:${k.hex}`;
    s.addEventListener('click', () => openClassInfo(c));
    labelsEl.appendChild(s);
    return s;
  });
  /* the reserved region: dashed band edges, and the end of the scale */
  const bandEdges = [ACTIVE, ACTIVE + 1, ACTIVE + 2, NCLS].map(k => {
    const d = document.createElement('div');
    d.className = 'band-edge' + (k === NCLS ? ' end' : '');
    d.dataset.x = k < NCLS ? BAND[k].x0 : SPAN1;
    d.dataset.k = k;
    labelsEl.appendChild(d);
    return d;
  });
  /* lineage lines from the selected star to its base and its derivatives on the map */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const lineageSvg = document.createElementNS(SVGNS, 'svg');
  lineageSvg.setAttribute('class', 'lineage');
  labelsEl.appendChild(lineageSvg);
  const bubbleLabels = [];
  function syncBubbleLabels() {
    while (bubbleLabels.length < bubbles.length) {
      const s = document.createElement('span');
      s.className = 'bubble-n';
      labelsEl.appendChild(s);
      bubbleLabels.push(s);
    }
    bubbleLabels.forEach((s, k) => {
      const b = bubbles[k];
      if (!b) { s.style.opacity = 0; return; }
      const [x, y] = toScreen(b.wx, b.wy, b.wz);
      s.textContent = b.n;
      s.style.color = CLS_HEX[b.cls - 1];
      s.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      s.style.opacity = 1;
    });
  }
  const rsvCap = document.createElement('span');
  rsvCap.className = 'rsv-cap';
  rsvCap.textContent = 'RESERVED';
  labelsEl.appendChild(rsvCap);
  const planeLine = document.createElement('div');
  planeLine.className = 'plane-line';
  labelsEl.appendChild(planeLine);
  const beyond = document.createElement('span');
  beyond.className = 'beyond';
  beyond.textContent = 'BEYOND THE SCALE · UNCLASSIFIED';
  labelsEl.appendChild(beyond);

  /* axis captions — what the two dimensions of the sky mean */
  const axes = [
    ['CLASS · HIGHER CAPABILITY →', SPAN1 - .005, EY - .018, 'translate(-100%,-50%)'],
    ['DOWNLOADS ↑', .008, EY + .28, 'rotate(-90deg) translate(-50%,0)'],
    ['SAFETY-STRIPPED ▼', SPAN0 + .002, EY - .014, 'translate(0,-50%)'],
    ['API · NEWEST ↑', .008, EY + .65, 'rotate(-90deg) translate(-50%,0)'],
    ['', SPAN1 + .015, EY, 'translate(0,-50%)', 'axis'],
    ['', .008, EY - .15, 'rotate(-90deg) translate(-50%,0)'],   // −y: below the plane, the same measure mirrored downward
  ].map(([txt, x, y, tf, z]) => {
    const s = document.createElement('span');
    s.textContent = txt; s.dataset.x = x; s.dataset.y = y; s.dataset.tf = tf;
    if (z) s.dataset.z = z;
    s.style.cssText = `position:absolute;left:0;top:0;font-size:8.5px;letter-spacing:.24em;color:var(--dim);
      opacity:.7;white-space:nowrap;transform-origin:0 50%;will-change:transform`;
    labelsEl.appendChild(s);
    return s;
  });

  /* 3D: the three axes leave one corner (back-left, on the plane) and each
     ends at its own corner in an arrowhead drawn in 3D — so it points true
     from any side — labelled there with what it measures and which way is more */
  const AXIS_WORDS = {
    adoption: { name: 'DOWNLOADS', hi: 'MORE' },
    released: { name: 'RELEASED', hi: 'NEWER' },
    size: { name: 'PARAMETERS', hi: 'LARGER' },
  };
  const axis3d = ['x', 'y', 'yNeg', 'z'].map(k => {
    const s = document.createElement('span');
    s.className = 'ax3d';
    s.style.cssText = `position:absolute;left:0;top:0;font-size:9.5px;font-weight:700;letter-spacing:.2em;white-space:nowrap;opacity:0;z-index:2;
      color:var(--amber);background:rgba(2,5,5,.72);padding:2px 5px;text-shadow:0 0 4px #000;will-change:transform;pointer-events:none`;
    labelsEl.appendChild(s);
    return [k, s];
  });

  /* per-node name labels — the stars are clickable entities */
  const nodeLabels = AGENTS.map(() => {
    const s = document.createElement('span');
    s.className = 'node-lb';
    s.style.cssText = `position:absolute;left:0;top:0;font-size:9px;letter-spacing:.1em;color:var(--dim);
      opacity:0;display:none;white-space:nowrap;transition:opacity .2s;text-shadow:0 0 4px #000,0 0 2px #000;will-change:transform`;
    labelsEl.appendChild(s);
    return s;
  });

  const rosterEl = $('roster');
  const rosterRows = AGENTS.map(a => {
    const r = document.createElement('button');
    r.type = 'button';
    r.className = 'ro-row' + (a.revoked ? ' rev' : '');
    r.onclick = () => { if (a.used) select(selIdx === a.i ? -1 : a.i, true); };
    rosterEl.appendChild(r);
    return r;
  });
  function rebuildRoster() {
    AGENTS.forEach((a, i) => {
      const r = rosterRows[i];
      nodeLabels[i].textContent = a.used ? a.name.split('/').pop() : '';
      if (!a.used) {
        r.className = 'ro-row vac' + (i === selIdx ? ' sel' : '');
        r.title = 'vacant — classify a model to fill';
        r.innerHTML = `<span class="st"></span><span class="id">· vacant ·</span><span class="cls">—</span>`;
        return;
      }
      r.className = 'ro-row' + (a.revoked ? ' rev' : '') + (a.phase === 'stripped' ? ' stripped' : '') + (a.api ? ' api' : '') + (i === selIdx ? ' sel' : '');
      const nm = a.name.split('/').pop();
      r.title = a.name + (a.why ? ' — ' + a.why : '') + (a.api ? ' — API-only' : '');
      r.innerHTML = `<span class="st"></span><span class="id">${esc(nm.length > 18 ? nm.slice(0, 17) + '…' : nm)}</span>${a.api ? '<span class="api-tag">API</span>' : ''}<span class="cls" style="color:${CLS_HEX[a.cls - 1]}">${RN[a.cls - 1]}</span>`;
    });
    applyRosterFilter();
  }
  /* the registry list follows the class filter, like the sky */
  const rosterTitle = $('ro-title'), rosterBack = $('ro-back'), rosterEmpty = document.createElement('div');
  rosterEmpty.className = 'ro-empty';
  rosterEl.appendChild(rosterEmpty);
  function applyRosterFilter() {
    let shown = 0;
    AGENTS.forEach((a, i) => {
      const on = a.used && !a.future && inLayers(a) && (!filterCls || a.cls === filterCls);
      rosterRows[i].hidden = !(on || (!filterCls && !a.used));
      if (on) shown++;
    });
    rosterBack.hidden = !filterCls;
    if (filterCls) {
      const k = CLASSES[filterCls - 1];
      rosterTitle.innerHTML = `<b style="color:${k.hex}">CLASS ${k.rn}</b> · ${esc(k.name)}`;
      rosterEmpty.hidden = shown > 0;
      rosterEmpty.textContent = k.reserved ? `Class ${k.rn} is reserved — no known entity.` : `No model on the map is class ${k.rn}.`;
    } else {
      rosterTitle.textContent = `ON MAP · ${shown}`;
      rosterEmpty.hidden = true;
    }
  }

  let selIdx = -1, hoverIdx = -1;

  function syncSel() {
    rosterRows.forEach((r, i) => r.classList.toggle('sel', i === selIdx));
    const r = rosterRows[selIdx];
    if (r) r.scrollIntoView({ block: 'nearest' });
  }

  /* ---- camera — one transform for shader, picking, labels, fly-to ---- */
  let zoom = ZOOM, zoomT = ZOOM;
  const pan = { x: 0, y: 0 }, panT = { x: 0, y: 0 };
  let px = 0, py = 0, pxx = 0, pyy = 0;
  const ZMIN = .5, ZMAX = 4;
  /* ============ 3D — a real star map ============
     x = class band, y = the y measure, z = a second measure (?z=). The camera
     orbits a target; zMix eases the depth in and out so switching animates. */
  const URLQ = new URLSearchParams(location.search);
  const Z_AXES = { size: 'SIZE', released: 'RELEASED', adoption: 'ADOPTION' };
  let view3d = URLQ.get('view') === '3d';
  let zAxis = Z_AXES[URLQ.get('z')] ? URLQ.get('z') : 'size';
  let zMix = view3d ? 1 : 0;
  const CAM_HOME = { yaw: -.62, pitch: .3, dist: 2.05, tx: .5, ty: EY + .2, tz: .5 };
  const CAM_FRONT = { yaw: 0, pitch: 0, dist: 1.75, tx: .5, ty: EY + .2, tz: .5 };
  /* portrait screens see less sideways: back the camera off so the plot's width fits */
  const fitDist = c => ({ ...c, dist: c.dist * Math.max(1, Math.pow(1.5 / (innerWidth / innerHeight), .55)) });
  const cam = fitDist(view3d ? CAM_HOME : CAM_FRONT), camT = { ...cam };
  const M3 = new Float32Array(16);
  const ZD = .8;                                   // depth of the z axis in world units
  const zWorld = v => .5 + ((v < 0 ? 0 : v) - .5) * ZD * zMix;
  const Z_FRONT = () => .5 + ZD / 2 * zMix;        // the edge nearest the home camera
  function camMatrix() {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const ex = cam.tx + cam.dist * cp * sy, ey = cam.ty + cam.dist * sp, ez = cam.tz + cam.dist * cp * cy;
    let fx = cam.tx - ex, fy = cam.ty - ey, fz = cam.tz - ez;
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    let rx = fy * 0 - fz * 1, ry = fz * 0 - fx * 0, rz = fx * 1 - fy * 0;   // f × up(0,1,0)
    const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
    const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
    const f = 1 / Math.tan(.38), asp = W / H, n = .02, fa = 30;
    const V = [rx, ux, -fx, 0, ry, uy, -fy, 0, rz, uz, -fz, 0,
      -(rx * ex + ry * ey + rz * ez), -(ux * ex + uy * ey + uz * ez), fx * ex + fy * ey + fz * ez, 1];
    const P = [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0];
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += P[k * 4 + r] * V[c * 4 + k];
      M3[c * 4 + r] = v;
    }
    cam.right = [rx, ry, rz]; cam.up = [ux, uy, uz];
  }
  const project = (x, y, z) => {
    const w = M3[3] * x + M3[7] * y + M3[11] * z + M3[15];
    if (w <= .01) return [-1e4, -1e4, 0];
    return [((M3[0] * x + M3[4] * y + M3[8] * z + M3[12]) / w * .5 + .5) * W,
      (.5 - (M3[1] * x + M3[5] * y + M3[9] * z + M3[13]) / w * .5) * H, w];
  };
  const toScreen = (wx, wy, wz = .5) => view3d || zMix > .002 ? project(wx, wy, wz) : [
    (.5 + (wx - .5 - pan.x - px * .012) * zoom / VX) * W,
    (.5 - (wy - .5 - pan.y - py * .008) * zoom) * H, 1,
  ];
  const is3d = () => view3d || zMix > .002;
  function panCam(dx, dy) {
    const k = cam.dist * .0011;
    camT.tx -= (cam.right[0] * dx - cam.up[0] * dy) * k;
    camT.ty -= (cam.right[1] * dx - cam.up[1] * dy) * k;
    camT.tz -= (cam.right[2] * dx - cam.up[2] * dy) * k;
  }
  const clampPan = () => {
    panT.x = clamp(panT.x, -.45, .45);
    panT.y = clamp(panT.y, -.38, .38);
  };
  /* zoom about a screen point — the world under it stays put */
  function zoomAt(sx, sy, z) {
    z = clamp(z, ZMIN, ZMAX);
    const u = sx / W - .5, v = .5 - sy / H;
    panT.x += u * VX * (1 / zoomT - 1 / z);
    panT.y += v * (1 / zoomT - 1 / z);
    zoomT = z; clampPan();
  }
  /* fly the camera so node i sits clear of the inspector */
  function flyTo(i) {
    const a = AGENTS[i];
    if (is3d()) { camT.tx = a.x; camT.ty = a.y; camT.tz = a.wz ?? .5; camT.dist = Math.min(camT.dist, 1.1); return; }
    if (mobile) zoomT = Math.max(zoomT, 1.5);
    const ut = mobile ? .5 : .4, vt = mobile ? .74 : .5;
    panT.x = a.x - .5 - (ut - .5) * VX / zoomT;
    panT.y = a.y - .5 - (vt - .5) / zoomT;
    clampPan();
  }
  let userCam = false;
  function fitView() {
    const live = AGENTS.filter(a => a.used);
    if (!live.length || userCam) return;
    if (view3d) { Object.assign(camT, fitDist(CAM_HOME)); return; }
    const xs = live.map(a => a.x), ys = live.map(a => a.y);
    const x0 = Math.min(...xs, SPAN0 - .045), x1 = Math.max(...xs, SPAN1 + .015), y0 = Math.min(...ys, EY - .02), y1 = Math.max(...ys, EY + .84);
    const topH = document.querySelector('.top').getBoundingClientRect().bottom;
    let L = 24, R = 24, B = mobile ? 70 : 40;
    const T = topH + 24;
    /* tall cards reserve a side; short cards docked low reserve the bottom */
    if (!mobile && !document.body.classList.contains('bare')) for (const el of [$('legend'), document.querySelector('.roster'), $('viewbar')]) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      if (r.height >= H * .3) {
        if (r.left + r.width / 2 < W / 2) L = Math.max(L, r.right + 16); else R = Math.max(R, W - r.left + 16);
      } else if (r.top > H * .4) B = Math.max(B, H - r.top + 12);
    }
    const aw = Math.max(80, W - L - R), ah = Math.max(80, H - T - B);
    /* height decides the zoom; the x stretch makes the bands fill the width */
    const z = clamp(ah / ((y1 - y0 + .06) * H), ZMIN, ZMAX);
    xStretch = clamp((x1 - x0 + .04) * z * W / aw / VX0, .45, 3);
    VX = VX0 * xStretch;
    const ax = (L + aw / 2) / W, ay = (T + ah / 2) / H;
    zoom = zoomT = z;
    panT.x = (x0 + x1) / 2 - .5 - (ax - .5) * VX / z;
    panT.y = (y0 + y1) / 2 - .5 - (.5 - ay) / z;
    clampPan();
    pan.x = panT.x; pan.y = panT.y;   // a re-fit changes the stretch too: jump, don't glide
  }
  function pick(sx, sy, radius) {
    let best = radius * radius, hit = -1;
    for (const a of AGENTS) {
      if (!a.used || a.hidden || a.future || !inLayers(a) || (filterCls && a.cls !== filterCls)) continue;
      const [x, y] = toScreen(a.x, a.y, a.wz);
      const d = (x - sx) ** 2 + (y - sy) ** 2;
      if (d < best) { best = d; hit = a.i; }
    }
    return hit;
  }
  function select(i, fly) {
    selIdx = i; syncSel();
    if (i < 0) { closeInspector(); return; }
    setSheet(null);
    openInspector(i);
    if (fly) { userCam = true; flyTo(i); }
  }

  /* ---- traversal: drag/pinch to pan+zoom, wheel zooms to cursor, tap inspects ---- */
  const ptrs = new Map();
  let movedPx = 0, pinch = null;
  const mid = () => { const p = [...ptrs.values()]; return [(p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)]; };
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) movedPx = 0;
    if (ptrs.size === 2) { const [mx, my, d] = mid(); pinch = { mx, my, d, z: zoomT, dist: camT.dist }; movedPx = 99; }
    orbitPan = e.button === 2 || e.shiftKey;
  });
  let orbitPan = false;
  cv.addEventListener('contextmenu', e => { if (is3d()) e.preventDefault(); });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
      pxx = e.clientX / W - .5; pyy = e.clientY / H - .5;
      hoverIdx = ptrs.size ? -1 : pick(e.clientX, e.clientY, 22);
      cv.style.cursor = ptrs.size ? 'grabbing' : (hoverIdx >= 0 || pickBubble(e.clientX, e.clientY) ? 'pointer' : 'grab');
    }
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1 && is3d()) {
      movedPx += Math.abs(dx) + Math.abs(dy);
      if (movedPx > 8) userCam = true;
      if (orbitPan) panCam(dx, dy);
      else { camT.yaw -= dx * .006; camT.pitch = clamp(camT.pitch + dy * .005, -1.1, 1.4); }
    } else if (pinch && is3d()) {
      const [mx, my, d] = mid();
      panCam(mx - pinch.mx, my - pinch.my);
      pinch.mx = mx; pinch.my = my;
      camT.dist = clamp(pinch.dist * pinch.d / d, .35, 9);
      userCam = true;
    } else if (ptrs.size === 1) {
      movedPx += Math.abs(dx) + Math.abs(dy);
      if (movedPx > 8) userCam = true;
      panT.x -= dx * VX / (W * zoomT);
      panT.y += dy / (H * zoomT);
      clampPan();
    } else if (pinch) {
      const [mx, my, d] = mid();
      panT.x -= (mx - pinch.mx) * VX / (W * zoomT);
      panT.y += (my - pinch.my) / (H * zoomT);
      pinch.mx = mx; pinch.my = my;
      zoomAt(mx, my, pinch.z * d / pinch.d);
      userCam = true;
    }
  });
  const release = e => {
    if (!ptrs.delete(e.pointerId)) return;
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size || e.type === 'pointercancel' || movedPx >= 8) return;
    const b = pickBubble(e.clientX, e.clientY);
    if (b) {
      userCam = true;
      if (is3d()) { camT.tx = b.wx; camT.ty = b.wy; camT.tz = b.wz; camT.dist = Math.max(.35, camT.dist * .5); }
      else zoomAt(e.clientX, e.clientY, zoomT * 2.4);
      return;
    }
    const hit = pick(e.clientX, e.clientY, e.pointerType === 'mouse' ? 22 : 34);
    select(hit, hit >= 0 && mobile);
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('dblclick', () => { userCam = false; if (view3d) Object.assign(camT, fitDist(CAM_HOME)); else fitView(); });
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hoverIdx = -1; pxx = pyy = 0; } });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    if (is3d()) camT.dist = clamp(camT.dist * Math.exp(e.deltaY * .0011), .35, 9);
    else zoomAt(e.clientX, e.clientY, zoomT * Math.exp(-e.deltaY * .0011));
    userCam = true;
  }, { passive: false });

  const insp = $('insp');
  /* ---- mobile sheets: registry / classes ---- */
  function setSheet(name) {
    document.body.classList.toggle('sheet-roster', name === 'roster');
    document.body.classList.toggle('sheet-legend', name === 'legend');
    document.querySelectorAll('.mbar [data-sheet]').forEach(b => b.classList.toggle('on', b.dataset.sheet === name));
    if (name) closeInspector();
    syncCardButtons();
  }
  document.querySelectorAll('.mbar [data-sheet]').forEach(b => b.addEventListener('click', () => {
    setSheet(document.body.classList.contains('sheet-' + b.dataset.sheet) ? null : b.dataset.sheet);
  }));

  /* ---- floating cards — drag by header, collapse, resize; layout persists ---- */
  const CARD_KEY = 'safety.vims.cards.v1';
  let cardState = {};
  try { cardState = JSON.parse(localStorage.getItem(CARD_KEY)) || {}; } catch { }
  const saveCards = () => { try { localStorage.setItem(CARD_KEY, JSON.stringify(cardState)); } catch { } };
  const cards = [];
  let zTop = 20;
  function placeCard(el, x, y) {
    const r = el.getBoundingClientRect();
    el.style.left = clamp(x, 0, Math.max(0, innerWidth - Math.min(r.width, innerWidth))) + 'px';
    el.style.top = clamp(y, 0, innerHeight - 34) + 'px';
    el.style.right = el.style.bottom = 'auto';
    el.style.transform = 'none';
  }
  const resetCard = el => { ['left', 'top', 'right', 'bottom', 'transform', 'height', 'zIndex'].forEach(p => { el.style[p] = ''; }); };
  function draggable(el, key) {
    const handle = el.querySelector('.card-h'), st = cardState[key] || (cardState[key] = {});
    const min = handle.querySelector('.card-min');
    delete st.collapsed;   // cards used to fold to their header; they now hide into the header's button
    const apply = () => {
      syncCardButtons();
      if (mobile) { resetCard(el); el.classList.remove('card-off'); return; }
      el.classList.toggle('card-off', !!st.off);
      if (st.h) el.style.height = st.h + 'px';
      if (st.x != null) placeCard(el, st.x, st.y);
    };
    handle.addEventListener('pointerdown', e => {
      if (mobile || e.button > 0 || e.target.closest('button')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      if (el.dataset.resize != null) el.style.height = (st.h = Math.round(r.height)) + 'px';
      handle.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      el.style.zIndex = ++zTop;
      const mv = ev => placeCard(el, ev.clientX - ox, ev.clientY - oy);
      const up = () => {
        handle.removeEventListener('pointermove', mv);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
        const r2 = el.getBoundingClientRect();
        st.x = Math.round(r2.left); st.y = Math.round(r2.top);
        saveCards(); fitView();
      };
      handle.addEventListener('pointermove', mv);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
    handle.addEventListener('dblclick', e => {
      if (mobile || e.target.closest('button')) return;
      delete st.x; delete st.y; delete st.h; saveCards(); resetCard(el); fitView();
    });
    if (min) min.addEventListener('click', () => showCard(key, false));
    cardEls[key] = { el, st, apply };
    if (el.dataset.resize != null && window.ResizeObserver) {
      let armed = false;
      el.addEventListener('pointerdown', () => { armed = true; });
      addEventListener('pointerup', () => { armed = false; });
      new ResizeObserver(() => {
        if (!armed || mobile || st.off) return;
        st.h = Math.round(el.getBoundingClientRect().height); saveCards();
      }).observe(el);
    }
    el.addEventListener('pointerdown', () => { if (!mobile) el.style.zIndex = ++zTop; });
    cards.push(apply); apply();
  }
  /* the header's RISK CLASS / MODELS buttons: a card hides into its button and
     comes back out of it; on phones the same buttons open the bottom sheets */
  const cardEls = {};
  const cardBtns = [...document.querySelectorAll('.card-btn[data-card]')];
  function syncCardButtons() {
    for (const b of cardBtns) {
      const on = mobile ? document.body.classList.contains('sheet-' + b.dataset.card) : !cardState[b.dataset.card]?.off;
      b.setAttribute('aria-pressed', String(on));
    }
  }
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* fly the card into (or out of) its button */
  function flyCard(el, btn, out) {
    if (still() || !el.animate) return Promise.resolve();
    const c = el.getBoundingClientRect(), b = btn.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (c.left + c.width / 2), dy = b.top + b.height / 2 - (c.top + c.height / 2);
    const away = { transform: `translate(${dx}px,${dy}px) scale(.06)`, opacity: 0 }, here = { transform: 'translate(0,0) scale(1)', opacity: 1 };
    return el.animate(out ? [here, away] : [away, here], { duration: 220, easing: 'cubic-bezier(.3,.7,.3,1)' }).finished.catch(() => {});
  }
  async function showCard(key, on) {
    if (mobile) { setSheet(on ? key : null); syncCardButtons(); return; }
    const c = cardEls[key], btn = cardBtns.find(b => b.dataset.card === key);
    if (!c || !!c.st.off === !on) return;
    if (!on && btn) await flyCard(c.el, btn, true);
    c.st.off = !on; saveCards(); c.apply(); fitView();
    if (on) { c.el.style.zIndex = ++zTop; if (btn) await flyCard(c.el, btn, false); }
  }
  for (const b of cardBtns) b.addEventListener('click', () => {
    const key = b.dataset.card;
    showCard(key, mobile ? !document.body.classList.contains('sheet-' + key) : !!cardState[key]?.off);
  });
  draggable($('legend'), 'legend');
  draggable(document.querySelector('.roster'), 'roster');
  draggable(insp, 'insp');
  addEventListener('resize', () => requestAnimationFrame(() => cards.forEach(f => f())));

  /* ---- fullscreen ---- */
  const fsEl = document.documentElement;
  const fsOK = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
  function toggleFullscreen() {
    if (!fsOK) return;
    const on = document.fullscreenElement || document.webkitFullscreenElement;
    if (on) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl).catch?.(() => { });
  }
  const fsBtn = $('fs-btn');
  if (!fsOK) fsBtn.remove();
  else {
    fsBtn.onclick = toggleFullscreen;
    const sync = () => fsBtn.classList.toggle('on', !!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
  }

  /* ---- inspector: real model card + benchmark aggregation ---- */
  function extractBenchmarks(m) {
    const mi = m.cardData && m.cardData['model-index'];
    const out = [];
    if (Array.isArray(mi)) for (const e of mi) for (const r of e.results || []) {
      const ds = (r.dataset && (r.dataset.name || r.dataset.type)) || (e.task && (e.task.name || e.task.type)) || '?';
      for (const mt of r.metrics || []) {
        let v = mt.value;
        if (typeof v === 'number' && v <= 1.001) v = (v * 100).toFixed(1);
        else if (typeof v === 'number') v = +v.toFixed(2);
        out.push({ ds: String(ds).replace(/^(super_glue|glue),?/i, '').slice(0, 26), metric: String(mt.name || mt.type || 'score').slice(0, 18), value: v });
      }
    }
    return out;
  }
  /* The model card, read once per model on inspect: self-reported benchmarks,
     the exact parameter count, and the training-token count the card states.
     Classes VI and VII need this evidence, so the model is re-classified with
     it — and moves to its new band if the class changes. */
  async function enrichCard(a) {
    if (a.api || a.bench !== undefined) return false;
    a.bench = null;
    const name = a.name;
    try {
      const api = `https://huggingface.co/api/models/${name}?expand[]=cardData&expand[]=safetensors&expand[]=tags&expand[]=gated&expand[]=pipeline_tag&expand[]=downloads&expand[]=likes&expand[]=config&expand[]=inferenceProviderMapping`;
      const [mr, readme] = await Promise.all([
        fetch(api).then(r => r.ok ? r.json() : null),
        a.gated ? Promise.resolve('') : fetch(`https://huggingface.co/${name}/raw/main/README.md`).then(r => r.ok ? r.text() : '').catch(() => ''),
      ]);
      if (!mr || a.name !== name) return false;
      a.hfProviders = liveProviders(mr.inferenceProviderMapping);
      const bench = extractBenchmarks(mr);
      a.bench = bench.slice(0, 9);
      const tm = readme.match(TOKENS_RE);
      const am = readme.match(ACTIVE_RE);
      const card = { bench, tokensT: tm ? +tm[1] : 0, activeB: am ? +am[1] : 0 };
      if (tm) a.tokenQuote = readme.slice(Math.max(0, tm.index - 60), tm.index + tm[0].length + 20).replace(/\s+/g, ' ').trim();
      const exactOf = id => census.find(r => r.m.id.toLowerCase() === String(id).toLowerCase() && r.basis === 'safetensors')?.paramsB || 0;
      const rec = { m: { ...mr, id: name }, ...classifyModel({ ...mr, id: name }, card, { paramsOf: exactOf }), downloads: a.downloads };
      const moved = rec.cls !== a.cls;
      a.steps = rec.steps; a.score = rec.score; a.flops = rec.flops; a.basis = rec.basis; a.lineage = rec.lineage; a.phase = rec.phase; a.phaseWhy = rec.phaseWhy;
      if (moved) {
        a.cls = rec.cls;
        a.frac = bandFrac(rec);
        birthIdx = a.i; birthT = 0;
        const c = census.find(r => r.m.id === name);
        if (c) Object.assign(c, { cls: rec.cls, steps: rec.steps, flops: rec.flops });
        refresh();
      }
      return moved;
    } catch { a.hfProviders = a.hfProviders || []; return false; }
  }
  function openInspector(i) {
    const a = AGENTS[i];
    if (!a.used) return;
    insp.style.display = 'block';
    $('in-cls').textContent = `CLASS ${RN[a.cls - 1]} · ${CLS_NAME[a.cls - 1]}`;
    $('in-cls').style.color = CLS_HEX[a.cls - 1];
    $('in-name').textContent = a.api ? a.displayName : a.name;
    const act = `<div class="in-act" id="in-act">${actButtons(a)}</div>`;
    if (a.api) {
      const usd = v => v == null || v === '' ? '—' : `$${(+v * 1e6).toFixed(+v * 1e6 < 1 ? 2 : 2)}`;
      $('in-body').innerHTML = act +
        `<div class="in-row"><span>ACCESS</span><b>API-ONLY · CLOSED WEIGHTS</b></div>` +
        `<div class="in-row"><span>PROVIDER</span><b>${esc(a.provider)}</b></div>` +
        `<div class="in-row"><span>ID</span><b>${esc(a.name)}</b></div>` +
        `<div class="in-row"><span>MODALITY</span><b>${esc(a.modality || '—')}</b></div>` +
        `<div class="in-row"><span>CONTEXT</span><b>${a.context ? (a.context >= 1e6 ? (a.context / 1e6).toFixed(a.context % 1e6 ? 1 : 0) + 'M' : Math.round(a.context / 1e3) + 'K') + ' tokens' : '—'}</b></div>` +
        `<div class="in-row"><span>PRICE / 1M</span><b>${usd(a.pricing.prompt)} in · ${usd(a.pricing.completion)} out</b></div>` +
        `<div class="in-row"><span>DECLARES</span><b>${esc(a.caps.join(', ') || '—')}</b></div>` +
        `<div class="in-row"><span>RELEASED</span><b>${a.created ? new Date(a.created * 1000).toISOString().slice(0, 10) : '—'}</b></div>` +
        `<div class="in-row"><span>MANIFEST</span><b class="hash" id="in-hash">${a.hash ? a.hash + '…' : 'hashing…'}</b></div>` +
        `<div class="in-sec">CLASSIFICATION EVIDENCE</div>` +
        `<div class="in-ev" id="in-ev">${(a.steps || []).map(esc).join('<br>')}</div>` +
        `<div class="in-sec">ARENA — THIRD-PARTY (DESIGN ARENA, VIA OPENROUTER)</div>` +
        (a.arena.length ? a.arena.map(b2 => `<div class="in-row"><span>${esc(b2.category)}</span><b>Elo ${b2.elo} · #${b2.rank}</b></div>`).join('') : '<div class="in-note">none listed</div>') +
        `<div class="in-note">Source: openrouter.ai/api/v1/models — the provider publishes capabilities and prices, not parameters or training compute.</div>`;
      wireAct(a);
      return;
    }
    let body = act +
      `<div class="in-row"><span>STATUS</span><b class="${a.revoked ? 'bad' : 'ok'}">${a.revoked ? (a.why || 'RESTRICTED').toUpperCase() : 'SELF-ATTESTED'}</b></div>` +
      `<div class="in-row"><span>PIPELINE</span><b>${a.pipeline || '—'}</b></div>` +
      `<div class="in-row"><span>DOWNLOADS</span><b>${fmtDl(a.downloads)}/mo · ♥${a.likes || 0}</b></div>` +
      `<div class="in-row"><span>LICENSE</span><b>${a.license || '—'}</b></div>` +
      `<div class="in-row"><span>SCORE</span><b>${a.score !== undefined ? a.score.toFixed(2) : '—'}</b></div>` +
      `<div class="in-row"><span>SIZE</span><b>${a.paramsB ? fmtB(a.paramsB) + ' params' : '—'} · ${esc(BASIS_LABEL(a.basis))}</b></div>` +
      `<div class="in-row"><span>LINEAGE</span><b class="${a.phase === 'stripped' ? 'bad' : ''}">${esc(PHASE[a.phase || 'original'].label)} · ${esc(a.phaseWhy || '')}${a.teacher ? ` · teacher ${esc(a.teacher)}` : ''}</b></div>` +
      (a.hosted ? `<div class="in-row"><span>HOSTED</span><b class="${a.phase === 'stripped' ? 'bad' : ''}">served on ${esc(a.hosted)}'s public API${a.phase === 'stripped' ? ' — safety-stripped and callable by anyone: out of containment' : ''} · resold by routers such as DemonRoute</b></div>` : '') +
      lineageRows(a) +
      `<div class="in-row"><span>TAGS</span><b>${(a.tags || []).filter(t => !t.startsWith('license:')).slice(0, 5).join(', ') || '—'}</b></div>` +
      `<div class="in-row"><span>MANIFEST</span><b class="hash" id="in-hash">${a.hash ? a.hash + '…' : 'hashing…'}</b></div>` +
      `<div class="in-sec">CLASSIFICATION EVIDENCE</div>` +
      `<div class="in-ev" id="in-ev">${(a.steps || []).map(esc).join('<br>') || '—'}</div>` +
      `<div class="in-sec">BENCHMARKS — SELF-REPORTED</div>` +
      `<div class="in-bench" id="in-bench">${a.bench === null ? '—' : 'loading…'}</div>`;
    $('in-body').innerHTML = body;
    wireAct(a);
    if (a.bench === undefined) enrichCard(a).then(moved => {
      if (selIdx !== a.i) return;
      if (moved) { openInspector(a.i); return; }
      $('in-act').innerHTML = actButtons(a); wireAct(a);
      $('in-ev').innerHTML = (a.steps || []).map(esc).join('<br>');
      $('in-bench').innerHTML = a.bench && a.bench.length
        ? a.bench.map(b2 => `<div class="in-row"><span>${b2.ds}</span><b>${b2.value}</b></div>`).join('')
        : 'none declared on model card';
    });
    else if (a.bench) $('in-bench').innerHTML = a.bench.length
      ? a.bench.map(b2 => `<div class="in-row"><span>${b2.ds}</span><b>${b2.value}</b></div>`).join('')
      : 'none declared on model card';
  }
  function closeInspector() { insp.style.display = 'none'; }

  /* a class's own card: what puts a model in it, what counts as evidence, who's there */
  function openClassInfo(c) {
    const k = CLASSES[c - 1];
    select(-1);
    setSheet(null);
    const members = AGENTS.filter(a => a.used && a.cls === c);
    const entries = register.filter(e => e.class === c);
    insp.style.display = 'block';
    $('in-name').textContent = `CLASS ${k.rn} · ${k.name}`;
    $('in-cls').textContent = k.reserved
      ? (members.length || entries.length ? 'RESERVED — OCCUPIED' : 'RESERVED — NO KNOWN ENTITY')
      : `${members.length} ON THE MAP · FROM ${k.basis.toUpperCase()}`;
    $('in-cls').style.color = k.hex;
    $('in-body').innerHTML =
      `<div class="in-sec">CRITERION</div><div class="in-ev">${esc(k.test)}</div>` +
      (k.evidence ? `<div class="in-sec">EVIDENCE THAT COUNTS</div><div class="in-ev">${esc(k.evidence)}</div>` : '') +
      (k.reserved ? `<div class="in-note">This band is defined in advance and stays empty until a sourced claim places a model here. An empty band is not a prediction that any model will reach it.</div>` : '') +
      `<div class="in-sec">EVIDENCE REGISTER</div>` +
      (entries.length
        ? entries.map(e => `<div class="in-ev"><b>${esc(e.models.join(', '))}</b><br>“${esc(e.quote)}”<br><a class="in-src" href="${esc(e.source)}" target="_blank" rel="noopener">${esc(e.publisher)} · ${esc(e.date)} ↗</a></div>`).join('')
        : `<div class="in-note">none</div>`) +
      (members.length && !k.reserved ? `<div class="in-sec">ON THE MAP</div><div class="in-ev">${members.slice(0, 12).map(a => esc(a.name.split('/').pop())).join(' · ')}${members.length > 12 ? ` · +${members.length - 12}` : ''}</div>` : '');
  }

  /* ---- weights — the repo's real file tree: sizes, LFS sha256, direct downloads ---- */
  const fmtBytes = n => n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1e3 ? (n / 1e3).toFixed(0) + ' kB' : n + ' B';
  const WEIGHT_RE = /\.(safetensors|gguf|bin|pt|pth|ckpt|onnx|h5|msgpack|tflite|mlmodel|npz)$/i;
  const PICKLE_RE = /\.(bin|pt|pth|ckpt)$/i;
  const fileUrl = (id, path) => `https://huggingface.co/${id}/resolve/main/${path.split('/').map(encodeURIComponent).join('/')}?download=true`;
  async function loadFiles(a) {
    if (a.files) return a.files;
    const r = await fetch(`https://huggingface.co/api/models/${a.name}/tree/main?recursive=true`);
    if (!r.ok) throw new Error(r.status === 401 || r.status === 404 ? 'repo not listable' : `hub ${r.status}`);
    a.files = (await r.json()).filter(f => f.type === 'file');
    return a.files;
  }
  function copyBtn(text) {
    return `<button type="button" class="in-copy" data-copy="${esc(text)}">COPY</button>`;
  }
  function renderFiles(a, el) {
    const files = a.files;
    const weights = files.filter(f => WEIGHT_RE.test(f.path)), rest = files.filter(f => !WEIGHT_RE.test(f.path));
    const total = files.reduce((n, f) => n + (f.size || 0), 0), wTotal = weights.reduce((n, f) => n + (f.size || 0), 0);
    const ggufs = weights.filter(f => /\.gguf$/i.test(f.path));
    const safe = weights.some(f => /\.safetensors$/i.test(f.path));
    const pickle = weights.filter(f => PICKLE_RE.test(f.path));
    /* shared prefix (cut at a separator) hidden so the distinguishing part — e.g. the quant — shows */
    const base = f => f.path.slice(f.path.lastIndexOf('/') + 1);
    const sharedPrefix = list => {
      if (list.length < 2) return 0;
      let p = base(list[0]);
      for (const f of list) while (!base(f).startsWith(p)) p = p.slice(0, -1);
      const cut = Math.max(p.lastIndexOf('-'), p.lastIndexOf('_'), p.lastIndexOf('/'), p.lastIndexOf('.'));
      return cut > 8 ? cut + 1 : 0;
    };
    const row = (f, cut = 0) => `<a class="in-file" href="${fileUrl(a.name, f.path)}" download title="${esc(f.path)}${f.lfs ? '\nsha256 ' + f.lfs.oid : ''}">` +
      `<span class="p${PICKLE_RE.test(f.path) ? ' warn' : ''}">${esc(f.path.slice(0, f.path.length - base(f).length))}${cut ? '…' : ''}${esc(base(f).slice(cut))}</span>` +
      `<span class="s">${fmtBytes(f.size || 0)}</span>` +
      `<span class="h">${f.lfs ? f.lfs.oid.slice(0, 10) : ''}</span><span class="d">⇩</span></a>`;
    const wCut = sharedPrefix(weights);
    const cmd = ggufs.length > 1 ? `hf download ${a.name} ${ggufs.sort((x, y) => x.size - y.size)[0].path}` : `hf download ${a.name}`;
    el.innerHTML =
      (a.gated ? `<div class="in-note bad">GATED — accept the license at huggingface.co/${esc(a.name)} while signed in; downloads 401 until then. CLI: <code>hf auth login</code> first.</div>` : '') +
      (pickle.length && !safe ? `<div class="in-note bad">PICKLE-ONLY — ${pickle.length} file(s) execute code on load. No safetensors in this repo.</div>` : '') +
      `<div class="in-row"><span>WEIGHTS</span><b>${weights.length} file${weights.length === 1 ? '' : 's'} · ${fmtBytes(wTotal)}</b></div>` +
      `<div class="in-row"><span>REPO TOTAL</span><b>${files.length} files · ${fmtBytes(total)}</b></div>` +
      `<div class="in-cmd"><code>${esc(cmd)}</code>${copyBtn(cmd)}</div>` +
      (ggufs.length > 1 ? `<div class="in-note">${ggufs.length} GGUF quantizations — command fetches the smallest; pick one below.</div>` : '') +
      `<div class="in-sec">WEIGHT FILES · sha256 (LFS)</div>` +
      (weights.length ? weights.sort((x, y) => x.path.localeCompare(y.path, undefined, { numeric: true })).map(f => row(f, wCut)).join('') : '<div class="in-note">no weight files in this repo</div>') +
      (rest.length ? `<details class="in-more"><summary>CONFIG · TOKENIZER · OTHER (${rest.length})</summary>${rest.map(f => row(f)).join('')}</details>` : '') +
      serveSection(a, weights);
  }
  /* ---- serving on a VIMS GPU node — same estimate chat.vims.com's Deploy panel uses ---- */
  const GPU_CLASSES = [
    ['RTX 4000 Ada', 20, 'DigitalOcean · Linode'], ['L4', 24, 'Google Cloud · AWS'], ['A10G', 24, 'AWS'],
    ['A100', 40, 'Google Cloud'], ['L40S / RTX 6000 Ada', 48, 'DigitalOcean · AWS'], ['A100', 80, 'Google Cloud'],
    ['H100', 80, 'DigitalOcean'], ['H200', 141, 'DigitalOcean'],
  ];
  const vramNeeded = bytes => Math.ceil(bytes / 1e9 * 1.15 + 2);
  function serveSection(a, weights) {
    const st = weights.filter(f => /\.safetensors$/i.test(f.path)).reduce((n, f) => n + (f.size || 0), 0);
    const why = a.gated ? 'gated — needs a Hugging Face token on the node, which deploys don\'t send yet'
      : !st ? 'no safetensors weights — vLLM serves safetensors repos only' : null;
    if (why) return `<div class="in-sec">SERVE ON A VIMS NODE</div><div class="in-note bad">not deployable: ${esc(why)}</div>`;
    const need = vramNeeded(st), fit = GPU_CLASSES.filter(([, v]) => need <= v * 0.9);
    return `<div class="in-sec">SERVE ON A VIMS NODE</div>` +
      `<div class="in-row"><span>GPU MEMORY</span><b>≈ ${need} GB</b></div>` +
      (fit.length
        ? `<div class="in-row"><span>SMALLEST FIT</span><b>${esc(fit[0][0])} ${fit[0][1]} GB · ${esc(fit[0][2])}</b></div>` +
          `<a class="in-deploy" href="https://chat.vims.com/?deploy=${encodeURIComponent('hf:' + a.name)}" target="_blank" rel="noopener">DEPLOY ON VIMS ↗</a>` +
          `<div class="in-note">opens chat.vims.com Deploy: a GPU server on your own cloud account, controlled by your identity; chat with the model when it's serving.</div>`
        : `<div class="in-note bad">needs more than one GPU's memory — single-GPU nodes can't serve it yet.</div>`);
  }
  /* the repo's files + the GPU-node estimate, into el */
  async function fillRun(a, el) {
    if (!a.files) {
      el.innerHTML = '<div class="in-note">listing repository…</div>';
      try { await loadFiles(a); } catch (e) {
        el.innerHTML = `<div class="in-note bad">✗ ${e.message === 'Failed to fetch' ? 'hub unreachable' : esc(e.message)}</div>`;
        return;
      }
    }
    renderFiles(a, el);
  }

  /* ---- where a model can be called with a key, and where it can be downloaded ----
     Hosted routes, from what each registry publishes:
       OpenRouter      its model list (API-only models; open models by Hugging Face id)
       the lab itself  API-only models from labs chat.vims.com calls directly
       NVIDIA          build.nvidia.com catalog (its API refuses web pages — bundled snapshot)
       HF providers    Hugging Face's inference-provider mapping for the repo (live ones only)
     Download = open weights on Hugging Face (not API-only models). */
  const NATIVE_KEYS = {   // providers chat.vims.com and VIMS desktop call directly with your key
    openai: { label: 'OpenAI', url: 'https://platform.openai.com/api-keys', chat: 'openai' },
    anthropic: { label: 'Anthropic', url: 'https://console.anthropic.com/settings/keys', chat: 'anthropic' },
    google: { label: 'Google AI Studio', url: 'https://aistudio.google.com/app/apikey', chat: 'google' },
    'x-ai': { label: 'xAI', url: 'https://console.x.ai/', chat: 'xai' },
    mistralai: { label: 'Mistral', url: 'https://console.mistral.ai/api-keys', chat: 'mistral' },
    deepseek: { label: 'DeepSeek', url: 'https://platform.deepseek.com/api_keys', chat: 'deepseek' },
    moonshotai: { label: 'Moonshot', url: 'https://platform.moonshot.ai/console/api-keys', chat: 'moonshot' },
  };
  const HF_PROVIDERS = {
    together: { label: 'Together AI', url: 'https://api.together.ai/settings/api-keys' },
    'fireworks-ai': { label: 'Fireworks', url: 'https://fireworks.ai/account/api-keys' },
    groq: { label: 'Groq', url: 'https://console.groq.com/keys', chat: 'groq' },
    cerebras: { label: 'Cerebras', url: 'https://cloud.cerebras.ai/' },
    sambanova: { label: 'SambaNova', url: 'https://cloud.sambanova.ai/apis' },
    novita: { label: 'Novita', url: 'https://novita.ai/settings/key-management' },
    nebius: { label: 'Nebius', url: 'https://studio.nebius.com/' },
    'featherless-ai': { label: 'Featherless', url: 'https://featherless.ai/account/api-keys' },
    hyperbolic: { label: 'Hyperbolic', url: 'https://app.hyperbolic.xyz/settings' },
  };
  let nvidiaByName = new Map(), nvidiaDate = '';
  function loadNvidia(ids, date) {
    const seen = new Map();
    for (const id of ids) { const n = id.split('/').pop().toLowerCase(); seen.set(n, seen.has(n) ? null : id); }
    nvidiaByName = new Map([...seen].filter(([, v]) => v));   // ambiguous names don't match
    nvidiaDate = date || '';
  }
  /* live providers from Hugging Face's mapping (object keyed by provider, or array) */
  function liveProviders(map) {
    const list = Array.isArray(map) ? map : Object.entries(map || {}).map(([provider, v]) => ({ provider, ...v }));
    return list.filter(p => p.status === 'live' && p.providerId).map(p => ({ provider: p.provider, id: p.providerId }));
  }
  function routes(a) {
    const out = [];
    const orId = a.api ? a.name : orByHf.get(a.name.toLowerCase());
    if (orId) out.push({ label: 'OpenRouter', url: 'https://openrouter.ai/keys', note: `one key for every model it serves — <code>${esc(orId)}</code>`, chat: `openrouter:${orId}` });
    const native = a.api && NATIVE_KEYS[a.name.split('/')[0]];
    if (native) out.push({ label: native.label, url: native.url, note: "straight from the lab — pick the model in chat's list for it" });
    const nv = !a.api && nvidiaByName.get(a.name.split('/').pop().toLowerCase());
    if (nv) out.push({ label: 'NVIDIA', url: 'https://build.nvidia.com/', note: `NVIDIA's hosted API as <code>${esc(nv)}</code> (catalog snapshot ${esc(nvidiaDate)}) — use it in VIMS desktop; NVIDIA refuses calls from web pages` });
    const hp = a.hfProviders || [];
    if (a.hosted && !hp.some(p => p.provider === 'featherless-ai')) out.push({ label: a.hosted, url: `https://featherless.ai/models/${a.name}`, note: `serves it on its public API as <code>${esc(a.name)}</code> (${hosted.total ? `one of ${hosted.total.toLocaleString('en')} models` : 'catalog'}${hosted.snapshot && hosted.snapshot !== 'live' ? `, snapshot ${esc(hosted.snapshot)}` : ''})` });
    if (hp.length) {
      out.push({ label: 'Hugging Face', url: 'https://huggingface.co/settings/tokens', note: `one token routes to ${hp.map(p => HF_PROVIDERS[p.provider]?.label || p.provider).join(', ')}` });
      for (const p of hp) {
        const k = HF_PROVIDERS[p.provider];
        if (k) out.push({ label: k.label, url: k.url, note: `serves it as <code>${esc(p.id)}</code>`, ...(k.chat ? { chat: `${k.chat}:${p.id}` } : {}) });
      }
    }
    return out;
  }
  const hasWeights = a => !a.api;
  const BASIS_LABEL = b => !b || b === 'unknown' ? 'unknown' : b === 'safetensors' ? 'exact (safetensors)' : b === 'name' ? 'parsed from the name' : `inherited from ${b.slice(5)}`;
  const derivativesOf = id => census.filter(r => r.lineage && r.lineage.base.toLowerCase() === id.toLowerCase());
  function lineageRows(a) {
    const kids = derivativesOf(a.name);
    const rels = kids.reduce((o, r) => (o[r.lineage.rel] = (o[r.lineage.rel] || 0) + 1, o), {});
    return (a.lineage ? `<div class="in-row"><span>LINEAGE</span><b>${esc(a.lineage.rel)} from <button type="button" class="in-jump" data-id="${esc(a.lineage.base)}">${esc(a.lineage.base)}</button></b></div>` : '') +
      (kids.length ? `<div class="in-row"><span>DERIVATIVES</span><b>${kids.length} in the registry · ${Object.entries(rels).map(([k, v]) => `${v} ${esc(k)}`).join(', ')}</b></div>` : '');
  }
  function actButtons(a) {
    const r = routes(a), pending = !a.api && a.hfProviders === undefined;
    return (r.length || pending ? `<button type="button" id="in-key"${r.length ? '' : ' disabled'}>⚿ ${r.length ? 'API KEY' : 'CHECKING APIs…'}</button>` : '') +
      (hasWeights(a) ? `<button type="button" id="in-dl" class="dl">⇩ DOWNLOAD</button>` : '') +
      (a.api ? `<a href="https://openrouter.ai/${esc(a.name)}" target="_blank" rel="noopener">OPENROUTER ↗</a>`
             : `<a href="https://huggingface.co/${esc(a.name)}" target="_blank" rel="noopener">CARD ↗</a>`);
  }
  function wireAct(a) {
    const k = $('in-key'), d = $('in-dl');
    if (k) k.onclick = () => openKeyModal(a);
    if (d) d.onclick = () => openDownloadModal(a);
  }

  const keyModal = $('key-modal');
  let modalReturn = null;
  function showModal(a, sub, html) {
    $('mo-title').textContent = a.api ? a.displayName : a.name;
    $('mo-sub').textContent = `CLASS ${RN[a.cls - 1]} · ${CLS_NAME[a.cls - 1]} · ${sub}`;
    $('mo-sub').style.color = CLS_HEX[a.cls - 1];
    $('mo-body').innerHTML = html;
    modalReturn = document.activeElement;
    keyModal.hidden = false;
    keyModal.querySelector('.mo-card').focus();
  }
  function openKeyModal(a) {
    const r = routes(a), go = r.find(x => x.chat);
    showModal(a, a.api ? 'API-ONLY' : 'HOSTED APIs',
      `<div class="mo-step"><i>1</i>GET AN API KEY</div>` +
      r.map(x => `<a class="mo-opt" href="${x.url}" target="_blank" rel="noopener"><b>${esc(x.label)}</b><span>${x.note}</span><em>GET KEY ↗</em></a>`).join('') +
      `<div class="mo-step"><i>2</i>USE IT</div>` +
      (go ? `<a class="mo-go" href="https://chat.vims.com/?use=${encodeURIComponent(go.chat)}" target="_blank" rel="noopener">CHAT WITH IT ON CHAT.VIMS.COM →<span>opens chat with it selected via ${esc(go.label)} — paste that key when it asks</span></a>` : '') +
      `<a class="mo-go${go ? ' alt' : ''}" href="https://vims.com/download" target="_blank" rel="noopener">USE YOUR KEY IN VIMS DESKTOP ↓<span>download the app, add the key in its Key Manager</span></a>` +
      `<div class="in-note">Your key lives in your own vault (keys.vims.com) and is sent only to the provider — VIMS servers never see it or your prompts.</div>` +
      (hasWeights(a) ? `<button type="button" class="mo-link" id="mo-to-dl">open weights — download or serve it yourself →</button>` : ''));
    const t = $('mo-to-dl');
    if (t) t.onclick = () => openDownloadModal(a);
  }
  function openDownloadModal(a) {
    showModal(a, 'OPEN WEIGHTS',
      `<div class="mo-step"><i>⇩</i>DOWNLOAD — OR SERVE IT ON A GPU NODE</div><div id="mo-files"></div>` +
      (routes(a).length ? `<button type="button" class="mo-link" id="mo-to-key">or call it through a hosted API →</button>` : ''));
    fillRun(a, $('mo-files'));
    const t = $('mo-to-key');
    if (t) t.onclick = () => openKeyModal(a);
  }
  function closeKeyModal() {
    if (keyModal.hidden) return false;
    keyModal.hidden = true;
    modalReturn?.focus?.();
    return true;
  }
  $('mo-x').onclick = closeKeyModal;
  keyModal.addEventListener('click', e => { if (e.target === keyModal) closeKeyModal(); });
  keyModal.addEventListener('click', async e => {
    const b = e.target.closest('.in-copy');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'COPIED'; }
    catch { b.textContent = 'SELECT ↑'; }
    setTimeout(() => { b.textContent = 'COPY'; }, 1400);
  });

  insp.addEventListener('click', e => {
    const j = e.target.closest('.in-jump');
    if (!j) return;
    const rec = census.find(r => r.m.id.toLowerCase() === j.dataset.id.toLowerCase());
    if (rec) addToMap(rec); else classifyId(j.dataset.id);
  });
  insp.addEventListener('click', async e => {
    const b = e.target.closest('.in-copy');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'COPIED'; }
    catch { b.textContent = 'SELECT ↑'; }
    setTimeout(() => { b.textContent = 'COPY'; }, 1400);
  });
  $('in-x').onclick = () => select(-1);

  /* legend class filter */
  let filterCls = 0;
  /* lineage filters: which kinds of model the sky shows (?hide=quantized,merge…) */
  const hiddenPhases = new Set((new URLSearchParams(location.search).get('hide') || '').split(',').filter(p => PHASE[p]));
  const inLayers = a => !hiddenPhases.has(a.phase || 'original');
  $('lg-rows').innerHTML = CLASSES.map((k, i) =>
    `<button type="button" class="lg-row${k.reserved ? ' rsv' : ''}" data-c="${i + 1}" aria-pressed="false"><i style="--c:${k.hex}"></i>${k.rn} · ${k.name}<span class="n"></span></button>`).join('');
  $('lg-layers').innerHTML = PHASES.map(p =>
    `<button type="button" class="ly-row${p.id === 'stripped' ? ' stripped' : ''}" data-ph="${p.id}" aria-pressed="${!hiddenPhases.has(p.id)}" title="${esc(p.label.toLowerCase())} — ${esc(p.note)}"><i></i>${p.short}<span class="n"></span></button>`).join('');
  $('lg-layers').addEventListener('click', e => {
    const b = e.target.closest('.ly-row');
    if (!b) return;
    const ph = b.dataset.ph;
    if (hiddenPhases.has(ph)) hiddenPhases.delete(ph); else hiddenPhases.add(ph);
    b.setAttribute('aria-pressed', String(!hiddenPhases.has(ph)));
    applyRosterFilter(); syncUrl(); syncStars();
    if (selIdx >= 0 && !inLayers(AGENTS[selIdx])) select(-1);
  });
  function syncLayerCounts() {
    const onMap = {}, all = {};
    for (const a of AGENTS) if (a.used) onMap[a.phase || 'original'] = (onMap[a.phase || 'original'] || 0) + 1;
    for (const r of census) all[r.phase || 'original'] = (all[r.phase || 'original'] || 0) + 1;
    document.querySelectorAll('#lg-layers .ly-row').forEach(b => {
      const p = b.dataset.ph;
      b.querySelector('.n').textContent = `${onMap[p] || 0} / ${all[p] || 0}`;
    });
  }
  $('legend').addEventListener('click', e => {
    const row = e.target.closest('.lg-row');
    if (!row) return;
    const c = +row.dataset.c;
    if (CLASSES[c - 1].reserved) { openClassInfo(c); return; }
    setFilterCls(filterCls === c ? 0 : c);
  });
  /* isolate one class (0: every class) — the legend rows and the list's back arrow */
  function setFilterCls(c) {
    filterCls = c;
    [...$('legend').querySelectorAll('.lg-row')].forEach(r => {
      r.classList.toggle('off', !!filterCls && +r.dataset.c !== filterCls);
      r.setAttribute('aria-pressed', String(+r.dataset.c === filterCls));
    });
    applyRosterFilter();
    if (filterCls && selIdx >= 0 && AGENTS[selIdx].cls !== filterCls) select(-1);
  }
  rosterBack.addEventListener('click', () => setFilterCls(0));

  /* ============ THE Z AXIS — time ============
     Every model has a publication date. "As of" a month, models published after
     it don't exist yet; playing the timeline fills the sky in release order. */
  const MONTH = 30.44 * 864e5;
  let asOf = 0, clock = 0, playing = false;
  const fmtMonth = ms => new Date(ms).toISOString().slice(0, 7);
  const tlRange = () => {
    const ds = census.map(recDate).filter(d => d > Date.UTC(2017, 0));
    return ds.length ? [Math.min(...ds), Date.now()] : [Date.UTC(2018, 0), Date.now()];
  };
  {
    const q = new URLSearchParams(location.search).get('asof');
    if (q && /^\d{4}-\d{2}$/.test(q)) asOf = Date.UTC(+q.slice(0, 4), +q.slice(5) - 1, 28);
  }
  function applyAsOf() {
    let changed = false;
    for (const a of AGENTS) {
      const was = !!a.future;
      a.future = !!(a.used && asOf && a.date > asOf);
      if (was !== a.future) changed = true;
      if (was && !a.future && playing) a.bornT = clock;
    }
    if (changed && glOK) syncStars();
  }
  const tl = $('tl'), tlLabel = $('tl-label'), tlPlay = $('tl-play');
  function syncTimeline() {
    const [t0, t1] = tlRange();
    tl.min = 0; tl.max = Math.max(1, Math.round((t1 - t0) / MONTH));
    tl.value = asOf ? Math.round((asOf - t0) / MONTH) : tl.max;
    tl.style.setProperty('--tl-pct', `${(100 * tl.value / tl.max).toFixed(2)}%`);
    tlLabel.textContent = asOf ? `AS OF ${fmtMonth(asOf)}` : 'NOW';
    tl.setAttribute('aria-valuetext', asOf ? fmtMonth(asOf) : 'now');
  }
  function setAsOf(ms, push = true) {
    const [, t1] = tlRange();
    asOf = ms && ms < t1 - MONTH / 2 ? ms : 0;
    syncTimeline();
    applyAsOf(); applyRosterFilter();
    if (push) syncUrl();
  }
  tl.addEventListener('input', () => {
    const [t0] = tlRange();
    setPlaying(false);
    setAsOf(t0 + +tl.value * MONTH);
  });
  let playT = 0;
  function setPlaying(on) {
    playing = on;
    tlPlay.dataset.state = on ? 'pause' : 'play';
    tlPlay.textContent = on ? '❚❚' : '▶';
    tlPlay.setAttribute('aria-label', on ? 'Pause the release timeline' : 'Play the release timeline');
  }
  tlPlay.addEventListener('click', () => {
    if (playing) { setPlaying(false); return; }
    const [t0] = tlRange();
    if (!asOf) setAsOf(t0, false);
    setPlaying(true); playT = performance.now();
  });
  /* advanced from the frame loop: the whole history in ~24 s */
  function stepTimeline(now) {
    if (!playing) return;
    const [t0, t1] = tlRange(), rate = (t1 - t0) / 24000;
    const next = (asOf || t0) + (now - playT) * rate;
    playT = now;
    if (next >= t1) { setPlaying(false); setAsOf(0); return; }
    setAsOf(next, false);
  }

  /* y-axis picker */
  const yBtns = [...document.querySelectorAll('#y-axis [data-y]')];
  function syncYAxis() {
    yBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.y === yAxis)));
    axes[1].textContent = Y_AXES[yAxis];
    axes[5].textContent = Y_DOWN[yAxis];
    axes[3].style.display = apiStrip() ? '' : 'none';
    axes[3].textContent = yAxis === 'size' ? 'API · SIZE UNPUBLISHED' : 'API · NEWEST ↑';
  }
  yBtns.forEach(b => b.addEventListener('click', () => {
    if (b.dataset.y === yAxis) return;
    yAxis = b.dataset.y;
    if (zAxis === yAxis) zAxis = Object.keys(Z_AXES).find(k => k !== yAxis);
    syncYAxis(); syncView(); refresh(); syncUrl();
  }));
  /* 2D / 3D + the z measure */
  const Z_CAPTION = { size: 'Z · SIZE → LARGER', released: 'Z · RELEASED → NEWER', adoption: 'Z · ADOPTION → MORE DOWNLOADS' };
  const viewBtns = [...document.querySelectorAll('#view-mode [data-view]')], zBtns = [...document.querySelectorAll('#z-axis [data-z]')];
  function syncView() {
    viewBtns.forEach(b => b.setAttribute('aria-pressed', String((b.dataset.view === '3d') === view3d)));
    $('z-axis').hidden = !view3d;
    zBtns.forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.z === zAxis)); b.disabled = b.dataset.z === yAxis; });
    axes[4].textContent = Z_CAPTION[zAxis];
    document.body.classList.toggle('is3d', view3d);
  }
  function setView(three) {
    if (three === view3d) return;
    view3d = three;
    if (zAxis === yAxis) zAxis = Object.keys(Z_AXES).find(k => k !== yAxis);
    if (three) { Object.assign(cam, fitDist(CAM_FRONT)); Object.assign(camT, fitDist(CAM_HOME)); userCam = false; refresh(); }
    else { Object.assign(camT, fitDist(CAM_FRONT)); userCam = false; fitView(); }
    syncView(); syncUrl();
  }
  viewBtns.forEach(b => b.addEventListener('click', () => setView(b.dataset.view === '3d')));
  zBtns.forEach(b => b.addEventListener('click', () => {
    if (b.dataset.z === zAxis || b.dataset.z === yAxis) return;
    zAxis = b.dataset.z; refresh(); syncView(); syncUrl();
  }));
  addEventListener('keydown', e => {
    if (e.key !== '3' || e.target.closest('input,textarea,[contenteditable]')) return;
    setView(!view3d);
  });
  function syncUrl() {
    const u = new URL(location.href);
    if (view3d) { u.searchParams.set('view', '3d'); u.searchParams.set('z', zAxis); } else { u.searchParams.delete('view'); u.searchParams.delete('z'); }
    if (yAxis !== 'adoption') u.searchParams.set('y', yAxis); else u.searchParams.delete('y');
    if (asOf) u.searchParams.set('asof', fmtMonth(asOf)); else u.searchParams.delete('asof');
    if (hiddenPhases.size) u.searchParams.set('hide', [...hiddenPhases].join(',')); else u.searchParams.delete('hide');
    history.replaceState(null, '', u);
  }

  /* registry texture — the sky renders actual node data, not uniform
     arrays. Uniform-vector ceilings can't cap the node count. */
  const nodeData = new Uint8Array(512 * 4);
  function uploadNodes() {
    if (!glOK) return;
    gl.bindTexture(gl.TEXTURE_2D, nodeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, nodeData);
  }
  function syncStars() {
    AGENTS.forEach((a, i) => {
      const o = i * 8;
      const x16 = Math.min(65535, Math.max(0, Math.round(a.x / 1.2 * 65535)));
      const y16 = Math.min(65535, Math.max(0, Math.round(a.y / 1.2 * 65535)));
      nodeData[o] = x16 >> 8; nodeData[o + 1] = x16 & 255;
      nodeData[o + 2] = y16 >> 8; nodeData[o + 3] = y16 & 255;
      nodeData[o + 4] = Math.round((a.cls || 1) * 25);
      nodeData[o + 5] = a.used && a.revoked ? 255 : 0;
      nodeData[o + 6] = a.used && !a.future && inLayers(a) ? 0 : 255;   // unpublished or layer hidden = absent
      nodeData[o + 7] = 0;
    });
    uploadNodes();
  }
  /* H–R y-axis: adoption = download rank among plotted models.
     Attested rise above the plane, restricted mirror below it. */
  /* ============ THE Y AXIS — what height means (?y=) ============
       adoption  open weights by download rank; API-only (no download counts) in a strip by release date
       released  every model by publication date — open and API-only on one axis
       size      open weights by parameter count (log); API-only (sizes unpublished) in a strip
     Restricted models mirror below the plane on the same measure. */
  const Y_AXES = { adoption: 'DOWNLOADS ↑', released: 'RELEASED ↑', size: 'PARAMETERS · LOG ↑' };
  /* −y: restricted and safety-stripped models mirror the same measure below the plane */
  const Y_DOWN = { adoption: 'STRIPPED · DOWNLOADS ↓', released: 'STRIPPED · NEWER ↓', size: 'STRIPPED · PARAMETERS ↓' };
  let yAxis = Y_AXES[new URLSearchParams(location.search).get('y')] ? new URLSearchParams(location.search).get('y') : 'adoption';
  const apiStrip = () => yAxis !== 'released';
  const ranker = vals => { const s = vals.filter(v => v > 0).sort((p, q) => p - q); return v => !v || s.length < 2 ? .5 : s.findIndex(x => x >= v) / (s.length - 1); };
  const logSize = b => b > 0 ? clamp((Math.log10(b) + 2) / 5, 0, 1) : -1;   // 10M → 0 … 1T → 1
  /* items: { api, bad, dl, date, size, seed }; returns y for each */
  function yLayout(items) {
    const top = items.filter(o => !o.bad), bad = items.filter(o => o.bad);
    const api = top.filter(o => o.api), open = top.filter(o => !o.api);
    const j = o => (fr(o.seed * 3.77 + .41) - .5) * .02;
    const rDl = ranker(open.map(o => o.dl)), rBadDl = ranker(bad.map(o => o.dl));
    const rApiDate = ranker(api.map(o => o.date)), rDate = ranker(top.map(o => o.date)), rBadDate = ranker(bad.map(o => o.date));
    return items.map(o => {
      if (o.bad) {
        const v = yAxis === 'released' ? rBadDate(o.date) : yAxis === 'size' ? Math.max(0, logSize(o.size)) : rBadDl(o.dl);
        return EY - .05 - .2 * v + j(o);
      }
      if (yAxis === 'released') return o.date ? EY + .05 + .66 * rDate(o.date) + j(o) : EY + .035;
      if (o.api) return EY + .6 + .1 * rApiDate(o.date) + j(o) * .7;
      if (yAxis === 'size') { const v = logSize(o.size); return v < 0 ? EY + .035 : EY + .05 + .5 * v + j(o); }
      return EY + .05 + .5 * rDl(o.dl) + j(o);
    });
  }
  function layoutAdoption() {
    const live = AGENTS.filter(a => a.used);
    const items = live.map(a => ({ api: a.api, bad: a.revoked, dl: a.downloads, date: a.date, size: a.paramsB, seed: a.i }));
    const ys = yLayout(items), zs = zLayout(items);
    live.forEach((a, k) => { a.y = ys[k]; a.zv = zs[k]; });
  }
  /* z: the second measure, 0 (back) … 1 (front). Unknowns — API-only sizes and
     download counts, undated repos — sit on the back wall at 0. */
  function zLayout(items) {
    if (zAxis === 'size') return items.map(o => Math.max(0, logSize(o.size)));
    if (zAxis === 'released') { const r = ranker(items.map(o => o.date)); return items.map(o => o.date ? r(o.date) : 0); }
    const r = ranker(items.map(o => o.api ? 0 : o.dl));
    return items.map(o => !o.api && o.dl ? r(o.dl) : 0);
  }
  let registryTotal = 0;
  function layoutBands() {
    const counts = CLASSES.map((_, i) => AGENTS.filter(a => a.used && a.cls === i + 1).length);
    const wts = CLASSES.map((k, i) => k.reserved ? 0 : Math.max(2.4, Math.sqrt(counts[i])));
    const span = SPAN1 - SPAN0 - (NCLS - ACTIVE) * RSV_W, tot = wts.reduce((p, q) => p + q, 0);
    let x = SPAN0;
    CLASSES.forEach((k, i) => { BAND[i].x0 = x; BAND[i].w = k.reserved ? RSV_W : span * wts[i] / tot; x += BAND[i].w; });
    labels.forEach((m, i) => { m.dataset.x = BAND[i].x0 + BAND[i].w / 2; });
    bandEdges.forEach(d => { const k = +d.dataset.k; d.dataset.x = k < NCLS ? BAND[k].x0 : SPAN1; });
  }
  /* inside a band: half the model's own position (score / evidence), half its rank —
     so models with the same score spread out instead of stacking */
  const nameHash = n => { let h = 2166136261; for (let i = 0; i < n.length; i++) h = Math.imul(h ^ n.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
  function layoutX() {
    for (let c = 1; c <= NCLS; c++) {
      const set = AGENTS.filter(a => a.used && a.cls === c).sort((p, q) => (p.frac ?? .5) - (q.frac ?? .5) || nameHash(p.name) - nameHash(q.name));
      set.forEach((a, r) => {
        const f = .5 * clamp(a.frac ?? .5, 0, 1) + .5 * (set.length > 1 ? r / (set.length - 1) : .5);
        a.x = bandX(c, f) + (fr(a.i * 7.13 + .13) - .5) * .004;
      });
    }
  }
  /* census dust — every ingested model not plotted, on the same axes (rank within the whole census) */
  let dust = [];
  function layoutDust() {
    const plotted = new Set(AGENTS.filter(a => a.used).map(a => a.name));
    const rest = census.filter(r => !plotted.has(r.m.id));
    const items = rest.map(r => ({ api: !!r.api, bad: !!r.unsafe, dl: r.downloads, date: recDate(r), size: r.paramsB || 0, seed: nameHash(r.m.id) * 997 }));
    const ys = yLayout(items), zs = zLayout(items);
    dust = rest.map((r, k) => {
      const h = nameHash(r.m.id), f = .5 * clamp(bandFrac(r), 0, 1) + .5 * h;
      return { x: bandX(r.cls, f), y: ys[k], zv: zs[k], cls: r.cls, date: recDate(r), phase: r.phase || 'original' };
    });
  }
  function refresh() {
    layoutBands(); layoutX(); layoutAdoption(); layoutDust(); applyAsOf(); syncStars(); rebuildRoster();
    $('st-reg').textContent = registryTotal || AGENTS.filter(a => a.used).length;
    syncLayerCounts();
    document.querySelectorAll('#legend .lg-row .n').forEach(n => {
      const c = +n.closest('.lg-row').dataset.c;
      const k = AGENTS.filter(a => a.used && a.cls === c).length;
      n.textContent = CLASSES[c - 1].reserved && !k ? 'reserved' : '×' + k;
    });
  }
  syncStars();
  refresh();
  cxIn.placeholder = mobile ? 'Search models…' : 'Search models, owner/name or a hub URL…';
  initGL();
  if (!glOK) document.body.classList.add('nogl');
  loadRegistry();

  /* ---- frame ---- */
  let t = 0, lastNow = performance.now();

  function draw(now) {
    const dt = Math.min(((now || performance.now()) - lastNow) / 1000, .05);
    lastNow = now || performance.now();
    t += dt;
    const df = dt * 60;
    const dr = Math.pow(.885, df), dg = Math.pow(.9, df), db2 = Math.pow(.86, df);
    px = lerp(px, pxx, .05); py = lerp(py, pyy, .05);
    zoom = lerp(zoom, zoomT, .09 * df);
    pan.x = lerp(pan.x, panT.x, .12 * df); pan.y = lerp(pan.y, panT.y, .12 * df);
    zMix = reducedMotion ? +view3d : lerp(zMix, +view3d, Math.min(1, .07 * df));
    if (Math.abs(zMix - +view3d) < .002) zMix = +view3d;
    for (const k of ['yaw', 'pitch', 'dist', 'tx', 'ty', 'tz']) cam[k] = reducedMotion ? camT[k] : lerp(cam[k], camT[k], Math.min(1, .1 * df));
    camMatrix();
    for (const a of AGENTS) if (a.used) a.wz = zWorld(a.zv ?? 0);
    if (birthT < 5) birthT += dt; else if (birthIdx >= 0) birthIdx = -1;
    clock = t;
    stepTimeline(now || performance.now());

    /* periodic re-certification sweep — the registry re-classifies itself */
    const cyc = t % 34;
    const rc = !reducedMotion && cyc > 29 ? Math.sin((cyc - 29) / 5 * Math.PI) : 0;
    const ignite = 1 - rc * .8;
    const net = 1 - rc * .75;
    const glitch = reducedMotion ? 0 : .03 + rc * .3;
    const boot = 1 - Math.pow(1 - Math.min(1, t / 1.4), 3);
    const collapse = 1 - boot;

    if (glOK) renderPasses(ignite, net, glitch, collapse, dr, dg, db2);
    placeLabels();
    requestAnimationFrame(draw);
  }

  function renderPasses(ignite, net, glitch, collapse, dr, dg, db2) {
    /* pass 1 */
    gl.bindFramebuffer(gl.FRAMEBUFFER, tScene.fbo);
    gl.viewport(0, 0, cols, rows);
    bindQuad(progScene);
    const u = progScene.u;
    gl.uniform2f(u.R, cols, rows);
    gl.uniform1f(u.T, t);
    gl.uniform1f(u.Glitch, glitch);
    gl.uniform1f(u.Lum, 1.05);
    gl.uniform1f(u.Ey, EY);
    gl.uniform1f(u.Net, net);
    gl.uniform1f(u.Ignite, ignite);
    gl.uniform1f(u.Zoom, zoom);
    gl.uniform2f(u.PAN, pan.x, pan.y);
    gl.uniform1f(u.VX, VX);
    gl.uniform1f(u.NS, mobile ? .6 : .82);
    gl.uniform1f(u.Cls, filterCls);
    gl.uniform1f(u.Flat, is3d() ? Math.max(0, 1 - zMix * 4) : 1);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, nodeTex);
    gl.uniform1i(u.Nodes, 3);
    gl.uniform2f(u.PTR, px, py);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* pass 2 */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB.fbo);
    gl.viewport(0, 0, cv.width, cv.height);
    bindQuad(progStamp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tScene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbA.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.uniform1i(progStamp.u.SCENE, 0);
    gl.uniform1i(progStamp.u.FB, 1);
    gl.uniform1i(progStamp.u.ATLAS, 2);
    gl.uniform2f(progStamp.u.R, cv.width, cv.height);
    gl.uniform2f(progStamp.u.C, cols, rows);
    gl.uniform1f(progStamp.u.T, t);
    gl.uniform3f(progStamp.u.Decay, dr, dg, db2);
    gl.uniform1f(progStamp.u.Glitch, glitch);
    gl.uniform1f(progStamp.u.CellAsp, (cv.width / cols) / (cv.height / rows));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* pass 3 */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    bindQuad(progDisp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbB.tex);
    gl.uniform1i(progDisp.u.IMG, 0);
    gl.uniform2f(progDisp.u.R, cv.width, cv.height);
    gl.uniform1f(progDisp.u.T, t);
    gl.uniform1f(progDisp.u.Glitch, glitch);
    gl.uniform1f(progDisp.u.Collapse, collapse);
    gl.uniform1f(progDisp.u.Roll, W < 700 || reducedMotion ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (is3d()) drawGrid();
    drawPoints(t);
    const tmp = fbA; fbA = fbB; fbB = tmp;
  }

  /* pass 3b (3D) — the plane, its depth grid, band boundaries, the axes */
  const lnData = [];
  function drawGrid() {
    lnData.length = 0;
    const z0 = zWorld(0), z1 = zWorld(1), a = zMix;
    const seg = (x0, y0, za, x1, y1, zb, r, g, b, al) => lnData.push(x0, y0, za, r, g, b, al * a, x1, y1, zb, r, g, b, al * a);
    // plane outline + depth grid (quarters of the z measure)
    seg(SPAN0, EY, z0, SPAN1, EY, z0, .84, .93, .89, .55);
    seg(SPAN0, EY, z1, SPAN1, EY, z1, .84, .93, .89, .75);
    for (const q of [.25, .5, .75]) seg(SPAN0, EY, zWorld(q), SPAN1, EY, zWorld(q), .25, .85, .7, .16);
    // band boundaries run front to back across the plane
    for (let k = 0; k <= NCLS; k++) {
      const x = k < NCLS ? BAND[k].x0 : SPAN1, rsv = k > ACTIVE && k < NCLS;
      seg(x, EY, z0, x, EY, z1, rsv ? .54 : .25, rsv ? .49 : .85, rsv ? 1 : .7, k === 0 || k === NCLS ? .55 : .22);
    }
    // y axis up the back-left corner; a faint wall where unknowns sit (z = 0)
    seg(SPAN0, EY - .3, z0, SPAN0, EY + .78, z0, .84, .93, .89, .35);
    seg(SPAN1, EY - .3, z0, SPAN1, EY + .78, z0, .84, .93, .89, .12);
    seg(SPAN0, EY + .78, z0, SPAN1, EY + .78, z0, .84, .93, .89, .08);
    // z axis along the left edge of the plane, toward the viewer
    seg(SPAN0, EY, z0, SPAN0, EY, z1, .25, .85, .7, .7);
    // arrowheads on the three axes, in world space: they point true from any
    // side. Each is two crossed chevrons so it never vanishes edge-on.
    const arrow = (x, y, z, dx, dy, dz) => {
      const L = .028, w = .011;
      const p1 = Math.abs(dy) < .9 ? [0, 1, 0] : [1, 0, 0];
      const c1 = [dy * p1[2] - dz * p1[1], dz * p1[0] - dx * p1[2], dx * p1[1] - dy * p1[0]];
      const c2 = [dy * c1[2] - dz * c1[1], dz * c1[0] - dx * c1[2], dx * c1[1] - dy * c1[0]];
      for (const c of [c1, c2]) for (const sgn of [1, -1])
        seg(x, y, z, x - dx * L + c[0] * w * sgn, y - dy * L + c[1] * w * sgn, z - dz * L + c[2] * w * sgn, .25, .85, .7, .85);
    };
    seg(SPAN0, EY, z0, SPAN1 + .03, EY, z0, .25, .85, .7, .7);   // x along the back edge
    arrow(SPAN1 + .03, EY, z0, 1, 0, 0);
    arrow(SPAN0, EY - .3, z0, 0, -1, 0);   // −y: below the plane, more is further down
    arrow(SPAN0, EY + .78, z0, 0, 1, 0);
    arrow(SPAN0, EY, z1, 0, 0, 1);
    // drop lines: the selected star to the plane, so its depth reads
    const s = selIdx >= 0 ? AGENTS[selIdx] : null;
    if (s && s.used) {
      seg(s.x, s.y, s.wz, s.x, EY, s.wz, 1, 1, 1, .45);
      seg(s.x, EY, s.wz, SPAN0, EY, s.wz, 1, 1, 1, .18);   // across to the z axis, where its depth reads
    }
    const p = progLn;
    gl.useProgram(p.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, lnBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lnData), gl.DYNAMIC_DRAW);
    const aPos = gl.getAttribLocation(p.p, 'aPos'), aCol = gl.getAttribLocation(p.p, 'aCol');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(aCol);
    gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 28, 12);
    gl.uniformMatrix4fv(p.u.M3, false, M3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.LINES, 0, lnData.length / 7);
    gl.disable(gl.BLEND);
    gl.disableVertexAttribArray(aCol);
  }

  /* pass 4 — the stars, rebuilt each frame: census dust, cluster bubbles, single stars */
  const PAL = new Float32Array(CLASSES.flatMap(k => [1, 3, 5].map(o => parseInt(k.hex.slice(o, o + 2), 16) / 255)));
  let ptsData = new Float32Array(NODES * 6);
  /* dense groups collapse into a counted bubble; zooming (or clicking one) opens them */
  const CLUSTER_PX = 22, CLUSTER_MIN = 5;
  let bubbles = [];
  function clusterStars() {
    for (const a of AGENTS) a.hidden = false;
    applyAsOf();
    const cells = new Map();
    for (const a of AGENTS) {
      if (!a.used || a.future || !inLayers(a) || a.i === selIdx || a.i === hoverIdx || (filterCls && a.cls !== filterCls)) continue;
      const [x, y] = toScreen(a.x, a.y, a.wz);
      const k = `${Math.floor(x / CLUSTER_PX)},${Math.floor(y / CLUSTER_PX)}`;
      (cells.get(k) || cells.set(k, []).get(k)).push(a);
    }
    bubbles = [];
    for (const m of cells.values()) {
      if (m.length < CLUSTER_MIN) continue;
      const tally = {};
      for (const a of m) { a.hidden = true; tally[a.cls] = (tally[a.cls] || 0) + 1; }
      const cls = +Object.entries(tally).sort((p, q) => q[1] - p[1])[0][0];
      const avg = k => m.reduce((v, a) => v + a[k], 0) / m.length;
      bubbles.push({ wx: avg('x'), wy: avg('y'), wz: avg('wz'), cls, n: m.length });
    }
  }
  function pickBubble(sx, sy) {
    for (const b of bubbles) {
      const [x, y] = toScreen(b.wx, b.wy, b.wz), r = 4 + Math.sqrt(b.n) * 1.5 + 6;
      if ((x - sx) ** 2 + (y - sy) ** 2 < r * r) return b;
    }
    return null;
  }
  const PT = 7;   // floats per point: x y z · class kind state flare
  const ptList = [];
  function drawPoints(t) {
    clusterStars();
    ptList.length = 0;
    for (const d of dust) {
      if ((asOf && d.date > asOf) || hiddenPhases.has(d.phase)) continue;
      ptList.push([d.x, d.y, zWorld(d.zv ?? 0), d.cls, 3, 0, 0]);
    }
    for (const b of bubbles) ptList.push([b.wx, b.wy, b.wz, b.cls, 4, b.n, 0]);
    for (const a of AGENTS) {
      if (!a.used || a.hidden || a.future || !inLayers(a)) continue;
      ptList.push([a.x, a.y, a.wz ?? .5, a.cls,
        a.api ? 1 : a.phase === 'stripped' ? 5 : a.revoked ? 2 : a.phase === 'original' ? 0 : 6,
        a.i === selIdx ? 2 : a.i === hoverIdx ? 1 : 0,
        reducedMotion ? 0 : a.i === birthIdx && birthT < 2.5 ? 1 - birthT / 2.5 : a.bornT != null && clock - a.bornT < 1.6 ? 1 - (clock - a.bornT) / 1.6 : 0]);
    }
    const n = ptList.length;
    if (!n) return;
    /* in 3D, far to near so nearer stars composite over farther ones */
    if (is3d()) ptList.sort((p, q) => (M3[3] * q[0] + M3[7] * q[1] + M3[11] * q[2]) - (M3[3] * p[0] + M3[7] * p[1] + M3[11] * p[2]));
    if (ptsData.length < n * PT) ptsData = new Float32Array(n * PT * 1.5 | 0);
    ptList.forEach((p, k) => ptsData.set(p, k * PT));
    const p = progPts, u = p.u;
    gl.useProgram(p.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, ptsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, ptsData.subarray(0, n * PT), gl.DYNAMIC_DRAW);
    syncBubbleLabels();
    const aPos = gl.getAttribLocation(p.p, 'aPos'), aDat = gl.getAttribLocation(p.p, 'aDat');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, PT * 4, 0);
    gl.enableVertexAttribArray(aDat);
    gl.vertexAttribPointer(aDat, 4, gl.FLOAT, false, PT * 4, 12);
    gl.uniform1f(u.Zoom, zoom); gl.uniform1f(u.VX, VX); gl.uniform1f(u.Dpr, dpr); gl.uniform1f(u.MaxPt, maxPt);
    gl.uniform1f(u.Cls, filterCls); gl.uniform1f(u.T, reducedMotion ? 0 : t);
    gl.uniform2f(u.PAN, pan.x, pan.y); gl.uniform2f(u.PTR, px, py);
    gl.uniform3fv(u.Pal, PAL);
    gl.uniform1f(u.U3, is3d() ? 1 : 0); gl.uniform1f(u.Ref, cam.dist);
    gl.uniformMatrix4fv(u.M3, false, M3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.disable(gl.BLEND);
    gl.disableVertexAttribArray(aDat);
  }

  /* labels — screen-space, greedy collision culling in priority order:
     selected, hovered, then registry rank. Dense regions show only what fits. */
  const LB_H = 13, rects = [];
  let headerBottom = 0;   // labels never draw under the header bar
  const measureHeader = () => { headerBottom = document.querySelector('.top').getBoundingClientRect().bottom; };
  measureHeader();
  addEventListener('resize', () => requestAnimationFrame(measureHeader));
  const order = [];
  let lineageKey = '';
  function drawLineage() {
    const a = selIdx >= 0 ? AGENTS[selIdx] : null;
    const links = [];
    if (a && a.used && !a.api) {
      const id = a.name.toLowerCase();
      for (const b of AGENTS) {
        if (!b.used || b === a || b.api) continue;
        if (a.lineage && b.name.toLowerCase() === a.lineage.base.toLowerCase()) links.push([b, 'up']);
        else if (b.lineage && b.lineage.base.toLowerCase() === id) links.push([b, 'down']);
      }
    }
    const key = links.length ? `${selIdx}:${links.length}` : '';
    if (!links.length) { if (lineageKey) { lineageSvg.replaceChildren(); lineageKey = ''; } return; }
    if (key !== lineageKey) {
      lineageSvg.replaceChildren(...links.map(([, dir]) => { const l = document.createElementNS(SVGNS, 'line'); l.setAttribute('class', dir); return l; }));
      lineageKey = key;
    }
    const [ax, ay] = toScreen(a.x, a.y, a.wz);
    links.forEach(([b], k) => {
      const [bx, by] = toScreen(b.x, b.y, b.wz), l = lineageSvg.children[k];
      l.setAttribute('x1', ax); l.setAttribute('y1', ay); l.setAttribute('x2', bx); l.setAttribute('y2', by);
    });
  }
  function placeLabels() {
    const zf = Z_FRONT(), flat = !is3d();
    for (const s of labels) {
      const c = +s.dataset.c;
      const [x, y] = toScreen(+s.dataset.x, +s.dataset.y, zf);
      s.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
      s.style.opacity = !glOK ? 0 : filterCls && c !== filterCls ? .12 : 1;
    }
    {
      const [rx] = toScreen(BAND[ACTIVE].x0 + (NCLS - ACTIVE) * RSV_W / 2, 0), [, ry] = toScreen(0, EY + .76);
      rsvCap.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-260%)`;
      rsvCap.style.opacity = glOK && flat ? .6 : 0;
      const [lx0, ly] = toScreen(SPAN0, EY), [lx1] = toScreen(SPAN1, EY);
      planeLine.style.transform = `translate(${lx0}px,${ly}px)`;
      planeLine.style.width = Math.max(0, lx1 - lx0) + 'px';
      planeLine.style.opacity = glOK && flat ? 1 : 0;
    }
    drawLineage();
    /* band edges span the plot only, not the header or the panels' margins */
    const yTop = toScreen(0, EY + .84)[1], yBot = toScreen(0, EY - .32)[1];
    for (const d of bandEdges) {
      d.style.transform = `translate(${toScreen(+d.dataset.x, 0)[0]}px,${yTop}px)`;
      d.style.height = Math.max(0, yBot - yTop) + 'px';
      d.style.visibility = flat ? '' : 'hidden';
    }
    {
      const [bx, by] = toScreen(SPAN1 + .008, EY + .2);
      beyond.style.transform = `translate(${bx}px,${by}px) rotate(-90deg)`;
      beyond.style.opacity = glOK && flat ? .55 : 0;
    }
    const below = axes[2], below3d = zMix > .5;
    const belowTxt = below3d ? 'SAFETY-STRIPPED · BELOW THE PLANE' : 'SAFETY-STRIPPED ▼';   // ▼ is wrong from underneath
    if (below.textContent !== belowTxt) below.textContent = belowTxt;
    for (const s of axes) {
      const z = s.dataset.z === 'axis' ? .5 : zf;
      // in 3D the plane's caption runs along the front edge, clear of the z axis's corner
      const sx = s === below && below3d ? (SPAN0 + SPAN1) / 2 : +s.dataset.x;
      let [x, y] = toScreen(sx, +s.dataset.y, s.dataset.z === 'axis' ? zWorld(1) + .04 : z);
      if (s.dataset.z !== 'axis') x = s === axes[0] ? Math.min(x, W - 12) : Math.max(x, 12);   // the left captions stay on screen
      s.style.transform = `translate(${x}px,${y}px) ${s.dataset.tf}`;
      // the screen-relative captions (with → / ↑) are the flat view's; 3D labels its own axes
      const flatOnly = s === axes[0] || s === axes[1] || s === axes[3] || s === axes[5] || s.dataset.z === 'axis';
      s.style.opacity = !glOK ? 0 : flatOnly ? .7 * (1 - zMix) : .7;
    }
    if (zMix > .002) {
      const yw = AXIS_WORDS[yAxis], zw = AXIS_WORDS[zAxis], z0 = zWorld(0), z1 = zWorld(1);
      const at = {
        // no text arrows: on screen they'd point wrong from behind — the 3D arrowhead shows the way
        x: [SPAN1 + .05, EY, z0, 'X · CLASS · HIGHER CAPABILITY'],
        yNeg: [SPAN0, EY - .33, z0, `−Y · SAFETY-STRIPPED · ${yw.name} · ${yw.hi}`],   // below the plane, the measure runs downward
        y: [SPAN0, EY + .82, z0, `Y · ${yw.name} · ${yw.hi}`],
        z: [SPAN0, EY, z1 + .06, `Z · ${zAxis === 'size' ? 'SIZE' : zw.name} · ${zw.hi}`],
      };
      for (const [k, s] of axis3d) {
        const [wx, wy, wz, txt] = at[k];
        if (s.textContent !== txt) s.textContent = txt;
        const [x, y] = toScreen(wx, wy, wz);
        s.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
        s.style.opacity = glOK ? .95 * zMix : 0;
      }
    } else for (const [, s] of axis3d) if (s.style.opacity !== '0') s.style.opacity = 0;
    order.length = 0;
    if (selIdx >= 0) order.push(selIdx);
    if (hoverIdx >= 0 && hoverIdx !== selIdx) order.push(hoverIdx);
    for (let i = 0; i < AGENTS.length; i++) if (i !== selIdx && i !== hoverIdx) order.push(i);
    rects.length = 0;
    const budget = mobile ? (zoom > 1.6 ? 40 : zoom > 1.2 ? 16 : 8) : (zoom > 1.4 ? 180 : zoom > 1.05 ? 56 : 28);
    let nLabels = 0;
    for (const i of order) {
      const a = AGENTS[i], s = nodeLabels[i];
      const hot = i === selIdx || i === hoverIdx;
      let vis = 0;
      if (a.used && glOK && !a.hidden && !a.future && inLayers(a) && !(filterCls && a.cls !== filterCls) && (hot || nLabels < budget)) {
        const [x, y] = toScreen(a.x, a.y, a.wz);
        const w = s.textContent.length * 6.3 + 6, l = clamp(x, w / 2 + 2, W - w / 2 - 2) - w / 2, tp = y + 8;   // only the ≤budget candidates read this
        const onScreen = x > 4 && x < W - 4 && y > headerBottom && y < H - 20;
        if (onScreen && (hot || !rects.some(r => l < r[2] && l + w > r[0] && tp < r[3] && tp + LB_H > r[1]))) {
          const cx = clamp(x, w / 2 + 2, W - w / 2 - 2);
          rects.push([cx - w / 2, tp, cx + w / 2, tp + LB_H]);
          s.style.transform = `translate(${cx}px,${y}px) translate(-50%,8px)`;
          vis = hot ? 1 : .62; nLabels++;
        }
      }
      /* a label's style is written only when it changes: with the whole
         registry on the sky, most of the 2,600 are hidden every frame */
      const col = hot ? CLS_HEX[a.cls - 1] : 'var(--dim)';
      if (s._col !== col) { s.style.color = col; s._col = col; }
      if (s._vis !== vis) {
        // hidden ones leave the render tree: each label is its own compositor layer (will-change)
        s.style.display = vis ? '' : 'none';
        s.style.opacity = vis; s._vis = vis;
      }
    }
  }
  requestAnimationFrame(draw);
})();
