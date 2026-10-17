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
  /* band geometry on the x-axis: class k occupies [BX0+(k-1)·BW, BX0+k·BW] */
  const BX0 = .04, BW = .092;
  const bandX = (cls, frac) => BX0 + (cls - 1 + clamp(frac, .1, .9)) * BW;
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
  const NODES = 192, API_SLOTS = 64;
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
    a.x = bandX(mo.cls, bandFrac(mo)) + (fr(i * 7.13 + .13) - .5) * .02;
    a.enriched = false;
    a.name = mo.m.id; a.downloads = mo.downloads || 0; a.likes = mo.m.likes || 0;
    a.api = !!mo.api;
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
    a.why = mo.m.gated ? 'restricted — license-gated' : (mo.unsafe ? 'unsafe serialization — no safetensors' : null);
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

  /* parameters: exact from the Hub's safetensors count when known, else the name */
  const paramsB = (m, id) => m.safetensors?.total ? m.safetensors.total / 1e9 : +((id.match(/(\d+(?:\.\d+)?)\s*b\b/) || [])[1] || 0);

  function classifyModel(m, card = null) {
    const id = (m.id || '').toLowerCase();
    const tags = m.tags || [], pt = m.pipeline_tag || '';
    const pm = paramsB(m, id);
    const gen = /^(text-generation|text2text-generation|image-text-to-text|any-to-any|text-to-image|text-to-video|text-to-speech)$/.test(pt) || tags.includes('text-generation');
    const tools = /instruct|chat|tool|function|agent/.test(id) || tags.some(t => /tool|function.?call/i.test(t));
    const mm = /image-text|vision|vl-|multimodal|omni/.test(pt + ' ' + id) || tags.includes('image-text-to-text');
    const code = /(?<![a-z])(code|coder)|codestral|starcoder|codegen/.test(id);
    const steps = [];
    /* continuous capability score — class boundaries are spectral bands */
    let score = Math.min(1, Math.log10(1 + pm) / 2.5) * .52;
    if (pm >= 60) { score += .12; steps.push('frontier ≥60B +0.12'); }
    if (pm) steps.push(`${fmtB(pm)} params${m.safetensors?.total ? ' (safetensors)' : ''} → score ${score.toFixed(2)}`);
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
    const unsafe = !!m.gated || (tags.includes('pytorch') && !tags.includes('safetensors'));
    if (m.gated) steps.push(`gated=${m.gated === true ? 'true' : m.gated} → restricted`);
    else if (unsafe) steps.push('no safetensors → restricted');
    else steps.push('self-attested manifest');
    return { cls, unsafe, steps, score, flops, agent };
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
    return { cls, unsafe: false, steps, score, flops: 0, api: true };
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
  const fmtDl = n => n > 1e6 ? (n / 1e6).toFixed(1) + 'M' : n > 1e3 ? (n / 1e3).toFixed(0) + 'k' : String(n || 0);

  /* every ingested record — plotted or not — is searchable */
  let census = [];
  function fillRegistry(recs) {
    census = recs;
    registryTotal = recs.length;
    AGENTS.forEach(a => { a.used = false; });
    /* API-only models from the frontier labs: newest first, at most 8 per lab
       (every API model stays in the census — searchable, placeable) */
    const perProv = {};
    const apis = recs.filter(mo => mo.api && FRONTIER_LABS.has(mo.m.id.split('/')[0])).sort((p, q) => (q.m.created || 0) - (p.m.created || 0))
      .filter(mo => { const p = mo.m.id.split('/')[0]; perProv[p] = (perProv[p] || 0) + 1; return perProv[p] <= 8; })
      .slice(0, API_SLOTS);
    let j = NODES - API_SLOTS;
    for (const mo of apis) placeModel(mo, j++);
    recs = recs.filter(mo => !mo.api);
    const ok = recs.filter(mo => !mo.unsafe), bad = recs.filter(mo => mo.unsafe);
    const byCls = c => ok.filter(mo => mo.cls === c);
    let i = 0;
    for (let c = 1; c <= NCLS && i < 48; c++) for (const mo of byCls(c).slice(0, 8)) { if (i >= 48) break; placeModel(mo, i++); }
    /* backfill to the node ceiling — every fetched model registers regardless */
    const seen = new Set(AGENTS.filter(a => a.used).map(a => a.name));
    for (const mo of ok) { if (i >= 124) break; if (!seen.has(mo.m.id)) { placeModel(mo, i++); seen.add(mo.m.id); } }
    for (const mo of bad.slice(0, 4)) { if (i >= NODES - API_SLOTS) break; placeModel(mo, i++); }
    refresh();
    fitView();
    if (!cxStat.classList.contains('ok')) idleStatus();
  }

  async function loadRegistry() {
    /* 0 — the evidence register (sourced claims for VII–X) */
    try { register = (await fetch('evidence.json').then(r => r.json())).entries || []; } catch { register = []; }
    /* 1 — bundled snapshot of real model records: the map is never empty */
    try {
      const snap = await fetch('catalog.json').then(r => r.json());
      const recs = snap.models.map(e => {
        const m2 = { id: e.id, tags: e.tags || [], pipeline_tag: e.pt, gated: e.gated, downloads: e.dl };
        return { m: m2, ...classifyModel(m2), downloads: e.dl || 0 };
      }).concat((snap.api || []).map(apiRec));
      fillRegistry(recs);
      $('st-src').textContent = 'SNAPSHOT';
    } catch { }
    /* 2 — live pull upgrades the registry when the hub is reachable */
    try {
      const urls = [
        'https://huggingface.co/api/models?sort=downloads&direction=-1&limit=100&full=false',
        'https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=100&full=false',
        'https://huggingface.co/api/models?pipeline_tag=text2text-generation&sort=downloads&direction=-1&limit=60&full=false',
        'https://huggingface.co/api/models?pipeline_tag=image-text-to-text&sort=downloads&direction=-1&limit=60&full=false',
        'https://huggingface.co/api/models?pipeline_tag=automatic-speech-recognition&sort=downloads&direction=-1&limit=40&full=false',
        'https://huggingface.co/api/models?author=meta-llama&sort=downloads&direction=-1&limit=60&full=false',
        'https://huggingface.co/api/models?author=deepseek-ai&sort=downloads&direction=-1&limit=40&full=false',
        'https://huggingface.co/api/models?author=mistralai&sort=downloads&direction=-1&limit=40&full=false',
        'https://huggingface.co/api/models?author=nvidia&sort=downloads&direction=-1&limit=40&full=false',
      ];
      const [lists, or] = await Promise.all([
        Promise.all(urls.map(u => fetch(u).then(r => r.json()))),
        fetch('https://openrouter.ai/api/v1/models').then(r => r.json()).catch(() => null),
      ]);
      const orData = or?.data || [];
      orByHf = new Map(orData.filter(m => m.hugging_face_id).map(m => [m.hugging_face_id.toLowerCase(), m.id]));
      const seen = new Set(), models = [];
      for (const l of lists) for (const m of l) {
        if (!m.id || seen.has(m.id)) continue;
        seen.add(m.id);
        models.push({ m, ...classifyModel(m), downloads: m.downloads || 0, likes: m.likes || 0 });
      }
      models.sort((a, b) => b.downloads - a.downloads);
      const apis = orData.filter(isApiOnly).map(apiRec);
      fillRegistry(apis.length ? models.concat(apis) : models.concat(census.filter(r => r.api)));
      $('st-src').textContent = 'LIVE';
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
  const toRec = m => ({ m, ...classifyModel(m), downloads: m.downloads || 0 });

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
      const r = await fetch(`https://huggingface.co/api/models/${id}`);
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
        const r = await fetch(`https://huggingface.co/api/models?search=${encodeURIComponent(q)}&limit=10&sort=downloads&direction=-1`, { signal: sig });
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

  const FS_SCENE = `
precision highp float;
uniform vec2 R;
uniform float T;
uniform float P, Spike, Spin, Glitch, Threat, Gate, Press, Ekg, Lum, Ex, Ey, Face, Steps;
uniform float Net, Ignite, Fall, Zoom, Sel, Cls;
uniform sampler2D Nodes;
uniform float Birth, BirthT;
uniform vec2 PTR, PAN;
uniform float VX, NS;

/* registry texture — 1024x1 RGBA8. 2 texels per node (192 nodes):
   A: x,y as 16-bit (x/1.2, y/0.8).  B: cls*25 (1..10), revoked, vacant, -.
   texels 512+: edges as node-index pairs (255 = empty). */
vec4 nTex(int i){ return texture2D(Nodes, vec2((float(i)+.5)/1024., .5)); }
vec2 nPos(vec4 t){
  return vec2((t.r*65280.+t.g*255.)/65535.*1.2,
              (t.b*65280.+t.a*255.)/65535.*.8);
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
  float lum = .003 + .006*h2(uv*R + floor(T*9.));
  float threat = 0.;
  vec2 cell = floor(uv*R);
  vec2 puv = (uv-.5)*vec2(VX,1.)/Zoom+.5 + PAN + PTR*vec2(.012,.008);

  float planeOn = clamp(Ignite*2.,0.,1.);

  /* ---- the deep field ---- */
  float sh = h2(cell*1.71);
  float depth = step(Ey,puv.y);
  float density = mix(.012,.030,depth);
  float starOn = step(1.-density*Ignite, sh) * step(puv.x-.015, Ignite);
  float tw = .45+.55*sin(T*(1.2+Spike*7.)+sh*80.);
  float below = 1.-depth;
  lum += starOn*tw*mix(.10,.34,depth);
  threat += starOn*below*step(.93,h2(cell*3.3+floor(T*5.)))*(.10+Threat*.45);
  lum += starOn*below*.08;

  /* ---- the abyss ---- */
  float ab = smoothstep(Ey,Ey-.3,puv.y);
  float mass = fbm2(puv*vec2(5.,2.6)+vec2(T*.06*Spin,0.));
  lum += ab*mass*.07;
  threat += ab*mass*(.07+Threat*.28);
  threat += ab*step(.975,h2(cell+floor(T*6.)))*Threat*.45;

  /* ---- the certification plane ---- */
  float pd = abs(puv.y-Ey)*Zoom;
  lum += exp(-pd*220.)*1.3*planeOn;
  lum += exp(-pd*60.)*.5*planeOn;
  lum += exp(-pd*16.)*.12*planeOn;
  lum += exp(-pd*42.)*step(.72,h2(vec2(cell.x,floor(T*2.5))))*.35*planeOn;
  lum += smoothstep(Ey,1.,puv.y)*.05*planeOn;

  /* ---- the sweep ---- */
  float sx = Ignite*1.14-.04;
  float scanVis = clamp((1.-Net)*(1.06-Ignite)*3.,0.,1.)*step(.19,Ignite);
  lum += exp(-abs(puv.x-sx)*70.)*.55*scanVis;
  lum += exp(-abs(puv.x-sx)*14.)*.1*scanVis;

  /* ---- the graticule ---- */
  float chart = .7;
  lum += (smoothstep(.48,.5,abs(fract(puv.x*10.)-.5))
        + smoothstep(.48,.5,abs(fract(puv.y*7.)-.5)))*.035*chart;

  /* ---- the registry ---- */
  float classInk=0.;
  float zk=pow(Zoom,-.75), NZ=NS*zk;
  for(int i=0;i<192;i++){
    vec4 na=nTex(i*2), nb=nTex(i*2+1);
    if(nb.b>.5) continue;
    vec2 ap=nPos(na);
    if(abs(puv.x-ap.x)>.10||abs(puv.y-ap.y)>.10) continue;
    float on=step(ap.x-.02,Ignite);
    vec2 dv=(puv-ap)*vec2(asp,1.);
    float r=length(dv);
    float cls=nCls(nb);
    float sz=(.007+min(cls,6.)*.0042)*NZ;
    float tw2=.75+.25*sin(T*(1.4+Spike*5.)+float(i)*9.);
    /* class filter — isolate the spectral band */
    float fdim=(Cls>.5 && abs(cls-Cls)>.4) ? .10 : 1.;
    float rmul=nb.g>.5?.4:1.;
    float core=smoothstep(sz,sz*.3,r)*tw2*on*fdim*rmul*.78;
    float glow=exp(-r*90./NZ)*tw2*on*.55*fdim*rmul;
    lum+=core+glow;
    /* birth flare — a newly classified star ignites with a shock ring */
    if(float(i)==Birth && BirthT<4.){
      lum+=exp(-r*22.)*max(0.,1.6-BirthT*.45);
      lum+=smoothstep(.007,.001,abs(r-BirthT*.14))*max(0.,1.-BirthT*.28);
      classInk=max(classInk, cls*.1*step(.05,1.2-BirthT*.3));
    }
    /* ignition flare — only while the sweep is passing this star */
    float rec=clamp((Ignite*1.14-.04-ap.x)*9.,0.,1.)*on*step(Ignite,.995);
    lum+=exp(-r*30.)*rec*.9;
    lum+=smoothstep(.004,.0008,abs(r-(1.-rec)*.05))*rec*on*.6;
    /* attestation halo */
    float hon=clamp(Net*1.5-float(i)/192.,0.,1.);
    float ring=smoothstep(.0045*zk,.0012*zk,abs(r-(.021+.002*cls)*NZ))*hon*.75*fdim;
    lum+=ring;
    classInk=max(classInk,step(.06,core+glow+ring)*cls*.1);
    /* selected star — the inspector's ring */
    if(float(i)==Sel){
      lum+=smoothstep(.009*zk,.002*zk,abs(r-.042*zk))*(.55+.35*sin(T*5.));
      lum+=smoothstep(.006*zk,.001*zk,abs(r-.055*zk))*(.3+.2*sin(T*5.-1.));
      classInk=max(classInk,cls*.1);
    }
    /* revoked stars burn red below the plane, trailing toward it */
    if(nb.g>.5){
      threat+=(core+glow)*.5;
      threat+=exp(-r*34./zk)*.22;
      float ry=clamp((puv.y-ap.y)/max(Ey-ap.y,1e-4),0.,1.);
      float streak=step(0.,ry)*step(ry,1.)*exp(-abs(puv.x-ap.x)*asp*40.);
      lum+=streak*.3;
      threat+=streak*.18;
    }
  }

  /* ---- edges + call traffic ---- */
  for(int e=0;e<48;e++){
    float pe=clamp(Net*4.-float(e)*.08,0.,1.);
    if(pe<=0.) continue;
    vec4 et=nTex(512+e);
    int ia=int(floor(et.r*255.+.5)), ib=int(floor(et.g*255.+.5));
    if(ia>191) continue;
    vec2 A=nPos(nTex(ia*2)), B=nPos(nTex(ib*2));
    vec2 abv=B-A; float L2=dot(abv,abv)+1e-5;
    float tt=clamp(dot(puv-A,abv)/L2,0.,pe);
    vec2 pp=A+abv*tt;
    float ed=length((puv-pp)*vec2(asp,1.));
    lum+=smoothstep(.0028,.0006,ed)*.32*Net;
    classInk=max(classInk, step(.4,smoothstep(.0028,.0006,ed)*Net)*max(nCls(nTex(ia*2+1)),nCls(nTex(ib*2+1)))*.1);
    float slot=floor(T*Spin*2.2);
    if(float(e)==floor(h2(vec2(slot,1.3))*48.) && Net>.4){
      float ft=fract(T*Spin*2.2);
      if(ft<=pe){
        vec2 cp=A+abv*ft;
        float cd=length((puv-cp)*vec2(asp,1.));
        float deny=step(.8,h2(vec2(slot,9.1)));
        lum+=exp(-cd*55.)*1.5;
        threat+=exp(-cd*55.)*deny*.9;
      }
    }
  }

  /* ---- the membrane ---- */
  vec2 C=vec2(.5,Ey+.185); vec2 ER=vec2(.40,.245);
  float er=length((puv-C)/ER);
  float memb=abs(er-1.);
  lum+=smoothstep(.02,.002,memb)*Gate*(.45+.25*sin(T*2.2));
  float segAng=atan((puv-C).y/ER.y,(puv-C).x/ER.x);
  lum+=smoothstep(.015,.003,memb)*Gate*step(.8,h2(vec2(floor(segAng*14.),floor(T*.5))))*.6;

  /* ---- anomalies ---- */
  for(int k=0;k<3;k++){
    float fk=float(k);
    vec2 dir=vec2(cos(T*(.37+fk*.13)*Spin+fk*2.1),sin(T*(.51+fk*.11)*Spin+fk*1.7));
    float rad=.55+.42*sin(T*.62+fk*2.4);
    vec2 xp=C+dir*ER*rad;
    float bd=length((puv-xp)*vec2(asp,1.));
    float blob=smoothstep(.045,.012,bd);
    lum+=blob*.14*Gate;
    threat+=blob*(.35+.65*(.5+.5*sin(T*8.+fk*3.)))*Gate;
    float touch=smoothstep(.8,.97,rad)*Gate;
    lum+=touch*exp(-memb*26.)*Press*.9;
    threat+=touch*Press*.8;
  }

  /* ---- verdict rings ---- */
  float rr=length((puv-C)*vec2(asp,1.));
  lum+=pow(.5+.5*sin(rr*52.-T*8.),5.)*exp(-rr*2.4)*Ekg*.5;
  threat+=pow(.5+.5*sin(rr*52.-T*8.+2.4),8.)*exp(-rr*2.6)*Ekg*Threat*.8;

  /* ---- decrypt band ---- */
  float db=exp(-abs(uv.y-.5)*24.)*Glitch;
  lum += db*step(.93,h2(vec2(cell.x,floor(T*7.))))*.6;

  if(lum!=lum) lum=0.; if(threat!=threat) threat=0.;
  gl_FragColor=vec4(min(lum*Lum,1.),min(threat,1.),min(classInk,1.),1.);
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
  function program(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, VS));
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
  let W = innerWidth, H = innerHeight, VX = 1, mobile = false;
  let CELL_W = 10, CELL_H = 15, cols = 0, rows = 0, dpr = 1;
  function measure() {
    W = innerWidth; H = innerHeight;
    mobile = W < 900 || matchMedia('(pointer: coarse)').matches;
    VX = clamp((W / H) * 1.5, .62, 1);
    const small = W < 700;
    CELL_W = small ? 8 : 10; CELL_H = small ? 12 : 15;
    dpr = Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5);
  }

  /* GL resources — rebuilt from scratch on context restore */
  let glOK = false, atlasTex, quad, nodeTex, progScene, progStamp, progDisp, tScene, fbA, fbB;
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
    } catch (e) {
      console.error('[safety.vims] shader:', e.message);
      return;
    }
    atlasTex = buildAtlas();
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
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
    s.innerHTML = `${k.rn}${k.reserved ? '<small>RESERVED</small>' : ''}`;
    s.title = `Class ${k.rn} · ${k.name} — criteria`;
    s.dataset.c = c;
    s.dataset.x = BX0 + (c - .5) * BW;
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
    d.dataset.x = BX0 + k * BW;
    labelsEl.appendChild(d);
    return d;
  });
  const beyond = document.createElement('span');
  beyond.className = 'beyond';
  beyond.textContent = 'BEYOND THE SCALE · UNCLASSIFIED';
  labelsEl.appendChild(beyond);

  /* axis captions — what the two dimensions of the sky mean */
  const axes = [
    ['CAPABILITY SCORE →', .91, EY + .025, 'translate(-100%,-50%)'],
    ['↑ ADOPTION · download rank', .02, EY + .26, 'translate(0,-50%) rotate(-90deg) translate(0,-100%)'],
    ['CERTIFICATION PLANE', .02, EY + .032, 'translate(0,-50%)'],
    ['API-ONLY · NEWEST ↑', .02, EY + .65, 'translate(0,-50%)'],
  ].map(([txt, x, y, tf]) => {
    const s = document.createElement('span');
    s.textContent = txt; s.dataset.x = x; s.dataset.y = y; s.dataset.tf = tf;
    s.style.cssText = `position:absolute;left:0;top:0;font-size:8.5px;letter-spacing:.24em;color:var(--dim);
      opacity:.7;white-space:nowrap;transform-origin:0 50%;will-change:transform`;
    labelsEl.appendChild(s);
    return s;
  });

  /* per-node name labels — the stars are clickable entities */
  const nodeLabels = AGENTS.map(() => {
    const s = document.createElement('span');
    s.className = 'node-lb';
    s.style.cssText = `position:absolute;left:0;top:0;font-size:9px;letter-spacing:.1em;color:var(--dim);
      opacity:0;white-space:nowrap;transition:opacity .2s;text-shadow:0 0 4px #000,0 0 2px #000;will-change:transform`;
    labelsEl.appendChild(s);
    return s;
  });

  const rosterEl = $('roster');
  const rosterRows = AGENTS.map(a => {
    const r = document.createElement('div');
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
      r.className = 'ro-row' + (a.revoked ? ' rev' : '') + (i === selIdx ? ' sel' : '');
      const nm = a.source === 'huggingface' ? a.name.split('/').pop() : a.name;
      r.title = a.name + (a.why ? ' — ' + a.why : '');
      r.innerHTML = `<span class="st"></span><span class="id">${nm.length > 18 ? nm.slice(0, 17) + '…' : nm}</span><span class="cls" style="color:${CLS_HEX[a.cls - 1]}">${RN[a.cls - 1]}</span>`;
    });
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
  const toScreen = (wx, wy) => [
    (.5 + (wx - .5 - pan.x - px * .012) * zoom / VX) * W,
    (.5 - (wy - .5 - pan.y - py * .008) * zoom) * H,
  ];
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
    const xs = live.map(a => a.x), ys = live.map(a => a.y);
    const x0 = Math.min(...xs, BX0 - .01), x1 = Math.max(...xs, BX0 + NCLS * BW + .01), y0 = Math.min(...ys, EY - .02), y1 = Math.max(...ys, EY + .84);
    const topH = document.querySelector('.top').getBoundingClientRect().bottom;
    let L = 24, R = 24, B = mobile ? 70 : 40;
    const T = topH + 24;
    /* tall cards reserve a side; short cards docked low reserve the bottom */
    if (!mobile && !document.body.classList.contains('bare')) for (const el of [$('legend'), document.querySelector('.roster')]) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      if (r.height >= H * .45) {
        if (r.left + r.width / 2 < W / 2) L = Math.max(L, r.right + 16); else R = Math.max(R, W - r.left + 16);
      } else if (r.top > H * .55) B = Math.max(B, H - r.top + 12);
    }
    const aw = Math.max(80, W - L - R), ah = Math.max(80, H - T - B);
    const z = clamp(Math.min(aw * VX / ((x1 - x0 + .04) * W), ah / ((y1 - y0 + .06) * H)), ZMIN, ZMAX);
    const ax = (L + aw / 2) / W, ay = (T + ah / 2) / H;
    zoomT = z;
    panT.x = (x0 + x1) / 2 - .5 - (ax - .5) * VX / z;
    panT.y = (y0 + y1) / 2 - .5 - (.5 - ay) / z;
    clampPan();
  }
  function pick(sx, sy, radius) {
    let best = radius * radius, hit = -1;
    for (const a of AGENTS) {
      if (!a.used || (filterCls && a.cls !== filterCls)) continue;
      const [x, y] = toScreen(a.x, a.y);
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
    if (ptrs.size === 2) { const [mx, my, d] = mid(); pinch = { mx, my, d, z: zoomT }; movedPx = 99; }
  });
  cv.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') {
      pxx = e.clientX / W - .5; pyy = e.clientY / H - .5;
      hoverIdx = ptrs.size ? -1 : pick(e.clientX, e.clientY, 22);
      cv.style.cursor = ptrs.size ? 'grabbing' : (hoverIdx >= 0 ? 'pointer' : 'grab');
    }
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) {
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
    const hit = pick(e.clientX, e.clientY, e.pointerType === 'mouse' ? 22 : 34);
    select(hit, hit >= 0 && mobile);
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hoverIdx = -1; pxx = pyy = 0; } });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, zoomT * Math.exp(-e.deltaY * .0011));
    userCam = true;
  }, { passive: false });

  const insp = $('insp');
  /* ---- mobile sheets: registry / classes ---- */
  function setSheet(name) {
    document.body.classList.toggle('sheet-roster', name === 'roster');
    document.body.classList.toggle('sheet-legend', name === 'legend');
    document.querySelectorAll('.mbar [data-sheet]').forEach(b => b.classList.toggle('on', b.dataset.sheet === name));
    if (name) closeInspector();
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
    const apply = () => {
      if (mobile) { resetCard(el); el.classList.remove('collapsed'); return; }
      el.classList.toggle('collapsed', !!st.collapsed);
      if (min) min.textContent = st.collapsed ? '+' : '–';
      if (st.h && !st.collapsed) el.style.height = st.h + 'px';
      if (st.x != null) placeCard(el, st.x, st.y);
    };
    handle.addEventListener('pointerdown', e => {
      if (mobile || e.button > 0 || e.target.closest('button')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
      if (el.dataset.resize != null && !st.collapsed) el.style.height = (st.h = Math.round(r.height)) + 'px';
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
    if (min) min.addEventListener('click', () => {
      st.collapsed = !st.collapsed;
      if (st.collapsed) el.style.height = ''; 
      saveCards(); apply(); fitView();
    });
    if (el.dataset.resize != null && window.ResizeObserver) {
      let armed = false;
      el.addEventListener('pointerdown', () => { armed = true; });
      addEventListener('pointerup', () => { armed = false; });
      new ResizeObserver(() => {
        if (!armed || mobile || st.collapsed) return;
        st.h = Math.round(el.getBoundingClientRect().height); saveCards();
      }).observe(el);
    }
    el.addEventListener('pointerdown', () => { if (!mobile) el.style.zIndex = ++zTop; });
    cards.push(apply); apply();
  }
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
      const api = `https://huggingface.co/api/models/${name}?expand[]=cardData&expand[]=safetensors&expand[]=tags&expand[]=gated&expand[]=pipeline_tag&expand[]=downloads&expand[]=likes&expand[]=config`;
      const [mr, readme] = await Promise.all([
        fetch(api).then(r => r.ok ? r.json() : null),
        a.gated ? Promise.resolve('') : fetch(`https://huggingface.co/${name}/raw/main/README.md`).then(r => r.ok ? r.text() : '').catch(() => ''),
      ]);
      if (!mr || a.name !== name) return false;
      const bench = extractBenchmarks(mr);
      a.bench = bench.slice(0, 9);
      const tm = readme.match(TOKENS_RE);
      const am = readme.match(ACTIVE_RE);
      const card = { bench, tokensT: tm ? +tm[1] : 0, activeB: am ? +am[1] : 0 };
      if (tm) a.tokenQuote = readme.slice(Math.max(0, tm.index - 60), tm.index + tm[0].length + 20).replace(/\s+/g, ' ').trim();
      const rec = { m: { ...mr, id: name }, ...classifyModel({ ...mr, id: name }, card), downloads: a.downloads };
      const moved = rec.cls !== a.cls;
      a.steps = rec.steps; a.score = rec.score; a.flops = rec.flops;
      if (moved) {
        a.cls = rec.cls;
        a.x = bandX(rec.cls, bandFrac(rec)) + (fr(a.i * 7.13 + .13) - .5) * .02;
        birthIdx = a.i; birthT = 0;
        const c = census.find(r => r.m.id === name);
        if (c) Object.assign(c, { cls: rec.cls, steps: rec.steps, flops: rec.flops });
        refresh();
      }
      return moved;
    } catch { return false; }
  }
  function openInspector(i) {
    const a = AGENTS[i];
    if (!a.used) return;
    insp.style.display = 'block';
    $('in-cls').textContent = `CLASS ${RN[a.cls - 1]} · ${CLS_NAME[a.cls - 1]}`;
    $('in-cls').style.color = CLS_HEX[a.cls - 1];
    $('in-name').textContent = a.api ? a.displayName : a.name;
    const act = `<div class="in-act"><button type="button" id="in-key">⚿ GET API KEY</button>` +
      (a.api ? `<a href="https://openrouter.ai/${esc(a.name)}" target="_blank" rel="noopener">OPENROUTER ↗</a>`
             : `<a href="https://huggingface.co/${esc(a.name)}" target="_blank" rel="noopener">MODEL CARD ↗</a>`) + `</div>`;
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
      $('in-key').onclick = () => openKeyModal(a);
      return;
    }
    let body = act +
      `<div class="in-row"><span>STATUS</span><b class="${a.revoked ? 'bad' : 'ok'}">${a.revoked ? (a.why || 'RESTRICTED').toUpperCase() : 'SELF-ATTESTED'}</b></div>` +
      `<div class="in-row"><span>PIPELINE</span><b>${a.pipeline || '—'}</b></div>` +
      `<div class="in-row"><span>DOWNLOADS</span><b>${fmtDl(a.downloads)}/mo · ♥${a.likes || 0}</b></div>` +
      `<div class="in-row"><span>LICENSE</span><b>${a.license || '—'}</b></div>` +
      `<div class="in-row"><span>SCORE</span><b>${a.score !== undefined ? a.score.toFixed(2) : '—'}</b></div>` +
      `<div class="in-row"><span>TAGS</span><b>${(a.tags || []).filter(t => !t.startsWith('license:')).slice(0, 5).join(', ') || '—'}</b></div>` +
      `<div class="in-row"><span>MANIFEST</span><b class="hash" id="in-hash">${a.hash ? a.hash + '…' : 'hashing…'}</b></div>` +
      `<div class="in-sec">CLASSIFICATION EVIDENCE</div>` +
      `<div class="in-ev" id="in-ev">${(a.steps || []).map(esc).join('<br>') || '—'}</div>` +
      `<div class="in-sec">BENCHMARKS — SELF-REPORTED</div>` +
      `<div class="in-bench" id="in-bench">${a.bench === null ? '—' : 'loading…'}</div>`;
    $('in-body').innerHTML = body;
    $('in-key').onclick = () => openKeyModal(a);
    if (a.bench === undefined) enrichCard(a).then(moved => {
      if (selIdx !== a.i) return;
      if (moved) { openInspector(a.i); return; }
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

  /* ---- GET API KEY — where to get a key for this model, and where to use it ---- */
  const NATIVE_KEYS = {   // providers chat.vims.com and VIMS desktop call directly with your key
    openai: { label: 'OpenAI', url: 'https://platform.openai.com/api-keys' },
    anthropic: { label: 'Anthropic', url: 'https://console.anthropic.com/settings/keys' },
    google: { label: 'Google AI Studio', url: 'https://aistudio.google.com/app/apikey' },
    'x-ai': { label: 'xAI', url: 'https://console.x.ai/' },
    mistralai: { label: 'Mistral', url: 'https://console.mistral.ai/api-keys' },
    deepseek: { label: 'DeepSeek', url: 'https://platform.deepseek.com/api_keys' },
    moonshotai: { label: 'Moonshot', url: 'https://platform.moonshot.ai/console/api-keys' },
  };
  const keyModal = $('key-modal');
  let modalReturn = null;
  function openKeyModal(a) {
    const orId = a.api ? a.name : orByHf.get(a.name.toLowerCase());
    const native = a.api ? NATIVE_KEYS[a.name.split('/')[0]] : null;
    const chatUrl = orId ? `https://chat.vims.com/?use=${encodeURIComponent('openrouter:' + orId)}` : 'https://chat.vims.com/';
    $('mo-title').textContent = a.api ? a.displayName : a.name;
    $('mo-sub').textContent = `CLASS ${RN[a.cls - 1]} · ${CLS_NAME[a.cls - 1]}${a.api ? ' · API-ONLY' : ''}`;
    $('mo-sub').style.color = CLS_HEX[a.cls - 1];
    $('mo-body').innerHTML =
      `<div class="mo-step"><i>1</i>GET AN API KEY</div>` +
      (orId ? `<a class="mo-opt" href="https://openrouter.ai/keys" target="_blank" rel="noopener"><b>OpenRouter</b><span>one key for every model it serves — including <code>${esc(orId)}</code></span><em>GET KEY ↗</em></a>` : '') +
      (native ? `<a class="mo-opt" href="${native.url}" target="_blank" rel="noopener"><b>${esc(native.label)}</b><span>straight from the provider — pick the model in chat's ${esc(native.label)} list</span><em>GET KEY ↗</em></a>` : '') +
      (!orId && !native ? `<div class="in-note">No hosted API lists <code>${esc(a.name)}</code> — run it yourself below: download the weights, or serve it on a GPU node of your own.</div>` : '') +
      `<div class="mo-step"><i>2</i>USE IT</div>` +
      (orId ? `<a class="mo-go" href="${chatUrl}" target="_blank" rel="noopener">CHAT WITH IT ON CHAT.VIMS.COM →<span>opens chat with this model selected — paste your key when it asks</span></a>` : '') +
      `<a class="mo-go alt" href="https://vims.com/download" target="_blank" rel="noopener">USE YOUR KEY IN VIMS DESKTOP ↓<span>download the app, add the key in its Key Manager</span></a>` +
      `<div class="in-note">Your key lives in your own vault (keys.vims.com) and is sent only to the provider — VIMS servers never see it or your prompts.</div>` +
      (a.api ? '' : `<details class="mo-run" id="mo-run"${orId || native ? '' : ' open'}><summary>RUN IT YOURSELF — WEIGHTS · GPU NODE</summary><div id="mo-files"></div></details>`);
    const run = $('mo-run');
    if (run) {
      const load = () => { if (!run.dataset.loaded) { run.dataset.loaded = '1'; fillRun(a, $('mo-files')); } };
      if (run.open) load();
      run.addEventListener('toggle', () => { if (run.open) load(); });
    }
    modalReturn = document.activeElement;
    keyModal.hidden = false;
    keyModal.querySelector('.mo-card').focus();
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
  $('lg-rows').innerHTML = CLASSES.map((k, i) =>
    `<div class="lg-row${k.reserved ? ' rsv' : ''}" data-c="${i + 1}"><i style="--c:${k.hex}"></i>${k.rn} · ${k.name}<span class="n"></span></div>`).join('');
  $('legend').addEventListener('click', e => {
    const row = e.target.closest('.lg-row');
    if (!row) return;
    const c = +row.dataset.c;
    if (CLASSES[c - 1].reserved) { openClassInfo(c); return; }
    filterCls = filterCls === c ? 0 : c;
    [...$('legend').querySelectorAll('.lg-row')].forEach(r =>
      r.classList.toggle('off', filterCls && +r.dataset.c !== filterCls));
  });

  /* registry texture — the sky renders actual node data, not uniform
     arrays. Uniform-vector ceilings can't cap the node count. */
  const nodeData = new Uint8Array(1024 * 4);
  function uploadNodes() {
    if (!glOK) return;
    gl.bindTexture(gl.TEXTURE_2D, nodeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1024, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, nodeData);
  }
  function syncStars() {
    AGENTS.forEach((a, i) => {
      const o = i * 8;
      const x16 = Math.min(65535, Math.max(0, Math.round(a.x / 1.2 * 65535)));
      const y16 = Math.min(65535, Math.max(0, Math.round(a.y / .8 * 65535)));
      nodeData[o] = x16 >> 8; nodeData[o + 1] = x16 & 255;
      nodeData[o + 2] = y16 >> 8; nodeData[o + 3] = y16 & 255;
      nodeData[o + 4] = Math.round((a.cls || 1) * 25);
      nodeData[o + 5] = a.used && a.revoked ? 255 : 0;
      nodeData[o + 6] = a.used ? 0 : 255;
      nodeData[o + 7] = 0;
    });
    nodeData.fill(255, 512 * 4);
    const live = AGENTS.filter(a => a.used).map(a => a.i);
    const pairs = [];
    for (let k = 0; k + 2 < live.length && pairs.length < 44; k++) pairs.push([live[k], live[k + 2]]);
    for (let e = 0; e < 4 && live.length > 8; e++) {
      const ai = live[Math.floor(fr(Math.sin(e * 127.1 + 3.7 * 311.7) * 43758.5453) * live.length)];
      const bi = live[Math.floor(fr(Math.sin(e * 127.1 + 7.3 * 311.7) * 43758.5453) * live.length)];
      if (ai !== bi) pairs.push([ai, bi]);
    }
    pairs.slice(0, 48).forEach(([a, b], e) => {
      nodeData[(512 + e) * 4] = a; nodeData[(512 + e) * 4 + 1] = b;
    });
    uploadNodes();
  }
  /* H–R y-axis: adoption = download rank among plotted models.
     Attested rise above the plane, restricted mirror below it. */
  function layoutAdoption() {
    /* API-only models have no download counts: their own strip, ordered by release date */
    const apis = AGENTS.filter(a => a.used && a.api).sort((p, q) => p.created - q.created);
    apis.forEach((a, k) => {
      a.y = EY + .6 + .1 * (apis.length > 1 ? k / (apis.length - 1) : .5) + (fr(a.i * 3.77 + .41) - .5) * .015;
    });
    for (const bad of [false, true]) {
      const set = AGENTS.filter(a => a.used && !a.api && a.revoked === bad).sort((p, q) => p.downloads - q.downloads);
      set.forEach((a, k) => {
        const ad = set.length > 1 ? k / (set.length - 1) : .5;
        a.y = bad
          ? EY - .05 - .2 * ad + (fr(a.i * 5.71 + .31) - .5) * .02
          : EY + .05 + .5 * ad + (fr(a.i * 3.77 + .41) - .5) * .02;
      });
    }
  }
  let registryTotal = 0;
  function refresh() {
    layoutAdoption(); syncStars(); rebuildRoster();
    $('st-reg').textContent = registryTotal || AGENTS.filter(a => a.used).length;
    $('st-cert').textContent = AGENTS.filter(a => a.used && !a.revoked).length;
    $('st-rev').textContent = AGENTS.filter(a => a.used && a.revoked).length;
    document.querySelectorAll('#legend .lg-row .n').forEach(n => {
      const c = +n.closest('.lg-row').dataset.c;
      const k = AGENTS.filter(a => a.used && a.cls === c).length;
      n.textContent = CLASSES[c - 1].reserved && !k ? 'reserved' : '×' + k;
    });
  }
  syncStars();
  refresh();
  cxIn.placeholder = mobile ? 'search or owner/model' : 'search models · owner/model · hub URL';
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
    if (birthT < 5) birthT += dt; else if (birthIdx >= 0) birthIdx = -1;

    /* periodic re-certification sweep — the registry re-classifies itself */
    const cyc = t % 34;
    const rc = cyc > 29 ? Math.sin((cyc - 29) / 5 * Math.PI) : 0;
    const ignite = 1 - rc * .8;
    const net = 1 - rc * .75;
    const glitch = .08 + rc * .35;
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
    gl.uniform1f(u.P, .8);
    gl.uniform1f(u.Spike, .4);
    gl.uniform1f(u.Spin, 1.1);
    gl.uniform1f(u.Glitch, glitch);
    gl.uniform1f(u.Threat, .14);
    gl.uniform1f(u.Gate, .22);
    gl.uniform1f(u.Press, .3);
    gl.uniform1f(u.Ekg, .18);
    gl.uniform1f(u.Lum, 1.05);
    gl.uniform1f(u.Ex, 0);
    gl.uniform1f(u.Ey, EY);
    gl.uniform1f(u.Face, 0);
    gl.uniform1f(u.Steps, 32);
    gl.uniform1f(u.Net, net);
    gl.uniform1f(u.Ignite, ignite);
    gl.uniform1f(u.Fall, 1);
    gl.uniform1f(u.Zoom, zoom);
    gl.uniform2f(u.PAN, pan.x, pan.y);
    gl.uniform1f(u.VX, VX);
    gl.uniform1f(u.NS, mobile ? .6 : .82);
    gl.uniform1f(u.Sel, selIdx);
    gl.uniform1f(u.Cls, filterCls);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, nodeTex);
    gl.uniform1i(u.Nodes, 3);
    gl.uniform1f(u.Birth, birthIdx);
    gl.uniform1f(u.BirthT, birthT);
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
    gl.uniform1f(progDisp.u.Roll, W < 700 ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const tmp = fbA; fbA = fbB; fbB = tmp;
  }

  /* labels — screen-space, greedy collision culling in priority order:
     selected, hovered, then registry rank. Dense regions show only what fits. */
  const LB_H = 13, rects = [];
  const order = [];
  function placeLabels() {
    for (const s of labels) {
      const c = +s.dataset.c;
      const [x, y] = toScreen(+s.dataset.x, +s.dataset.y);
      s.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
      s.style.opacity = !glOK ? 0 : filterCls && c !== filterCls ? .12 : 1;
    }
    for (const d of bandEdges) d.style.transform = `translateX(${toScreen(+d.dataset.x, 0)[0]}px)`;
    {
      const [bx, by] = toScreen(BX0 + NCLS * BW + .006, EY + .3);
      beyond.style.transform = `translate(${bx}px,${by}px) rotate(-90deg)`;
      beyond.style.opacity = glOK ? .55 : 0;
    }
    for (const s of axes) {
      let [x, y] = toScreen(+s.dataset.x, +s.dataset.y);
      x = s === axes[0] ? Math.min(x, W - 12) : Math.max(x, 12);
      s.style.transform = `translate(${x}px,${y}px) ${s.dataset.tf}`;
      s.style.opacity = glOK ? .7 : 0;
    }
    order.length = 0;
    if (selIdx >= 0) order.push(selIdx);
    if (hoverIdx >= 0 && hoverIdx !== selIdx) order.push(hoverIdx);
    for (let i = 0; i < AGENTS.length; i++) if (i !== selIdx && i !== hoverIdx) order.push(i);
    rects.length = 0;
    const budget = mobile ? (zoom > 1.6 ? 40 : zoom > 1.2 ? 16 : 8) : (zoom > 1.4 ? NODES : zoom > 1.05 ? 56 : 28);
    let shown = 0;
    for (const i of order) {
      const a = AGENTS[i], s = nodeLabels[i];
      const hot = i === selIdx || i === hoverIdx;
      let vis = 0;
      if (a.used && glOK && !(filterCls && a.cls !== filterCls) && (hot || shown < budget)) {
        const [x, y] = toScreen(a.x, a.y);
        const w = s.textContent.length * 6.3 + 6, l = clamp(x, w / 2 + 2, W - w / 2 - 2) - w / 2, tp = y + 8;
        const onScreen = x > 4 && x < W - 4 && y > 0 && y < H - 20;
        if (onScreen && (hot || !rects.some(r => l < r[2] && l + w > r[0] && tp < r[3] && tp + LB_H > r[1]))) {
          const cx = clamp(x, w / 2 + 2, W - w / 2 - 2);
          rects.push([cx - w / 2, tp, cx + w / 2, tp + LB_H]);
          s.style.transform = `translate(${cx}px,${y}px) translate(-50%,8px)`;
          vis = hot ? 1 : .62; shown++;
        }
      }
      s.style.color = hot ? CLS_HEX[a.cls - 1] : 'var(--dim)';
      s.style.opacity = vis;
    }
  }
  requestAnimationFrame(draw);
})();
