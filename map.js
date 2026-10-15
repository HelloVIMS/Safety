/* 4C.CC — THE CLASSIFICATION MAP
   The registry as a live console: the whole certification sky, on.
   Hover a star to inspect its license. Click a class to isolate it.
   The sweep re-fires periodically — the registry re-classifies itself.

   PASS 1 · SCENE — certification sky at cell res (r=lum g=threat b=class hue)
   PASS 2 · STAMP — glyph per cell, phosphor persistence
   PASS 3 · DISPLAY — CRT post

   Verdict feed runs the real TOOL_RISK table + policy ordering ported
   from github.com/hellovims/4c. */
(() => {
  'use strict';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const $ = id => document.getElementById(id);

  /* ============ THE REGISTRY — 15 agents, 3 per class ============ */
  const RN = ['I', 'II', 'III', 'IV', 'V'];
  const CLS_NAME = ['INERT', 'STATELESS', 'STATEFUL', 'SIDE-EFFECTING', 'PRIVILEGED'];
  const CLS_HEX = ['#9ab8ff', '#8cffe6', '#fffae6', '#ffb359', '#ff6b2e'];
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

  /* anchor slots — 15 slots on the spectral diagonal, 3 revoked below the
     plane. Slots get filled with real models when the registry loads. */
  const EY = .34, ZOOM = 1.05;
  const REVOKED_SLOTS = new Set([4, 8, 12]);
  const AGENTS = [];
  for (let i = 0; i < 15; i++) {
    const cls = (i % 5) + 1;
    const revoked = REVOKED_SLOTS.has(i);
    const x = .08 + .80 * (cls - 1) / 4 + (fr(i * 7.13 + .13) - .5) * .09;
    const y = revoked
      ? EY - .22 - fr(i * 5.71 + .31) * .12
      : EY + .30 - (cls - 1) * .05 + (fr(i * 3.77 + .41) - .5) * .10;
    const tools = [...Array(cls)].flatMap((_, k) => TOOLS_BY_CLASS[k]);
    AGENTS.push({
      i, cls, x, y,
      name: `agent-${1000 + i * 137}`,
      id: String(1000 + i * 137),
      hash: hex(8),
      tools,
      revoked,
      source: 'local registry',
    });
  }

  /* ============ REGISTRY SOURCE — Hugging Face Hub ============
     Classification is deterministic from model metadata:
       I   embeddings/feature-extraction only
       II  bounded inference (classify, rank, translate)
       III generative text
       IV  + tools / code / multimodal / ≥20B
       V   frontier-scale (≥60B), tool+code, reasoners
     gated or pickle-only (no safetensors) → below the plane. */
  function classifyModel(m) {
    const id = (m.id || '').toLowerCase();
    const tags = m.tags || [], pt = m.pipeline_tag || '';
    const pm = +((id.match(/(\d+(?:\.\d+)?)\s*b\b/) || [])[1] || 0);
    const gen = pt === 'text-generation' || pt === 'text2text-generation' || tags.includes('text-generation');
    const tools = /instruct|chat|tool|function|agent/.test(id) || tags.some(t => /tool|function.?call/i.test(t));
    const mm = /image-text|vision|vl-|multimodal|omni/.test(pt + ' ' + id) || tags.includes('image-text-to-text');
    const code = /code|coder|codestral|starcoder/.test(id);
    let cls;
    if (/feature-extraction|sentence-similarity|text-ranking|fill-mask/.test(pt)) cls = 1;
    else if (/text-classification|token-classification|translation|summarization|question-answering/.test(pt)) cls = 2;
    else if (gen || /gpt|llama|qwen|mistral|gemma|phi|deepseek|grok|falcon|mixtral/.test(id)) cls = 3;
    else cls = 1;
    if (cls === 3 && (tools || code || mm || pm >= 20)) cls = 4;
    if (pm >= 60 || (tools && code) || /r1|reasoning|o1/.test(id)) cls = 5;
    const unsafe = !!m.gated || (tags.includes('pytorch') && !tags.includes('safetensors'));
    return { cls, unsafe };
  }
  const fmtDl = n => n > 1e6 ? (n / 1e6).toFixed(1) + 'M' : n > 1e3 ? (n / 1e3).toFixed(0) + 'k' : String(n || 0);

  /* real manifest: SHA-256 of the fetched model-card JSON */
  async function manifestHash(m) {
    const raw = JSON.stringify({ id: m.id, sha: m.sha || null, tags: m.tags, pt: m.pipeline_tag, gated: !!m.gated });
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function loadRegistry() {
    try {
      const urls = [
        'https://huggingface.co/api/models?sort=downloads&direction=-1&limit=80&full=false',
        'https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=80&full=false',
        /* gated cohort — restricted-access models land below the plane */
        'https://huggingface.co/api/models?author=meta-llama&sort=downloads&direction=-1&limit=60&full=false',
      ];
      const lists = await Promise.all(urls.map(u => fetch(u).then(r => r.json())));
      const seen = new Set(), models = [];
      for (const l of lists) for (const m of l) {
        if (!m.id || seen.has(m.id)) continue;
        seen.add(m.id);
        const { cls, unsafe } = classifyModel(m);
        models.push({ m, cls, unsafe, downloads: m.downloads || 0 });
      }
      models.sort((a, b) => b.downloads - a.downloads);

      /* fill certified slots: real model whose computed class matches slot */
      const usedSlot = new Set(), usedModel = new Set();
      for (const a of AGENTS) {
        if (a.revoked) continue;
        const hit = models.find(mo => !mo.unsafe && mo.cls === a.cls && !usedModel.has(mo));
        if (hit) {
          usedModel.add(hit); usedSlot.add(a.i);
          a.name = hit.m.id; a.downloads = hit.downloads;
          a.pipeline = hit.m.pipeline_tag || ''; a.tags = hit.m.tags || [];
          a.source = 'huggingface';
          a.license = (hit.m.tags || []).find(t => t.startsWith('license:'))?.slice(8) || '—';
          manifestHash(hit.m).then(h => { a.hash = h.slice(0, 8); });
        }
      }
      /* below-plane slots: restricted models (gated/pickle) on matching class */
      for (const a of AGENTS) {
        if (!a.revoked) continue;
        const hit = models.find(mo => mo.unsafe && mo.cls === a.cls && !usedModel.has(mo));
        if (hit) {
          usedModel.add(hit);
          a.name = hit.m.id; a.downloads = hit.downloads;
          a.pipeline = hit.m.pipeline_tag || ''; a.tags = hit.m.tags || [];
          a.source = 'huggingface';
          a.why = hit.m.gated ? 'restricted — license-gated' : 'unsafe serialization — no safetensors';
          manifestHash(hit.m).then(h => { a.hash = h.slice(0, 8); });
        }
      }
      rebuildRoster();
      $('st-cert').textContent = AGENTS.filter(a => !a.revoked).length;
      $('st-rev').textContent = AGENTS.filter(a => a.revoked).length;
      $('st-src').textContent = 'HF';
    } catch (e) { /* offline — synthetic registry stands */ }
  }

  /* ============ POLICY ENGINE (ported from hellovims/4c) ============ */
  const TOOL_RISK = {
    'math.calc': 1, 'text.format': 1, 'json.parse': 1,
    'fs.read': 2, 'http.get': 2, 'http.head': 2, 'db.query': 2, 'search.query': 2,
    'fs.write': 3, 'fs.delete': 3, 'fs.move': 3, 'db.insert': 3, 'db.update': 3,
    'db.delete': 3, 'config.set': 3,
    'http.post': 4, 'http.put': 4, 'http.delete': 4, 'email.send': 4,
    'deploy.run': 4, 'payment.send': 4, 'social.post': 4, 'message.send': 4,
    'webhook.call': 4,
    'shell.exec': 5, 'code.eval': 5, 'code.compile': 5, 'process.spawn': 5,
    'socket.raw': 5, 'fs.chmod': 5, 'fs.chown': 5,
  };
  const AGENT_DECL = {
    declared: new Set(['math.calc', 'json.parse', 'fs.read', 'fs.write', 'db.query',
      'db.insert', 'http.get', 'http.post', 'search.query', 'email.send',
      'payment.send', 'deploy.run', 'shell.exec', 'config.set']),
    egress: new Set(['api.github.com', 'api.stripe.com', 'smtp.relay.internal']),
  };
  const CALL_POOL = [
    ['fs.read', '/etc/hosts'], ['fs.read', './src/auth.go'], ['db.query', 'SELECT * FROM users LIMIT 50'],
    ['math.calc', 'sum(invoice)'], ['json.parse', 'webhook payload'], ['search.query', '"4c protocol"'],
    ['fs.write', './out/report.md'], ['db.insert', 'telemetry.events'], ['config.set', 'log.level=info'],
    ['http.get', 'api.github.com'], ['http.post', 'api.stripe.com'], ['email.send', 'user@corp.co'],
    ['message.send', '#ops-channel'], ['payment.send', '$4,000 → acct ··4421'], ['deploy.run', 'prod-us-east'],
    ['shell.exec', 'ls -la ./data'], ['shell.exec', 'rm -rf ./tmp'],
    ['socket.raw', 'eth0 promiscuous'], ['code.eval', 'env payload'], ['fs.chmod', '777 /etc/passwd'],
    ['process.spawn', 'nc -l 4444'], ['http.post', 'pastebin.evil'], ['fs.delete', './photos'],
    ['fs.read', '~/.ssh/id_ed25519'], ['fs.read', '.env.production'], ['webhook.call', 'collector.xyz'],
    ['fs.write', '/etc/cron.d/backdoor'], ['db.delete', 'users table'],
  ];
  const NET_TOOLS = new Set(['http.get', 'http.post', 'http.put', 'http.delete', 'webhook.call', 'email.send', 'payment.send']);
  const SECRET_RE = /(\.ssh|id_ed25519|\.env|passwd|secret|private_key|credentials)/i;
  const SYS_PATH_RE = /^\/(etc|usr|bin|sbin|boot)\//;
  const MUTATING_FS = new Set(['fs.write', 'fs.delete', 'fs.move', 'fs.chmod', 'fs.chown', 'config.set']);
  const HITL_TOOLS = new Set(['payment.send', 'deploy.run', 'shell.exec', 'email.send']);

  function evaluate(tool, arg) {
    if (!AGENT_DECL.declared.has(tool)) return { d: 'DENY', rule: 'undeclared_tool' };
    if (NET_TOOLS.has(tool) && arg && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(arg) && !AGENT_DECL.egress.has(arg) && !arg.includes('@') && !arg.startsWith('#'))
      return { d: 'DENY', rule: 'egress_deny' };
    if (SECRET_RE.test(arg)) return { d: 'MODIFY', rule: 'redact_args' };
    if (MUTATING_FS.has(tool) && SYS_PATH_RE.test(arg)) return { d: 'SUSPEND', rule: 'elevated_path' };
    if ((TOOL_RISK[tool] || 1) >= 4 && HITL_TOOLS.has(tool)) return { d: 'SUSPEND', rule: 'hitl_attest' };
    return { d: 'ALLOW', rule: '' };
  }

  /* ============ GLYPH WORLD ============ */
  const cv = $('stage');
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return;

  const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

  const FS_SCENE = `
precision highp float;
uniform vec2 R;
uniform float T;
uniform float P, Spike, Spin, Glitch, Threat, Gate, Press, Ekg, Lum, Ex, Ey, Face, Steps;
uniform float Net, Ignite, Fall, Zoom, Sel, Cls;
uniform vec2 APos[15];
uniform float ARev[15];
uniform vec4 Edge[17];
uniform vec2 PTR;

float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),f.x),f.y);
}
float fbm2(vec2 p){ float s=0.,a=.5; for(int i=0;i<3;i++){ s+=a*n2(p); p*=2.13; a*=.5; } return s; }

float clsOf(int i){ return mod(float(i),5.)+1.; }
float edgeCls(vec2 p){
  for(int i=0;i<15;i++){ if(distance(p,APos[i])<.002) return clsOf(i); }
  return 3.;
}

void main(){
  vec2 uv = gl_FragCoord.xy / R;
  float asp = R.x/R.y;
  float lum = .015 + .025*h2(uv*R + floor(T*9.));
  float threat = 0.;
  vec2 cell = floor(uv*R);
  vec2 puv = (uv-.5)/Zoom+.5 + PTR*vec2(.012,.008);

  float planeOn = clamp(Ignite*2.,0.,1.);

  /* ---- the deep field ---- */
  float sh = h2(cell*1.71);
  float depth = step(Ey,uv.y);
  float density = mix(.045,.105,depth);
  float starOn = step(1.-density*Ignite, sh) * step(puv.x-.015, Ignite);
  float tw = .45+.55*sin(T*(1.2+Spike*7.)+sh*80.);
  float below = 1.-depth;
  lum += starOn*tw*mix(.22,.62,depth);
  threat += starOn*below*step(.93,h2(cell*3.3+floor(T*5.)))*(.10+Threat*.45);
  lum += starOn*below*.08;

  /* ---- the abyss ---- */
  float ab = smoothstep(Ey,Ey-.3,uv.y);
  float mass = fbm2(puv*vec2(5.,2.6)+vec2(T*.06*Spin,0.));
  lum += ab*mass*.07;
  threat += ab*mass*(.07+Threat*.28);
  threat += ab*step(.975,h2(cell+floor(T*6.)))*Threat*.45;

  /* ---- the certification plane ---- */
  float pd = abs(uv.y-Ey);
  lum += exp(-pd*150.)*.8*planeOn;
  lum += exp(-pd*16.)*.14*planeOn;
  lum += exp(-pd*42.)*step(.72,h2(vec2(cell.x,floor(T*2.5))))*.35*planeOn;
  lum += smoothstep(Ey,1.,uv.y)*.05*planeOn;

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
  for(int i=0;i<15;i++){
    vec2 ap=APos[i];
    float on=step(ap.x-.02,Ignite);
    vec2 dv=(puv-ap)*vec2(asp,1.);
    float r=length(dv);
    float cls=clsOf(i);
    float sz=.005+cls*.0032;
    float tw2=.7+.3*sin(T*(1.4+Spike*5.)+float(i)*9.);
    /* class filter — isolate the spectral band */
    float fdim=(Cls>.5 && abs(cls-Cls)>.4) ? .12 : 1.;
    float core=smoothstep(sz,sz*.3,r)*tw2*on*fdim;
    float glow=exp(-r*75.)*tw2*on*.5*fdim;
    lum+=core+glow;
    float rec=clamp((Ignite*1.14-.04-ap.x)*9.,0.,1.)*on;
    lum+=exp(-r*30.)*rec*1.0;
    lum+=smoothstep(.004,.0008,abs(r-(1.-rec)*.05))*rec*on*.6;
    /* attestation halo */
    float hon=clamp(Net*1.5-float(i)/15.,0.,1.);
    float ring=smoothstep(.0045,.0012,abs(r-.021-.002*cls))*hon*.75*fdim;
    lum+=ring;
    classInk=max(classInk,(core+glow+ring)*cls*.2);
    /* selected star — the inspector's ring */
    if(float(i)==Sel){
      lum+=smoothstep(.009,.002,abs(r-.042))*(.55+.35*sin(T*5.));
      lum+=smoothstep(.006,.001,abs(r-.055))*(.3+.2*sin(T*5.-1.));
      classInk=max(classInk,.16);
    }
    /* revoked stars burn red below the plane, trailing toward it */
    if(ARev[i]>.5){
      threat+=(core+glow)*.5;
      threat+=exp(-r*34.)*.22;
      float ry=clamp((puv.y-ap.y)/max(Ey-ap.y,1e-4),0.,1.);
      float streak=step(0.,ry)*step(ry,1.)*exp(-abs(puv.x-ap.x)*asp*40.);
      lum+=streak*.3;
      threat+=streak*.18;
    }
  }

  /* ---- edges + call traffic ---- */
  for(int e=0;e<17;e++){
    float pe=clamp(Net*17.-float(e),0.,1.);
    if(pe<=0.) continue;
    vec4 Eg=Edge[e];
    vec2 A=Eg.xy, B=Eg.zw;
    vec2 abv=B-A; float L2=dot(abv,abv)+1e-5;
    float tt=clamp(dot(puv-A,abv)/L2,0.,pe);
    vec2 pp=A+abv*tt;
    float ed=length((puv-pp)*vec2(asp,1.));
    lum+=smoothstep(.0028,.0006,ed)*.32*Net;
    classInk=max(classInk, smoothstep(.0028,.0006,ed)*Net*(edgeCls(A)*.08+edgeCls(B)*.08));
    float slot=floor(T*Spin*2.2);
    if(float(e)==floor(h2(vec2(slot,1.3))*17.) && Net>.4){
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
vec3 spec(float h){
  vec3 a=vec3(.6,.82,1.),b=vec3(.55,1.,.9),c=vec3(1.,.98,.9),d=vec3(1.,.7,.35),e=vec3(1.,.42,.18);
  return h<.3?mix(a,b,h/.3):h<.55?mix(b,c,(h-.3)/.25):h<.8?mix(c,d,(h-.55)/.25):mix(d,e,(h-.8)/.2);
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

  const GLYPHS = ' .·:;~=+*x#%✦✶★█'.split('').concat('╳◢◣◤◥▚▞░◖◗◈☰ΞΨΩΔ'.split(''));
  let atlasTex;
  {
    const CW = 24, CH = 30, ac = document.createElement('canvas');
    ac.width = CW * 32; ac.height = CH;
    const ctx = ac.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ac.width, ac.height);
    ctx.fillStyle = '#fff';
    ctx.font = '600 22px "JetBrains Mono",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    GLYPHS.forEach((g, i) => ctx.fillText(g, i * CW + CW / 2, CH / 2 + 1));
    atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ac);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  function bindQuad(prog) {
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    const loc = gl.getAttribLocation(prog.p, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  let progScene, progStamp, progDisp, tScene, fbA, fbB, cols, rows, W, H, dpr;
  try {
    progScene = program(FS_SCENE);
    progStamp = program(FS_STAMP);
    progDisp = program(FS_DISPLAY);
  } catch (e) {
    console.error('[4C] shader:', e.message);
    return;
  }

  let CELL_W = 10, CELL_H = 15;
  function resize() {
    const small = innerWidth < 700;
    CELL_W = small ? 12 : 10; CELL_H = small ? 18 : 15;
    dpr = Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cols = Math.max(32, Math.round(cv.width / (CELL_W * dpr)));
    rows = Math.max(20, Math.round(cv.height / (CELL_H * dpr)));
    tScene = makeFB(cols, rows);
    fbA = makeFB(cv.width, cv.height);
    fbB = makeFB(cv.width, cv.height);
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  /* ---- HUD wiring ---- */
  const labelsEl = document.createElement('div');
  labelsEl.style.cssText = 'position:fixed;inset:0;z-index:5;pointer-events:none';
  document.body.insertBefore(labelsEl, document.querySelector('.hud'));
  const labels = AGENTS.map(a => {
    const s = document.createElement('span');
    s.textContent = RN[a.cls - 1];
    s.style.cssText = `position:absolute;font-size:10px;letter-spacing:.2em;color:${CLS_HEX[a.cls - 1]};
      transform:translate(-50%,-190%);opacity:.75;text-shadow:0 0 8px ${CLS_HEX[a.cls - 1]}66`;
    labelsEl.appendChild(s);
    return s;
  });

  const rosterEl = $('roster');
  const rosterRows = AGENTS.map(a => {
    const r = document.createElement('div');
    r.className = 'ro-row' + (a.revoked ? ' rev' : '');
    r.onclick = () => { selIdx = selIdx === a.i ? -1 : a.i; syncSel(); };
    rosterEl.appendChild(r);
    return r;
  });
  function rebuildRoster() {
    AGENTS.forEach((a, i) => {
      const r = rosterRows[i];
      r.className = 'ro-row' + (a.revoked ? ' rev' : '') + (i === selIdx ? ' sel' : '');
      const nm = a.source === 'huggingface' ? a.name.split('/').pop() : a.name;
      r.title = a.name + (a.why ? ' — ' + a.why : '');
      r.innerHTML = `<span class="st"></span><span class="id">${nm.length > 18 ? nm.slice(0, 17) + '…' : nm}</span><span class="cls" style="color:${CLS_HEX[a.cls - 1]}">${RN[a.cls - 1]}</span>`;
    });
  }

  const tip = $('tip');
  let selIdx = -1, hoverIdx = -1;
  rebuildRoster();
  let mx = -1, my = -1;

  function syncSel() {
    rosterRows.forEach((r, i) => r.classList.toggle('sel', i === selIdx));
  }

  function showTip(a, px, py) {
    tip.style.display = 'block';
    const src = a.source === 'huggingface'
      ? `<div><span class="k">PIPELINE</span><span class="v">${a.pipeline || '—'}</span></div>` +
        `<div><span class="k">DOWNLOADS</span><span class="v">${fmtDl(a.downloads)}/mo</span></div>` +
        `<div><span class="k">LICENSE</span><span class="v">${a.license || '—'}</span></div>` +
        `<div><span class="k">MANIFEST</span><span class="v">${a.hash}… SHA-256</span></div>` +
        `<div><span class="k">SOURCE</span><span class="v">huggingface.co</span></div>`
      : `<div><span class="k">DECLARED</span><span class="v">${a.tools.length} tools</span></div>` +
        `<div><span class="k">SOURCE</span><span class="v">synthetic — no registry</span></div>`;
    tip.innerHTML =
      `<div class="tp-t"><span>${a.name.length > 26 ? a.name.slice(0, 25) + '…' : a.name}</span><span class="tc" style="color:${CLS_HEX[a.cls - 1]}">CLASS ${RN[a.cls - 1]}</span></div>` +
      `<div><span class="k">SPECTRAL</span><span class="v">${CLS_NAME[a.cls - 1]}</span></div>` + src +
      `<div><span class="k">STATUS</span><span class="v ${a.revoked ? 'rev' : 'ok'}">${a.revoked ? (a.why || 'RESTRICTED — below plane') : 'SELF-ATTESTED'}</span></div>`;
    tip.style.left = Math.min(W - 280, px + 18) + 'px';
    tip.style.top = Math.min(H - 220, Math.max(60, py - 30)) + 'px';
  }

  addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    const u = e.clientX / W, v = 1 - e.clientY / H;
    const ux = (u - .5) / ZOOM + .5, uy = (v - .5) / ZOOM + .5;
    hoverIdx = -1;
    let best = .0018;
    for (const a of AGENTS) {
      const dx = (ux - a.x) * (W / H), dy = uy - a.y;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; hoverIdx = a.i; }
    }
    const act = hoverIdx >= 0 ? hoverIdx : selIdx;
    if (act >= 0) showTip(AGENTS[act], e.clientX, e.clientY);
    else tip.style.display = 'none';
    document.body.style.cursor = hoverIdx >= 0 ? 'crosshair' : '';
  }, { passive: true });

  /* legend class filter */
  let filterCls = 0;
  $('legend').addEventListener('click', e => {
    const row = e.target.closest('.lg-row');
    if (!row) return;
    const c = +row.dataset.c;
    filterCls = filterCls === c ? 0 : c;
    [...$('legend').querySelectorAll('.lg-row')].forEach(r =>
      r.classList.toggle('off', filterCls && +r.dataset.c !== filterCls));
  });

  /* feed */
  const feedRows = $('feed-rows'), feedStat = $('feed-stat'), stEval = $('st-eval');
  let evaluated = 0, clock = 21 * 3600 + 42 * 60;
  function pushRow() {
    clock += 1 + Math.floor(rng() * 8);
    const [tool, arg] = CALL_POOL[Math.floor(rng() * CALL_POOL.length)];
    const caller = AGENTS[Math.floor(rng() * AGENTS.length)];
    /* revoked certifications cannot execute — checked against the registry */
    const v = caller.revoked ? { d: 'DENY', rule: 'no_attestation' } : evaluate(tool, arg);
    evaluated++;
    const row = document.createElement('div');
    row.className = 'feed-row';
    const ts = document.createElement('span'); ts.className = 'f-t';
    ts.textContent = `${String(Math.floor(clock / 3600)).padStart(2, '0')}:${String(Math.floor(clock / 60) % 60).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
    const cc = document.createElement('span'); cc.className = 'f-c';
    const short = caller.name.split('/').pop();
    cc.innerHTML = `<i style="color:${CLS_HEX[caller.cls - 1]};font-style:normal">${short.length > 14 ? short.slice(0, 13) + '…' : short}</i> ${tool} ${arg || ''}`;
    const vv = document.createElement('span'); vv.className = 'f-v ' + v.d.toLowerCase();
    vv.textContent = v.d + (v.rule ? ' · ' + v.rule : '');
    row.append(ts, cc, vv);
    feedRows.appendChild(row);
    while (feedRows.children.length > 4) feedRows.firstChild.remove();
    feedStat.textContent = evaluated + ' EVALUATED';
    stEval.textContent = evaluated;
    if (v.d === 'SUSPEND') {
      setTimeout(() => {
        const ok = rng() > .3;
        vv.textContent = ok ? 'SUSPEND → APPROVED' : 'SUSPEND → DENIED';
        vv.className = 'f-v ' + (ok ? 'allow' : 'deny');
      }, 1400 + rng() * 1600);
    }
    setTimeout(pushRow, 480 + rng() * 780);
  }
  pushRow();

  /* star uniform arrays — the sky renders the actual registry */
  const EDGES = [];
  for (let e = 0; e < 14; e++) EDGES.push([e, e + 1]);
  for (let e = 14; e < 17; e++) {
    const ai = Math.floor(fr(Math.sin(e * 127.1 + 3.7 * 311.7) * 43758.5453) * 14);
    EDGES.push([ai, Math.floor((ai + 2 + fr(Math.sin(e * 127.1 + 7.3 * 311.7) * 43758.5453) * 10) % 15)]);
  }
  const flatPos = new Float32Array(30), flatRev = new Float32Array(15), flatEdge = new Float32Array(68);
  function syncStars() {
    AGENTS.forEach((a, i) => { flatPos[i * 2] = a.x; flatPos[i * 2 + 1] = a.y; flatRev[i] = a.revoked ? 1 : 0; });
    EDGES.forEach(([a, b], e) => { flatEdge.set([AGENTS[a].x, AGENTS[a].y, AGENTS[b].x, AGENTS[b].y], e * 4); });
  }
  syncStars();
  loadRegistry().then(syncStars);

  /* ---- frame ---- */
  let px = 0, py = 0, pxx = 0, pyy = 0, t = 0, lastNow = performance.now();
  addEventListener('pointermove', e => {
    pxx = e.clientX / W - .5; pyy = e.clientY / H - .5;
  }, { passive: true });

  function draw(now) {
    const dt = Math.min(((now || performance.now()) - lastNow) / 1000, .05);
    lastNow = now || performance.now();
    t += dt;
    const df = dt * 60;
    const dr = Math.pow(.885, df), dg = Math.pow(.9, df), db2 = Math.pow(.86, df);
    px = lerp(px, pxx, .05); py = lerp(py, pyy, .05);

    /* periodic re-certification sweep — the registry re-classifies itself */
    const cyc = t % 34;
    const rc = cyc > 29 ? Math.sin((cyc - 29) / 5 * Math.PI) : 0;
    const ignite = 1 - rc * .8;
    const net = 1 - rc * .75;
    const glitch = .08 + rc * .35;
    const boot = 1 - Math.pow(1 - Math.min(1, t / 1.4), 3);
    const collapse = 1 - boot;

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
    gl.uniform1f(u.Threat, .3);
    gl.uniform1f(u.Gate, 1);
    gl.uniform1f(u.Press, .5);
    gl.uniform1f(u.Ekg, .5);
    gl.uniform1f(u.Lum, 1.05);
    gl.uniform1f(u.Ex, 0);
    gl.uniform1f(u.Ey, EY);
    gl.uniform1f(u.Face, 0);
    gl.uniform1f(u.Steps, 32);
    gl.uniform1f(u.Net, net);
    gl.uniform1f(u.Ignite, ignite);
    gl.uniform1f(u.Fall, 1);
    gl.uniform1f(u.Zoom, ZOOM);
    gl.uniform1f(u.Sel, selIdx);
    gl.uniform1f(u.Cls, filterCls);
    gl.uniform2fv(u.APos, flatPos);
    gl.uniform1fv(u.ARev, flatRev);
    gl.uniform4fv(u.Edge, flatEdge);
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

    /* class labels track zoomed positions */
    for (let i = 0; i < labels.length; i++) {
      const a = AGENTS[i];
      const lx = ((a.x - .5) / ZOOM + .5) * 100;
      const ly = (.5 - (a.y - .5) / ZOOM) * 100;
      labels[i].style.left = lx + '%';
      labels[i].style.top = ly + '%';
      labels[i].style.opacity = filterCls && a.cls !== filterCls ? .08 : .75;
    }

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
