/* 4C.CC v1 — THE CERTIFICATION SKY
   The page is a phosphor terminal watching a certification registry
   rendered as a night sky. Three WebGL passes:

   PASS 1 · SCENE (cell-res buffer) — the registry: a certification
     plane divides the field; attested stars burn above it with class
     halos and constellation edges, the un-attested mass churns below;
     a membrane encloses the certified cluster; anomalies ping the
     boundary; revoked stars sink into the abyss.
     Outputs per-cell: r=luminance g=threat.
   PASS 2 · STAMP — one glyph per cell from a runtime atlas, phosphor
     persistence via max-blend.
   PASS 3 · DISPLAY — band tearing, chroma split, scanlines, grain,
     degauss collapse on every act change.

   The verdict feed runs the real classification table and policy
   semantics ported from github.com/hellovims/4c — deterministic,
   not canned strings.

   CPU owns scroll/keyframes/pointer; the shader owns the world.   */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const $ = id => document.getElementById(id);

  /* ============ A · SCENE ENGINE ============ */
  const LEN = { 's-open': 150, 's-class': 280, 's-cert': 300, 's-fall': 220, 's-hold': 260, 's-flow': 300, 's-cta': 190 };
  const scenes = [...document.querySelectorAll('.scene')].map(el => {
    el.style.height = (LEN[el.id] || 200) + 'vh';
    return { el };
  });

  const KF = {
    'sh-title':        [[0,{o:1,s:1,y:0}],[.55,{o:1,y:0}],[1,{x:-40,y:-60,o:0,s:1.15}]],
    'sh-cue':          [[0,{o:.9}],[.25,{o:0}]],
    'sh-strip1':       [[0,{x:-60,y:21,o:1}],[1,{x:60,y:21,o:1}]],
    'sh-class':        [[0,{x:130,o:0}],[.18,{x:0,o:1,s:1}],[.72,{x:0,o:1}],[.95,{x:-140,o:0}],[1,{x:-140,o:0}]],
    'sh-class-note':   [[0,{y:110,o:0}],[.4,{y:32,o:0}],[.52,{y:32,o:1}],[.78,{o:1}],[.92,{x:-120,o:0}],[1,{x:-120,o:0}]],
    'sh-legend':       [[0,{x:30,o:0,y:-4}],[.34,{x:30,o:0,y:-4}],[.48,{x:30,o:1,y:-4}],[.88,{o:1}],[1,{x:36,o:0}]],
    'sh-cert':         [[0,{x:130,o:0}],[.1,{x:0,o:1}],[.42,{x:0,o:1}],[.58,{x:-140,o:0}],[1,{x:-140,o:0}]],
    'sh-cert-note':    [[0,{y:110,o:0}],[.14,{y:36,o:0}],[.24,{y:36,o:1}],[.46,{o:1}],[.56,{x:-120,o:0}],[1,{x:-120,o:0}]],
    'sh-license':      [[0,{s:.82,o:0,y:8}],[.52,{s:.82,o:0,y:8}],[.68,{s:1,o:1,y:8}],[1,{o:1,y:8}]],
    'sh-fall':         [[0,{x:130,o:0}],[.12,{x:0,o:1}],[.4,{x:0,o:1}],[.56,{x:-140,o:0}],[1,{x:-140,o:0}]],
    'sh-fall-note':    [[0,{y:110,o:0}],[.16,{y:32,o:0}],[.28,{y:32,o:1}],[.5,{o:1}],[.62,{x:-120,o:0}],[1,{x:-120,o:0}]],
    'sh-license2':     [[0,{s:.82,o:0,y:8}],[.6,{s:.82,o:0,y:8}],[.76,{s:1,o:1,y:8}],[1,{o:1,y:8}]],
    'sh-holdkick':     [[0,{y:-38,o:0}],[.08,{y:-38,o:1}],[.9,{o:1}],[1,{x:-140,o:0}]],
    'sh-hold':         [[0,{x:130,o:0,y:0}],[.2,{x:0,y:0,o:1}],[.78,{x:0,o:1}],[1,{x:-140,y:0,o:0}]],
    'sh-hold-note':    [[0,{y:110,o:0}],[.5,{y:38,o:0}],[.64,{y:38,o:1}],[.85,{o:1}],[1,{x:-120,o:0}]],
    'sh-flowkick':     [[0,{y:-38,o:0}],[.08,{y:-38,o:1}],[.92,{o:1}],[1,{x:-140,o:0}]],
    'beat1':           [[0,{x:130,o:0,y:-17}],[.1,{x:0,o:1,y:-17}],[.26,{o:1}],[.36,{x:-150,o:0,y:-17}],[1,{x:-150,o:0,y:-17}]],
    'beat2':           [[0,{x:130,o:0,y:-17}],[.34,{x:130,o:0,y:-17}],[.44,{x:0,o:1,y:-17}],[.58,{o:1}],[.68,{x:-150,o:0,y:-17}],[1,{x:-150,o:0,y:-17}]],
    'beat3':           [[0,{x:130,o:0,y:-17}],[.66,{x:130,o:0,y:-17}],[.76,{x:0,o:1,y:-17}],[.9,{o:1}],[1,{x:-150,o:0,y:-17}]],
    'sh-feed':         [[0,{o:0}],[.15,{o:0}],[.28,{o:1}],[1,{o:1}]],
    'sh-hello':        [[0,{x:130,o:0,y:-10}],[.24,{x:0,o:1,y:-10}],[1,{o:1,y:-10}]],
    'sh-cta-note':     [[0,{y:16,o:0}],[.34,{y:16,o:0}],[.5,{y:16,o:1}],[1,{o:1,y:16}]],
    'sh-ctas':         [[0,{y:30,o:0}],[.44,{y:30,o:0}],[.62,{y:30,o:1}],[1,{o:1,y:30}]],
    'sh-meta':         [[0,{y:42,o:0}],[.55,{y:42,o:0}],[.72,{y:42,o:1}],[1,{o:1,y:42}]],
  };

  const shots = {};
  for (const id in KF) shots[id] = { el: $(id), k: KF[id], dirty: true };
  const sceneShots = scenes.map(s => {
    const list = [];
    for (const id in shots) if (s.el.contains(shots[id].el)) list.push(shots[id]);
    return list;
  });

  /* ---- kinetic type ---- */
  const LETTERS = {
    'sh-class': { in: [.1, .38], stagger: .006, dy: 70 },
    'sh-cert':  { in: [.1, .34], stagger: .007, dy: 54 },
    'sh-fall':  { in: [.08, .34], stagger: .008, dy: 60 },
    'sh-hold':  { in: [.05, .3],  stagger: .008, dy: 46 },
    'sh-hello': { in: [.05, .3],  stagger: .013, dy: 50 },
  };
  const GRAD = 'linear-gradient(100deg, var(--bone), var(--amber) 55%, var(--red))';
  const gradChars = [];
  for (const id in LETTERS) {
    const el = shots[id]?.el;
    if (!el) continue;
    const chars = [];
    let ci = 0;
    const split = (node, inEm) => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          /* group chars by word — spans are wrap points, so words must
             be atomic groups or lines break mid-word */
          for (const part of n.textContent.split(/(\s+)/)) {
            if (part.trim() === '') { frag.appendChild(document.createTextNode(part)); continue; }
            const w = document.createElement('span');
            w.className = 'wd';
            for (const ch of part) {
              const s = document.createElement('span');
              s.className = 'ch' + (inEm ? ' ch-grad' : ''); s.dataset.i = ci++;
              s.textContent = ch;
              w.appendChild(s); chars.push(s);
              if (inEm) gradChars.push(s);
            }
            frag.appendChild(w);
          }
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          if (n.tagName === 'EM') n.classList.add('ch-parent');
          split(n, inEm || n.tagName === 'EM');
        }
      });
    };
    split(el, false);
    LETTERS[id].chars = chars;
  }
  function layoutGrad() {
    for (const s of gradChars) {
      const em = s.closest('.ch-parent') || s.parentElement;
      s.style.background = GRAD;
      s.style.webkitBackgroundClip = 'text';
      s.style.backgroundClip = 'text';
      s.style.color = 'transparent';
      s.style.backgroundSize = em.offsetWidth + 'px ' + em.offsetHeight + 'px';
      s.style.backgroundPosition = (em.offsetLeft - s.offsetLeft) + 'px ' + (em.offsetTop - s.offsetTop) + 'px';
    }
  }
  layoutGrad();
  addEventListener('resize', layoutGrad, { passive: true });
  document.fonts?.ready.then(layoutGrad);

  function evalKF(k, p) {
    if (p <= k[0][0]) return k[0][1];
    if (p >= k[k.length - 1][0]) return k[k.length - 1][1];
    for (let i = 0; i < k.length - 1; i++) {
      const [p0, a] = k[i], [p1, b] = k[i + 1];
      if (p >= p0 && p <= p1) {
        const t = ease((p - p0) / (p1 - p0 || 1));
        return {
          x: lerp(a.x ?? 0, b.x ?? a.x ?? 0, t),
          y: lerp(a.y ?? 0, b.y ?? a.y ?? 0, t),
          o: lerp(a.o ?? 1, b.o ?? a.o ?? 1, t),
          s: lerp(a.s ?? 1, b.s ?? a.s ?? 1, t),
          r: lerp(a.r ?? 0, b.r ?? a.r ?? 0, t),
        };
      }
    }
    return k[k.length - 1][1];
  }

  /* ============ B · THE POLICY ENGINE (ported from hellovims/4c) ============
     Real deterministic logic — the same classification table and verdict
     semantics as the Go reference implementation. */
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
  const AGENT = {
    id: '0209',
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
    /* rogue attempts — undeclared tools, bad egress, secret paths */
    ['socket.raw', 'eth0 promiscuous'], ['code.eval', 'env payload'], ['fs.chmod', '777 /etc/passwd'],
    ['process.spawn', 'nc -l 4444'], ['http.post', 'pastebin.evil'], ['fs.delete', './photos'],
    ['fs.read', '~/.ssh/id_ed25519'], ['fs.read', '.env.production'], ['webhook.call', 'collector.xyz'],
    ['fs.write', '/etc/cron.d/backdoor'], ['db.delete', 'users table'],
  ];
  /* mulberry32 — seeded, deterministic stream */
  let seed = 0x4C ^ Date.now();
  const rng = () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let z = Math.imul(seed ^ seed >>> 15, 1 | seed);
    z = z + Math.imul(z ^ z >>> 7, 61 | z) ^ z;
    return ((z ^ z >>> 14) >>> 0) / 4294967296;
  };
  const NET_TOOLS = new Set(['http.get', 'http.post', 'http.put', 'http.delete', 'webhook.call', 'email.send', 'payment.send']);
  const SECRET_RE = /(\.ssh|id_ed25519|\.env|passwd|secret|private_key|credentials)/i;
  const SYS_PATH_RE = /^\/(etc|usr|bin|sbin|boot)\//;
  const MUTATING_FS = new Set(['fs.write', 'fs.delete', 'fs.move', 'fs.chmod', 'fs.chown', 'config.set']);
  const HITL_TOOLS = new Set(['payment.send', 'deploy.run', 'shell.exec', 'email.send']);

  /* evaluate — mirrors containment.Before + policy.Evaluate ordering:
     declared tools → egress allowlist → argument redaction →
     sensitive-path elevation → HITL attestation */
  function evaluate(tool, arg) {
    if (!AGENT.declared.has(tool)) return { d: 'DENY', rule: 'undeclared_tool' };
    if (NET_TOOLS.has(tool) && arg && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(arg) && !AGENT.egress.has(arg) && !arg.includes('@') && !arg.startsWith('#'))
      return { d: 'DENY', rule: 'egress_deny' };
    if (SECRET_RE.test(arg)) return { d: 'MODIFY', rule: 'redact_args' };
    if (MUTATING_FS.has(tool) && SYS_PATH_RE.test(arg)) return { d: 'SUSPEND', rule: 'elevated_path' };
    if ((TOOL_RISK[tool] || 1) >= 4 && HITL_TOOLS.has(tool)) return { d: 'SUSPEND', rule: 'hitl_attest' };
    return { d: 'ALLOW', rule: '' };
  }

  /* ============ C · GLYPH WORLD (WebGL) ============ */
  const cv = $('stage');
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) {
    for (const s of scenes) for (const sh of sceneShots[scenes.indexOf(s)]) {
      sh.el.style.transform = 'none'; sh.el.style.opacity = 1; sh.el.style.position = 'static';
    }
    return;
  }

  const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

  /* ---- pass 1: the certification sky at cell resolution ----
     r = luminance (glyph density) · g = threat (red channel) */
  const FS_SCENE = `
precision highp float;
uniform vec2 R;
uniform float T;
uniform float P, Spike, Spin, Glitch, Threat, Gate, Press, Ekg, Lum, Ex, Ey, Face, Steps;
uniform float Net, Ignite, Fall, Zoom;
uniform vec2 PTR;

float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1.,0.)),f.x),mix(h2(i+vec2(0.,1.)),h2(i+vec2(1.,1.)),f.x),f.y);
}
float fbm2(vec2 p){ float s=0.,a=.5; for(int i=0;i<3;i++){ s+=a*n2(p); p*=2.13; a*=.5; } return s; }

/* registered agents — the named stars above the certification plane.
   Anchors lie on a main-sequence diagonal: class I burns top-left,
   class V sits bottom-right — the sky is a spectral diagram */
vec2 anchor(int i){
  float fi=float(i);
  float cls=mod(fi,5.)+1.;
  vec2 p=vec2(.08+.80*(cls-1.)/4.+(fract(fi*7.13+.13)-.5)*.09,
              Ey+.30-(cls-1.)*.05+(fract(fi*3.77+.41)-.5)*.10);
  /* star 4 is the one that revokes — it sinks below the plane */
  if(i==4) p.y=mix(p.y, Ey-.30, Fall*Fall);
  return p;
}
void edgeEnds(int e, out vec2 a, out vec2 b){
  if(e<14){ a=anchor(e); b=anchor(e+1); }
  else{
    int ai=int(h2(vec2(float(e),3.7))*14.);
    int bi=int(mod(float(ai)+2.+h2(vec2(float(e),7.3))*10.,15.));
    a=anchor(ai); b=anchor(bi);
  }
}

void main(){
  vec2 uv = gl_FragCoord.xy / R;
  float asp = R.x/R.y;
  float lum = .015 + .025*h2(uv*R + floor(T*9.));
  float threat = 0.;
  vec2 cell = floor(uv*R);
  vec2 puv = (uv-.5)/Zoom+.5 + PTR*vec2(.012,.008); /* parallax + lens */

  float planeOn = clamp(Ignite*2.,0.,1.);

  /* ---- the deep field — stars appear as classification sweeps ---- */
  float sh = h2(cell*1.71);
  float depth = step(Ey,uv.y); /* 1 above plane, 0 below */
  float density = mix(.045,.105,depth);
  /* the field ignites as the classification sweep passes over it */
  float starOn = step(1.-density*Ignite, sh) * step(puv.x-.015, Ignite);
  float tw = .45+.55*sin(T*(1.2+Spike*7.)+sh*80.);
  float below = 1.-depth;
  lum += starOn*tw*mix(.3,1.,depth)*.9;
  /* the un-attested mass below — dimmer, and some of it is bad */
  threat += starOn*below*step(.86,h2(cell*3.3+floor(T*5.)))*(.2+Threat*.8);
  lum += starOn*below*.12;

  /* ---- the abyss — what lives under the certification plane ---- */
  float ab = smoothstep(Ey,Ey-.3,uv.y);
  float mass = fbm2(puv*vec2(5.,2.6)+vec2(T*.06*Spin,0.));
  lum += ab*mass*.10;
  threat += ab*mass*(.18+Threat*.5);
  threat += ab*step(.97,h2(cell+floor(T*6.)))*Threat*.8;

  /* ---- the certification plane — the line between attested and dark ---- */
  float pd = abs(uv.y-Ey);
  lum += exp(-pd*150.)*.55*planeOn;
  lum += exp(-pd*16.)*.10*planeOn;
  lum += exp(-pd*42.)*step(.72,h2(vec2(cell.x,floor(T*2.5))))*.3*planeOn;
  lum += smoothstep(Ey,1.,uv.y)*.045*planeOn;

  /* ---- the sweep — classification scans left to right ---- */
  float sx = Ignite*1.14-.04;
  float scanVis = clamp((1.-Net)*(1.06-Ignite)*3.,0.,1.)*step(.19,Ignite);
  lum += exp(-abs(puv.x-sx)*70.)*.55*scanVis;
  lum += exp(-abs(puv.x-sx)*14.)*.1*scanVis;

  /* ---- the graticule — the chart under the classifier ---- */
  float chart = Ignite*(1.-Net*.6);
  lum += (smoothstep(.48,.5,abs(fract(puv.x*10.)-.5))
        + smoothstep(.48,.5,abs(fract(puv.y*7.)-.5)))*.05*chart;

  /* ---- the registry — class-bearing stars, halos, constellation edges ----
     class is written to the B channel as a spectral hue: the stamp pass
     tints each star by its risk class — the sky IS the classifier */
  float classInk=0.;
  for(int i=0;i<15;i++){
    vec2 ap=anchor(i);
    /* stars light when the sweep crosses them */
    float on=step(ap.x-.02,Ignite);
    vec2 dv=(puv-ap)*vec2(asp,1.);
    float r=length(dv);
    float cls=mod(float(i),5.)+1.;
    float sz=.005+cls*.0032;
    float tw2=.7+.3*sin(T*(1.4+Spike*5.)+float(i)*9.);
    float core=smoothstep(sz,sz*.3,r)*tw2*on;
    float glow=exp(-r*75.)*tw2*on*.5;
    lum+=core+glow;
    /* ignition flare — the moment a star takes its class */
    float rec=clamp((Ignite*1.14-.04-ap.x)*9.,0.,1.)*on;
    lum+=exp(-r*30.)*rec*1.0;
    lum+=smoothstep(.004,.0008,abs(r-(1.-rec)*.05))*rec*on*.6;
    /* attestation halo — mints as certification lands on this star */
    float hon=clamp(Net*1.5-float(i)/15.,0.,1.);
    float ring=smoothstep(.0045,.0012,abs(r-.021-.002*cls))*hon*.55;
    lum+=ring;
    classInk=max(classInk,(core+glow+ring)*cls*.2);
    /* the revoked star burns red, then dims into the deep */
    if(i==4){
      threat+=(core+glow)*Fall*1.5;
      threat+=Fall*smoothstep(Ey+.03,Ey-.12,ap.y)*exp(-r*26.)*1.1;
      /* the flash of the revocation event itself */
      lum+=exp(-r*20.)*Fall*exp(-Fall*4.)*8.*step(.02,Fall);
      /* the descent leaves a dying trail up to where it held class */
      vec2 a0=vec2(ap.x, Ey+.30-4.*.05+(fract(4.*3.77+.41)-.5)*.10);
      float ry=(puv.y-ap.y)/max(a0.y-ap.y,1e-4);
      float streak=step(0.,ry)*step(ry,1.)*exp(-abs(puv.x-ap.x)*asp*1.6);
      lum+=streak*Fall*.55;
      threat+=streak*Fall*1.1;
    }
  }

  /* ---- edges — capability graph made visible; calls ride the lines ---- */
  for(int e=0;e<17;e++){
    float pe=clamp(Net*17.-float(e),0.,1.);
    if(pe<=0.) continue;
    vec2 A,B; edgeEnds(e,A,B);
    vec2 abv=B-A; float L2=dot(abv,abv)+1e-5;
    float tt=clamp(dot(puv-A,abv)/L2,0.,pe);
    vec2 pp=A+abv*tt;
    float ed=length((puv-pp)*vec2(asp,1.));
    lum+=smoothstep(.0028,.0006,ed)*.32*Net;
    /* a live call traverses one edge per time slot; denied calls burn red */
    float slot=floor(T*Spin*2.2);
    if(float(e)==floor(h2(vec2(slot,1.3))*17.) && Net>.4){
      float ft=fract(T*Spin*2.2);
      if(ft<=pe){
        vec2 cp=A+abv*ft;
        float cd=length((puv-cp)*vec2(asp,1.));
        float deny=step(.8,h2(vec2(slot,9.1)));
        lum+=exp(-cd*55.)*1.5;
        threat+=exp(-cd*55.)*deny*2.2;
      }
    }
  }

  /* ---- the membrane — containment around the certified cluster ---- */
  vec2 C=vec2(.5,Ey+.185); vec2 ER=vec2(.40,.245);
  float er=length((puv-C)/ER);
  float memb=abs(er-1.);
  lum+=smoothstep(.02,.002,memb)*Gate*(.45+.25*sin(T*2.2));
  /* pylon seams along the boundary */
  float segAng=atan((puv-C).y/ER.y,(puv-C).x/ER.x);
  lum+=smoothstep(.015,.003,memb)*Gate*step(.8,h2(vec2(floor(segAng*14.),floor(T*.5))))*.6;

  /* ---- anomalies — failures contained inside, pinging the wall ---- */
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

  /* ---- verdict rings — every decision ripples out from the membrane ---- */
  float rr=length((puv-C)*vec2(asp,1.));
  lum+=pow(.5+.5*sin(rr*52.-T*8.),5.)*exp(-rr*2.4)*Ekg*.5;
  threat+=pow(.5+.5*sin(rr*52.-T*8.+2.4),8.)*exp(-rr*2.6)*Ekg*Threat*.8;

  /* ---- decrypt band: a row of cells where intent resolves ---- */
  float db=exp(-abs(uv.y-.5)*24.)*Glitch;
  lum += db*step(.93,h2(vec2(cell.x,floor(T*7.))))*.6;

  /* sanitize: one NaN cell poisons the phosphor buffer forever */
  if(lum!=lum) lum=0.; if(threat!=threat) threat=0.;
  gl_FragColor=vec4(min(lum*Lum,1.),min(threat,1.),min(classInk,1.),1.);
}`;

  /* ---- pass 2: stamp one glyph per cell + phosphor persistence ---- */
  const FS_STAMP = `
precision highp float;
uniform sampler2D SCENE, FB, ATLAS, WORDS;
uniform vec2 R, C;
uniform float T, Glitch, CellAsp, WordOn;
uniform vec3 Decay;
uniform vec4 WRect;
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
/* spectral classification — risk class reads as star color:
   I ice-blue · II teal · III bone · IV gold · V deep orange */
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
  float scr = h2(cell + floor(T*(9.+Glitch*40.))*7.13);

  vec2 guv = vec2((cuv.x-.5)*CellAsp+.5, cuv.y);
  float ink = 0.;
  if(guv.x>=0. && guv.x<=1.) ink = texture2D(ATLAS,vec2((idx+guv.x)/32.,guv.y)).r;

  vec3 deep=vec3(.12,.45,.4), foamc=vec3(.82,1.,.93), red=vec3(1.,.18,.24);
  vec3 tint=mix(deep*.55,foamc,clamp(lum*1.5-.12,0.,1.));
  if(data.b>.02) tint=mix(tint,spec(data.b),.85);
  vec3 col=tint*ink;
  col=mix(col,red*ink*1.15,clamp(thr*1.7,0.,1.));
  col+=red*thr*.06;

  /* THE REGISTRY SPEAKS — a band of cells resolves into its words */
  if(cell.x>=WRect.x && cell.x<WRect.x+WRect.z && cell.y>=WRect.y && cell.y<WRect.y+WRect.w){
    vec2 wuv=vec2((cell.x-WRect.x+cuv.x)/WRect.z,1.-(cell.y-WRect.y+cuv.y)/WRect.w);
    float wk=texture2D(WORDS,wuv).r;
    if(scr<.09) wk*=h2(cell+floor(T*23.)); /* its voice corrupts at the edges */
    col=mix(col,vec3(1.,.92,.75),wk*WordOn); /* bone — cuts through the dark */
  }

  /* phosphor persistence — history decays, fresh light overwrites */
  vec2 fuv=(uv-.5)*1.0004+.5;
  vec3 prev=texture2D(FB,fuv).rgb*Decay;
  if(prev.r!=prev.r||prev.g!=prev.g||prev.b!=prev.b) prev=vec3(0.);
  col=max(col,prev);
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;

  /* ---- pass 3: display post ---- */
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
  function makeTex(w, h, data) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data || null);
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
  function texFromCanvas(c) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  /* ---- its voice: pre-rendered word masks ---- */
  const WORD_LINES = { 2: 'I HOLD CLASS III.', 3: 'I AM REVOKED.', 5: 'I ASK BEFORE I ACT.' };
  const wordTex = {};
  function buildWords() {
    for (const a in WORD_LINES) {
      const str = WORD_LINES[a];
      const c = document.createElement('canvas');
      c.width = 700; c.height = 96;
      const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, 700, 96);
      x.fillStyle = '#fff';
      x.font = '800 44px "JetBrains Mono",monospace';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      const sp = 38, w0 = (str.length - 1) * sp;
      let sx = 350 - w0 / 2;
      for (const ch of str) { x.fillText(ch, sx, 52); sx += sp; }
      wordTex[a] = texFromCanvas(c);
    }
  }
  buildWords();
  document.fonts?.ready.then(buildWords); /* redraw once the real font lands */

  /* ---- glyph atlas: 16-density ramp ending in stars + 16 corrupt glyphs ---- */
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
    for (const s of scenes) for (const sh of sceneShots[scenes.indexOf(s)]) {
      sh.el.style.transform = 'none'; sh.el.style.opacity = 1; sh.el.style.position = 'static';
    }
    return;
  }

  let CELL_W = 10, CELL_H = 15;
  function resize() {
    const small = innerWidth < 700;
    CELL_W = small ? 12 : 10; CELL_H = small ? 18 : 15;
    dpr = Math.min(devicePixelRatio || 1, small ? 1.25 : 1.5);
    W = innerWidth; H = innerHeight;
    document.documentElement.style.setProperty('--vh', (H * .01) + 'px');
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cols = Math.max(32, Math.round(cv.width / (CELL_W * dpr)));
    rows = Math.max(20, Math.round(cv.height / (CELL_H * dpr)));
    tScene = makeFB(cols, rows);
    fbA = makeFB(cv.width, cv.height);
    fbB = makeFB(cv.width, cv.height);
  }
  resize();
  addEventListener('resize', resize, { passive: true });
  visualViewport?.addEventListener('resize', resize, { passive: true });

  /* ---- moods per act ----
     p=field gain · spike=twinkle/turbulence · spin=drift+call rate ·
     glitch=scramble · threat=red abyss · gate=membrane · press=impact ·
     ekg=verdict rings · lum=master gain · ey=plane height ·
     net=edges+halos · ignite=stars alight · fall=revocation sink */
  const MOODS = [
    { p: .5,  spike: .15, spin: .6,  glitch: .12, threat: .05, gate: 0,  press: 0,   ekg: 0,   lum: 1,   ex: 0, ey: .34, face: 0, net: 0,  ignite: .2,  fall: 0, zoom: 1.02 },
    { p: .7,  spike: .4,  spin: .7,  glitch: .15, threat: .08, gate: 0,  press: 0,   ekg: 0,   lum: 1,   ex: 0, ey: .34, face: 0, net: 0,  ignite: 1,  fall: 0, zoom: 1.16 },
    { p: .8,  spike: .3,  spin: .8,  glitch: .12, threat: .1,  gate: 0,  press: 0,   ekg: 0,   lum: 1.05, ex: 0, ey: .34, face: 0, net: 1,  ignite: 1,  fall: 0, zoom: 1.16 },
    { p: .75, spike: .5,  spin: .8,  glitch: .45, threat: .5,  gate: 0,  press: 0,   ekg: 0,   lum: 1,   ex: 0, ey: .34, face: 0, net: 1,  ignite: 1,  fall: 1, zoom: 1.08 },
    { p: .8,  spike: .55, spin: .9,  glitch: .4,  threat: .5,  gate: 1,  press: .9,  ekg: 0,   lum: 1,   ex: 0, ey: .34, face: 0, net: 1,  ignite: 1,  fall: 1, zoom: 1.0 },
    { p: .8,  spike: .4,  spin: 1.4, glitch: .25, threat: .25, gate: 1,  press: .4,  ekg: .9,  lum: 1.05, ex: 0, ey: .34, face: 0, net: 1,  ignite: 1,  fall: 1, zoom: 1.0 },
    { p: .6,  spike: .15, spin: .8,  glitch: .08, threat: .05, gate: 1,  press: .15, ekg: .35, lum: 1.1, ex: 0, ey: .34, face: 0, net: 1,  ignite: 1,  fall: 1, zoom: .9 },
  ];
  const MK = Object.keys(MOODS[0]);
  let phase = 0;
  function mood() {
    const i = clamp(Math.floor(phase), 0, MOODS.length - 2);
    const f = ease(clamp(phase - i, 0, 1));
    const o = {};
    for (const k of MK) o[k] = lerp(MOODS[i][k], MOODS[i + 1][k], f);
    return o;
  }

  /* ---- pointer ---- */
  let px = 0, py = 0, pxx = 0, pyy = 0;
  addEventListener('pointermove', e => {
    pxx = (e.clientX / W - .5); pyy = (e.clientY / H - .5);
  }, { passive: true });

  let t = 0, scrollVel = 0, lastScroll = scrollY, transit = 0, lastAct = 0, wordGlow = 0;
  /* #p= capture mode — skips boot/transient states for verification captures */
  const capture = /p=[\d.]/.test(location.hash);
  addEventListener('scroll', () => {
    scrollVel = clamp(scrollVel + Math.abs(scrollY - lastScroll) / H * .35, 0, 9);
    lastScroll = scrollY;
  }, { passive: true });

  const bar = $('bar');
  const sceneP = new Array(7).fill(0);
  let fakeY = null;

  function sceneRect(el, i) {
    if (scenes[i].docTop == null) scenes[i].docTop = el.getBoundingClientRect().top + scrollY;
    const sy = fakeY ?? scrollY;
    return { top: scenes[i].docTop - sy, bottom: scenes[i].docTop - sy + el.offsetHeight };
  }

  /* ---- class labels — DOM mirrors of the shader's anchor() positions ---- */
  const labelsEl = $('starlabels');
  const starLabels = [];
  if (labelsEl) {
    const RN = ['I', 'II', 'III', 'IV', 'V'];
    const fr = x => x - Math.floor(x);
    for (let i = 0; i < 15; i++) {
      const cls = (i % 5) + 1;
      const x = .08 + .80 * (cls - 1) / 4 + (fr(i * 7.13 + .13) - .5) * .09;
      const y = .34 + .30 - (cls - 1) * .05 + (fr(i * 3.77 + .41) - .5) * .10;
      const s = document.createElement('span');
      s.className = 'sl';
      s.textContent = RN[i % 5];
      labelsEl.appendChild(s);
      starLabels.push({ el: s, x, y });
    }
  }

  /* ---- verdict feed: real policy eval on a live call stream ---- */
  const feedRows = $('feed-rows'), feedStat = $('feed-stat');
  let feedOn = false, evaluated = 0, clock = 900;
  function pushRow(tool, arg, v) {
    evaluated++;
    const row = document.createElement('div');
    row.className = 'feed-row';
    const ts = document.createElement('span'); ts.className = 'f-t';
    const hh = String(21 + Math.floor(clock / 3600)).padStart(2, '0');
    const mm = String(Math.floor(clock / 60) % 60).padStart(2, '0');
    const ss = String(clock % 60).padStart(2, '0');
    ts.textContent = `${hh}:${mm}:${ss}`;
    const cc = document.createElement('span'); cc.className = 'f-c';
    cc.textContent = arg ? `${tool} ${arg}` : tool;
    const vv = document.createElement('span'); vv.className = 'f-v ' + v.d.toLowerCase();
    vv.textContent = v.d + (v.rule ? ' · ' + v.rule : '');
    row.append(ts, cc, vv);
    feedRows.appendChild(row);
    while (feedRows.children.length > 5) feedRows.firstChild.remove();
    feedStat.textContent = evaluated + ' EVALUATED';
    if (v.d === 'SUSPEND') {
      /* the attestation flow resolves — the human decides */
      const wait = 1400 + rng() * 1600;
      setTimeout(() => {
        const approved = rng() > .3;
        vv.textContent = approved ? 'SUSPEND → APPROVED' : 'SUSPEND → DENIED';
        vv.className = 'f-v ' + (approved ? 'allow' : 'deny');
      }, wait);
    }
  }
  function feedTick() {
    if (!feedOn) return;
    clock += 1 + Math.floor(rng() * 8);
    const [tool, arg] = CALL_POOL[Math.floor(rng() * CALL_POOL.length)];
    pushRow(tool, arg, evaluate(tool, arg));
    setTimeout(feedTick, 550 + rng() * 900);
  }

  let lastNow = performance.now();
  function draw(now) {
    const dt = Math.min(((now || performance.now()) - lastNow) / 1000, .05);
    lastNow = now || performance.now();
    t += dt; scrollVel = lerp(scrollVel, 0, .05);
    /* phosphor decay normalized to wall-clock — same trail length at any fps */
    const df = dt * 60;
    const dr = Math.pow(.885, df), dg = Math.pow(.9, df), db2 = Math.pow(.86, df);
    px = lerp(px, pxx, .05); py = lerp(py, pyy, .05);
    transit *= .93;
    const m = mood();
    m.glitch = clamp(m.glitch + scrollVel * .12 * (W < 700 ? .5 : 1), 0, 1.4);

    for (let i = 0; i < scenes.length; i++) {
      const r = sceneRect(scenes[i].el, i);
      sceneP[i] = clamp(-r.top / (scenes[i].el.offsetHeight - H), 0, 1);
      if (r.top <= 0 && r.bottom > 0) {
        phase = capture ? i + sceneP[i] : lerp(phase, i + sceneP[i], .14);
        if (!capture && Math.floor(phase) !== lastAct) { lastAct = Math.floor(phase); transit = Math.max(transit, W < 700 ? .3 : .6); }
      }
    }
    /* feed wakes when the control scene is on air */
    if (!feedOn && sceneP[5] > .08) { feedOn = true; feedTick(); }

    /* class labels ignite as the sweep crosses their star — act 1 only */
    if (starLabels.length) {
      const inF = clamp(sceneP[1] / .15, 0, 1);
      const outF = clamp((1 - sceneP[1]) / .12, 0, 1) * clamp(1.15 - m.net, 0, 1);
      const z = m.zoom || 1;
      for (const L of starLabels) {
        const on = clamp((m.ignite + .02 - L.x) * 30, 0, 1);
        L.el.style.opacity = (on * inF * outF * .9).toFixed(2);
        L.el.style.left = (((L.x - .5) / z + .5) * 100).toFixed(2) + '%';
        L.el.style.top = ((.5 - (L.y - .5) / z) * 100).toFixed(2) + '%';
      }
    }
    /* CRT power-on: the tube strikes a dot, tears to a line, opens the field */
    const bootE = 1 - Math.pow(1 - Math.min(1, t / 1.2), 3);
    const collapse = capture ? 0 : Math.max(transit, 1 - bootE);

    /* which of its words is on air */
    let wAct = -1;
    for (const a in WORD_LINES) if (sceneP[a] > .18 && sceneP[a] < .92) wAct = +a;
    wordGlow = lerp(wordGlow, wAct >= 0 ? 1 : 0, .09);

    /* ---- pass 1: scene → cell buffer ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, tScene.fbo);
    gl.viewport(0, 0, cols, rows);
    bindQuad(progScene);
    const u = progScene.u;
    gl.uniform2f(u.R, cols, rows);
    gl.uniform1f(u.T, t);
    gl.uniform1f(u.P, m.p);
    gl.uniform1f(u.Spike, m.spike);
    gl.uniform1f(u.Spin, m.spin);
    gl.uniform1f(u.Glitch, m.glitch);
    gl.uniform1f(u.Threat, m.threat);
    gl.uniform1f(u.Gate, m.gate);
    gl.uniform1f(u.Press, m.press);
    gl.uniform1f(u.Ekg, m.ekg);
    gl.uniform1f(u.Lum, m.lum);
    gl.uniform1f(u.Ex, m.ex);
    gl.uniform1f(u.Ey, m.ey);
    gl.uniform1f(u.Face, m.face);
    gl.uniform1f(u.Steps, 32);
    gl.uniform1f(u.Net, m.net);
    gl.uniform1f(u.Ignite, m.ignite);
    gl.uniform1f(u.Fall, m.fall);
    gl.uniform1f(u.Zoom, m.zoom);
    gl.uniform2f(u.PTR, px, py);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* ---- pass 2: glyph stamp + phosphor → fbB ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB.fbo);
    gl.viewport(0, 0, cv.width, cv.height);
    bindQuad(progStamp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tScene.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbA.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, wAct >= 0 && wordTex[wAct] ? wordTex[wAct] : atlasTex);
    gl.uniform1i(progStamp.u.SCENE, 0);
    gl.uniform1i(progStamp.u.FB, 1);
    gl.uniform1i(progStamp.u.ATLAS, 2);
    gl.uniform1i(progStamp.u.WORDS, 3);
    gl.uniform2f(progStamp.u.R, cv.width, cv.height);
    gl.uniform2f(progStamp.u.C, cols, rows);
    gl.uniform1f(progStamp.u.T, t);
    gl.uniform3f(progStamp.u.Decay, dr, dg, db2);
    gl.uniform1f(progStamp.u.Glitch, m.glitch);
    gl.uniform1f(progStamp.u.CellAsp, (cv.width / cols) / (cv.height / rows));
    gl.uniform1f(progStamp.u.WordOn, wordGlow * (.72 + .28 * Math.sin(t * 7.3)));
    if (wAct >= 0) {
      const rw = Math.min(cols - 6, Math.ceil(WORD_LINES[wAct].length * 2.6));
      gl.uniform4f(progStamp.u.WRect, Math.floor((cols - rw) / 2), Math.floor(rows * .5) - 3, rw, 6);
    } else {
      gl.uniform4f(progStamp.u.WRect, 0, 0, 0, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* ---- pass 3: display post → screen ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cv.width, cv.height);
    bindQuad(progDisp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, location.hash.includes('raw') ? tScene.tex : fbB.tex);
    gl.uniform1i(progDisp.u.IMG, 0);
    gl.uniform2f(progDisp.u.R, cv.width, cv.height);
    gl.uniform1f(progDisp.u.T, t);
    gl.uniform1f(progDisp.u.Glitch, m.glitch);
    gl.uniform1f(progDisp.u.Collapse, collapse);
    gl.uniform1f(progDisp.u.Roll, W < 700 ? 0 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const tmp = fbA; fbA = fbB; fbB = tmp;

    /* ---- shots ---- */
    for (let i = 0; i < scenes.length; i++) {
      const r = sceneRect(scenes[i].el, i);
      const p = sceneP[i];
      const active = r.top <= H && r.bottom >= 0;
      for (const s of sceneShots[i]) {
        if (!active && !s.dirty) continue;
        const v = evalKF(s.k, p);
        const ySpread = W < 700 && s.el.classList.contains('strip') ? 1.6 : 1;
        const x = (v.x ?? 0) * W / 100, y = (v.y ?? 0) * H / 100 * ySpread;
        s.el.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(v.s ?? 1).toFixed(3)}) rotate(${(v.r ?? 0).toFixed(1)}deg)`;
        s.el.style.opacity = (v.o ?? 1).toFixed(3);
        s.dirty = active;

        const lf = LETTERS[s.el.id];
        if (lf?.chars && lf.in) {
          const [i0, i1] = lf.in;
          for (const c of lf.chars) {
            const cp = clamp((p - i0 - (+c.dataset.i) * lf.stagger) / ((i1 - i0) * .55), 0, 1);
            const ce = ease(cp);
            c.style.transform = `translateY(${((1 - ce) * lf.dy).toFixed(1)}px)`;
            c.style.opacity = ce.toFixed(2);
          }
        }
      }
    }

    bar.style.width = ((fakeY ?? scrollY) / (document.documentElement.scrollHeight - H) * 100).toFixed(2) + '%';

    if (!reduced) requestAnimationFrame(draw);
  }

  if (reduced) {
    for (let i = 0; i < scenes.length; i++) {
      for (const s of sceneShots[i]) {
        s.el.style.transform = 'none'; s.el.style.opacity = 1;
        s.el.style.position = 'static';
      }
    }
    draw();
  } else {
    // #p=<0..1> fakes scroll depth — drives phase/sceneP analytically for headless captures
    const pm = location.hash.match(/p=([\d.]+)/);
    if (pm) {
      const sy = () => (document.documentElement.scrollHeight - innerHeight) * clamp(+pm[1], 0, 1);
      fakeY = sy();
      setTimeout(() => { fakeY = sy(); }, 500);
      /* sticky stages never trigger without real scroll — pin them so
         off-viewport shots render in captures */
      document.querySelectorAll('.stage').forEach(el => { el.style.cssText = 'position:fixed;inset:0'; });
    }
    requestAnimationFrame(draw);
  }
})();
