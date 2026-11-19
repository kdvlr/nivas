// @ts-nocheck
// Procedural 60fps Coast-to-Coast Harvest Express engine for Thanksgiving week.
// Runs all 6 seeded SVG landscape generators once on mount and drives 60fps
// parallax, wheel-locked piston/valve-gear kinematics, chuff-synced steam,
// and articulated animal & bird motion.

export interface HarvestRegionMeta {
  name: string
  ribbon: string
  caption: string
}

export const HARVEST_REGIONS: HarvestRegionMeta[] = [
  { name: '🌊 Stop 1 of 7 · Pacific Coast, CA',    ribbon: '🌊 West Coast',         caption: 'Golden Gate & Big Sur — California' },
  { name: '🌵 Stop 2 of 7 · Monument Valley, AZ',  ribbon: '🌵 Desert Southwest',   caption: 'Red Rock Mesas — Arizona' },
  { name: '🏔️ Stop 3 of 7 · Rocky Mountains, CO',  ribbon: '🏔️ Alpine Pass',        caption: 'Continental Divide — Colorado' },
  { name: '🌾 Stop 4 of 7 · Heartland Plains, KS', ribbon: '🌾 Great Plains',       caption: 'Amber Waves of Grain — Kansas' },
  { name: '🍂 Stop 5 of 7 · Great Smoky Mtns, TN', ribbon: '🍂 Smoky Ridges',       caption: 'Blue Mist Hollow — Tennessee' },
  { name: '🗽 Stop 6 of 7 · New York Harbor, NY',  ribbon: '🗽 Autumn in New York', caption: 'Manhattan & Lady Liberty — New York' },
  { name: '🦃 Stop 7 of 7 · Atlantic Feast, MA',   ribbon: '🥧 Thanksgiving Feast!', caption: 'Lighthouse Bluff — New England Coast' },
]

export interface HarvestExpressOptions {
  initialRegion?: number
  initialPaused?: boolean
  isStatic?: boolean
  onRegionChange?: (idx: number) => void
}

export interface HarvestExpressController {
  surgeToRegion: (targetIdx: number) => void
  setPaused: (paused: boolean) => void
  destroy: () => void
}

export function mountHarvestExpress(
  svg: SVGSVGElement,
  options: HarvestExpressOptions = {},
): HarvestExpressController {
  const { initialRegion = 0, initialPaused = false, isStatic = false, onRegionChange } = options
  const byId = (id: string) => svg.querySelector('#' + id) as any

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const elSVG = (tag, attrs = {}) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };

  // Build railway ties across 1990px
  const tiesLayer = byId('tiesLayer');
  for (let x = 0; x < 1990; x += 70) {
    tiesLayer.appendChild(elSVG('rect', { x, y: 12, width: 24, height: 18, rx: 3 }));
  }

  // =========================================================================
  // PROCEDURAL FLUID BIRDS (3-Phase Aerodynamic Wing Wave & Feather Detail!)
  // =========================================================================
  const animatedBirds = [];

  function buildFluidFlock(container, type) {
    if (type === 'geese') {
      const offsets = [[0,0,0], [28,-15,0.62], [56,-29,1.24], [84,-42,1.86], [30,14,0.82], [60,27,1.48], [90,39,2.14]];
      for (const [ox, oy, phase] of offsets) {
        const g = elSVG('g', { transform: `translate(${ox}, ${oy})` });
        const backWing = elSVG('path', { fill: '#1e293b', opacity: '0.78' });
        const body = elSVG('path', {
          d: 'M13,1 C6,-4 -4,-4 -10,-1 C-15,-2 -19,-7 -24,-7 C-26,-7 -28,-5.5 -26,-4 C-22,-4 -18,1 -11,2 C-4,5 7,4 13,1 Z',
          fill: '#475569'
        });
        const tailPatch = elSVG('path', { d: 'M8,0 L13,1 L9,3 Z', fill: '#f8fafc' });
        const neck = elSVG('path', {
          d: 'M-10,-1 C-15,-2 -19,-7 -25,-7',
          stroke: '#0f172a', 'stroke-width': '2.9', fill: 'none', 'stroke-linecap': 'round'
        });
        const cheek = elSVG('ellipse', { cx: '-23.5', cy: '-6.3', rx: '1.6', ry: '0.95', fill: '#f8fafc' });
        const foreWing = elSVG('path', { fill: '#334155', stroke: '#0f172a', 'stroke-width': '0.7' });
        g.append(backWing, body, tailPatch, neck, cheek, foreWing);
        container.appendChild(g);
        animatedBirds.push({ kind: 'goose', g, ox, oy, phase, foreWing, backWing });
      }
    } else if (type === 'gulls') {
      const offsets = [[0,0,0], [48,-18,1.1], [88,9,2.2]];
      for (const [ox, oy, phase] of offsets) {
        const g = elSVG('g', { transform: `translate(${ox}, ${oy})` });
        const backWing = elSVG('path', { fill: '#cbd5e1', opacity: '0.84' });
        const body = elSVG('path', {
          d: 'M8,0 C3,-3 -5,-3 -9,-1 L-12,-2 L-10,1 C-5,3 3,3 8,0 Z',
          fill: '#f8fafc'
        });
        const beak = elSVG('polygon', { points: '-9,-1 -13,0 -9,1', fill: '#f59e0b' });
        const foreWing = elSVG('path', { fill: '#ffffff', stroke: '#475569', 'stroke-width': '0.85' });
        g.append(backWing, body, beak, foreWing);
        container.appendChild(g);
        animatedBirds.push({ kind: 'gull2', g, ox, oy, phase, foreWing, backWing });
      }
    } else if (type === 'hawk') {
      const g = elSVG('g');
      const tail = elSVG('polygon', { points: '8,0 20,-5 21,5', fill: '#b91c1c' });
      const backWing = elSVG('path', { fill: '#451a03', opacity: '0.84' });
      const body = elSVG('ellipse', { cx: '0', cy: '0', rx: '9.5', ry: '3.4', fill: '#78350f' });
      const beak = elSVG('polygon', { points: '-8,-1 -13,1 -8,2.2', fill: '#facc15' });
      const foreWing = elSVG('path', { fill: '#92400e', stroke: '#451a03', 'stroke-width': '0.9' });
      g.append(tail, backWing, body, beak, foreWing);
      container.appendChild(g);
      animatedBirds.push({ kind: 'hawk', g, ox: 0, oy: 0, phase: 0, foreWing, backWing, slow: true });
    }
  }
  svg.querySelectorAll('[data-flock]').forEach(el => buildFluidFlock(el, el.getAttribute('data-flock')));

  // =========================================================================
  // PROCEDURAL ARTICULATED CHASE (4-Leg Fox + Pilgrim + Runaway Turkey!)
  // =========================================================================
  const animatedChases = [];

  function buildArticulatedChase(container) {
    const roam = elSVG('g');

    // 1. ROTARY-GALLOPING RED FOX (Flexing spine, undulating tail, 4 articulated 2-joint legs!)
    const fox = elSVG('g', { transform: 'translate(-152, -4)' });
    const foxTail = elSVG('path', { fill: '#ea580c' });
    const foxTailTip = elSVG('circle', { r: '3.8', fill: '#fff7ed' });
    const foxLegB2 = elSVG('path', { stroke: '#7c2d12', 'stroke-width': '2.8', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const foxLegF2 = elSVG('path', { stroke: '#9a3412', 'stroke-width': '2.8', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const foxTorso = elSVG('path', { fill: '#f97316' });
    const foxLegB1 = elSVG('path', { stroke: '#1c1917', 'stroke-width': '3.0', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const foxLegF1 = elSVG('path', { stroke: '#1c1917', 'stroke-width': '3.0', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const foxHead = elSVG('g');
    foxHead.innerHTML = `
      <path d="M8,-13 C14,-18 22,-14 25,-9 C20,-6 12,-6 8,-9 Z" fill="#f97316"/>
      <path d="M16,-9 L25,-9 L20,-6 Z" fill="#fff7ed"/>
      <polygon points="9,-15 11,-24 15,-15" fill="#c2410c"/>
      <polygon points="10,-21 11,-24 12.5,-21" fill="#1c1917"/>
      <circle cx="17" cy="-12" r="1.5" fill="#1c1917"/>
    `;
    fox.append(foxTail, foxTailTip, foxLegB2, foxLegF2, foxTorso, foxLegB1, foxLegF1, foxHead);

    // 2. SPRINTING PILGRIM CHEF (2-jointed knees, fluttering coat-tail, pumping spoon!)
    const pilgrim = elSVG('g', { transform: 'translate(-76, -2)' });
    const pilLegBack  = elSVG('path', { stroke: '#0f172a', 'stroke-width': '4.8', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const pilLegFront = elSVG('path', { stroke: '#1e293b', 'stroke-width': '4.8', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const pilCape = elSVG('path', { fill: '#0f172a' });
    const pilBody = elSVG('g');
    pilBody.innerHTML = `
      <path d="M-13,-8 L13,-8 L9,-34 L-9,-34 Z" fill="#1e293b"/>
      <polygon points="-9,-34 9,-34 12,-26 -12,-26" fill="#f8fafc"/>
      <rect x="-11" y="-18" width="22" height="4" fill="#78350f"/>
      <rect x="-2" y="-19" width="6" height="6" fill="none" stroke="#fbbf24" stroke-width="1.5"/>
      <circle cx="3" cy="-43" r="10" fill="#f3c69f"/>
      <circle cx="7" cy="-45" r="1.8" fill="#1c1917"/>
      <circle cx="7" cy="-40" r="2.6" fill="#ef4444" opacity="0.55"/>
      <g transform="translate(-2, -52) rotate(-15)">
        <ellipse cx="0" cy="2" rx="16" ry="3.5" fill="#1c1917"/>
        <path d="M-10,2 L-7,-12 L7,-12 L10,2 Z" fill="#292524"/>
        <rect x="-9" y="-3" width="18" height="3.5" fill="#f59e0b"/>
      </g>
      <g class="speech" transform="translate(-28, -74)">
        <rect x="-34" y="-14" width="68" height="20" rx="10" fill="#fffbeb" stroke="#78350f" stroke-width="1.3"/>
        <text x="0" y="0" text-anchor="middle" fill="#7c2d12" font-family="'Caveat', cursive" font-size="16" font-weight="700">Wait up!!</text>
      </g>
    `;
    const pilArm = elSVG('g');
    pilArm.innerHTML = `
      <line x1="6" y1="-29" x2="25" y2="-37" stroke="#1e293b" stroke-width="5" stroke-linecap="round"/>
      <line x1="24" y1="-37" x2="41" y2="-49" stroke="#92400e" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="43" cy="-51" rx="5.5" ry="3.5" transform="rotate(-35 43 -51)" fill="#b45309"/>
    `;
    const speech = pilBody.querySelector('.speech');
    pilgrim.append(pilLegBack, pilCape, pilBody, pilLegFront, pilArm);

    // 3. ARTICULATED RUNAWAY TURKEY (2-jointed drumsticks, tail fan follow-through & frantic wing!)
    const turkey = elSVG('g', { transform: 'translate(22, -2)' });
    const turkLegB = elSVG('path', { stroke: '#d97706', 'stroke-width': '3.2', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const turkLegF = elSVG('path', { stroke: '#f59e0b', 'stroke-width': '3.2', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const turkBody = elSVG('g');
    const turkTail = elSVG('g', { transform: 'translate(-14, -18)' });
    turkTail.innerHTML = `
      <ellipse cx="-7" cy="-8" rx="5" ry="15" transform="rotate(-38 -7 -8)" fill="#b91c1c" stroke="#fde68a" stroke-width="0.9"/>
      <ellipse cx="-2" cy="-11" rx="5" ry="15" transform="rotate(-15 -2 -11)" fill="#ea580c" stroke="#fde68a" stroke-width="0.9"/>
      <ellipse cx="3" cy="-10" rx="5" ry="15" transform="rotate(10 3 -10)" fill="#d97706" stroke="#fde68a" stroke-width="0.9"/>
    `;
    const turkTorso = elSVG('ellipse', { cx: '0', cy: '-15', rx: '15.5', ry: '12.5', fill: '#6b3a19' });
    const turkNeckHead = elSVG('g');
    turkNeckHead.innerHTML = `
      <path d="M9,-17 C16,-22 19,-28 18,-35" stroke="#7c431e" stroke-width="7.5" fill="none" stroke-linecap="round"/>
      <circle cx="19" cy="-36" r="8.2" fill="#7c431e"/>
      <polygon points="26,-38 35,-35 26,-32" fill="#f59e0b"/>
      <path d="M24,-34 C28,-29 25,-23 21,-26 Z" fill="#dc2626"/>
      <circle cx="21" cy="-38" r="3.1" fill="#fff"/>
      <circle cx="22.2" cy="-38" r="1.4" fill="#1c1917"/>
      <text x="25" y="-49" fill="#fef08a" stroke="#7f1d1d" stroke-width="0.8" font-size="18" font-weight="800">!</text>
    `;
    const turkWing = elSVG('path', { d: 'M-8,-17 C-2,-28 10,-24 6,-13 C2,-9 -8,-10 -8,-17 Z', fill: '#92400e' });
    turkBody.append(turkTail, turkTorso, turkNeckHead, turkWing);
    turkey.append(turkLegB, turkBody, turkLegF);

    roam.append(fox, pilgrim, turkey);
    container.appendChild(roam);
    animatedChases.push({
      roam, fox, foxTail, foxTailTip, foxLegB1, foxLegB2, foxLegF1, foxLegF2, foxTorso, foxHead,
      pilgrim, pilLegBack, pilLegFront, pilCape, pilBody, pilArm, speech,
      turkey, turkLegB, turkLegF, turkBody, turkTail, turkNeckHead, turkWing
    });
  }
  svg.querySelectorAll('[data-chase]').forEach(buildArticulatedChase);

  // =========================================================================
  // PROCEDURAL LANDSCAPE & ARCHITECTURE (seeded => identical every load)
  // =========================================================================
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const f1 = n => (+n).toFixed(1);
  const polyD = pts => 'M' + pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' L') + ' Z';
  const lineD = pts => 'M' + pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' L');

  // Midpoint-displaced fractal ridge from a to b, with optional concave sag
  function jaggedLine(a, b, rand, rough, depth, sag) {
    let pts = [a, b];
    let amp = Math.hypot(b[0] - a[0], b[1] - a[1]) * rough;
    for (let d = 0; d < depth; d++) {
      const next = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i];
        const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
        const off = (rand() * 2 - 1) * amp;
        next.push([(p[0] + q[0]) / 2 - dy / len * off, (p[1] + q[1]) / 2 + dx / len * off], q);
      }
      pts = next;
      amp *= 0.52;
    }
    if (sag) {
      const n = pts.length - 1;
      pts = pts.map((p, i) => [p[0], p[1] + Math.sin(Math.PI * i / n) * sag]);
    }
    return pts;
  }
  // Keep the part of an apex->base polyline above y (with exact crossing point)
  function cutAbove(poly, y) {
    const out = [poly[0]];
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1], b = poly[i];
      if (b[1] < y) { out.push(b); continue; }
      const t = (y - a[1]) / ((b[1] - a[1]) || 1);
      out.push([a[0] + (b[0] - a[0]) * t, y]);
      break;
    }
    return out;
  }

  // Sculpted mountain: fractal ridges, lit/shadow faces, sub-ridge facets, gullies, drip-edged snowfields
  function buildPeak(parent, o) {
    const r = mulberry(o.seed);
    const apex = [o.x + (o.skew || 0), o.base - o.h];
    const L = [o.x - o.w / 2, o.base], R = [o.x + o.w / 2, o.base];
    const rough = o.rough ?? 0.075;
    const left  = jaggedLine(apex, L, r, rough, 6, o.h * 0.12);
    const right = jaggedLine(apex, R, r, rough, 6, o.h * 0.09);
    const spineEnd = [apex[0] + o.w * 0.09, o.base];
    const spine = jaggedLine(apex, spineEnd, r, 0.045, 5, 0);
    const g = elSVG('g', o.opacity ? { opacity: o.opacity } : {});
    parent.appendChild(g);
    g.appendChild(elSVG('path', { d: polyD([...left.slice().reverse(), ...right.slice(1)]), fill: o.shade }));
    g.appendChild(elSVG('path', { d: polyD([...left.slice().reverse(), ...spine.slice(1)]), fill: o.lit }));
    const at = (poly, f) => poly[Math.round(f * (poly.length - 1))];
    const wedge = (from, to, off, fill, op) => {
      const a = jaggedLine(from, to, r, 0.08, 4, 0);
      const b = a.map(([x, y], i) => [x + off * (i / (a.length - 1)), y]).reverse();
      g.appendChild(elSVG('path', { d: polyD([...a, ...b]), fill, opacity: op }));
    };
    if (o.facets !== false) {
      for (const f of [0.26, 0.48, 0.7]) {           // sunlit face: sub-ridges cast shadow wedges
        const bx = L[0] + (spineEnd[0] - L[0]) * (0.18 + r() * 0.5);
        wedge(at(spine, f), [bx, o.base], o.w * 0.075, '#1e293b', 0.22);
      }
      for (const f of [0.22, 0.46, 0.7]) {            // shadow face: sub-ridges catch rim light
        const bx = spineEnd[0] + (R[0] - spineEnd[0]) * (0.25 + r() * 0.55);
        wedge(at(spine, f), [bx, o.base], -o.w * 0.045, '#cbd5e1', 0.13);
      }
      let gd = '';                                     // erosion gullies off the lit ridge
      for (let k = 0; k < 7; k++) {
        const p = at(left, 0.2 + r() * 0.7);
        const len = o.h * (0.08 + r() * 0.12);
        gd += lineD(jaggedLine(p, [p[0] + len * 0.45, p[1] + len], r, 0.12, 3, 0)) + ' ';
      }
      g.appendChild(elSVG('path', { d: gd, stroke: '#334155', 'stroke-width': 1.4, fill: 'none', opacity: 0.28, 'stroke-linecap': 'round' }));
    }
    if (o.snowFrac) {
      const sy = apex[1] + o.h * o.snowFrac;
      const sl = cutAbove(left, sy), ss = cutAbove(spine, sy), sr = cutAbove(right, sy);
      const drip = (a, b, n) => {
        const pts = [];
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const d = i % 2 ? (0.35 + r() * 0.65) * o.h * 0.085 : r() * o.h * 0.012;
          pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + d]);
        }
        return pts;
      };
      const sEnd = ss[ss.length - 1], lEnd = sl[sl.length - 1], rEnd = sr[sr.length - 1];
      g.appendChild(elSVG('path', { d: polyD([...ss, ...drip(sEnd, rEnd, 5), ...sr.slice().reverse().slice(0, -1)]), fill: o.snowShade || '#b4c2d6' }));
      g.appendChild(elSVG('path', { d: polyD([...ss, ...drip(sEnd, lEnd, 7), ...sl.slice().reverse().slice(0, -1)]), fill: o.snowLit || '#fffbeb' }));
      g.appendChild(elSVG('path', { d: lineD(sl), stroke: '#ffffff', 'stroke-width': 1.6, fill: 'none', opacity: 0.75 }));
    }
    return { apex, left, right, spine };
  }

  // Dense tiered-conifer forest silhouette band (single path)
  function buildForestBand(parent, o) {
    const r = mulberry(o.seed);
    const yAt = x => o.y + Math.sin(x * 0.006 + o.seed) * (o.roll || 6);
    let d = `M${o.x0},${o.y + 60} L${o.x0},${f1(yAt(o.x0))}`;
    let x = o.x0;
    while (x < o.x1) {
      const h = o.hMin + r() * (o.hMax - o.hMin), hw = h * 0.26, y = yAt(x);
      d += ` L${f1(x)},${f1(y)} L${f1(x + hw * 0.55)},${f1(y - h * 0.38)} L${f1(x + hw * 0.35)},${f1(y - h * 0.38)}` +
           ` L${f1(x + hw * 0.8)},${f1(y - h * 0.7)} L${f1(x + hw * 0.65)},${f1(y - h * 0.7)} L${f1(x + hw)},${f1(y - h)}` +
           ` L${f1(x + hw * 1.35)},${f1(y - h * 0.7)} L${f1(x + hw * 1.2)},${f1(y - h * 0.7)} L${f1(x + hw * 1.65)},${f1(y - h * 0.38)}` +
           ` L${f1(x + hw * 1.45)},${f1(y - h * 0.38)} L${f1(x + hw * 2)},${f1(y)}`;
      x += hw * (1.25 + r() * 0.9);
    }
    d += ` L${o.x1},${o.y + 60} Z`;
    parent.appendChild(elSVG('path', { d, fill: o.fill, opacity: o.opacity ?? 1 }));
  }

  // Rolling ridge whose crest is built from individual rounded tree crowns
  function buildCanopyRidge(parent, o) {
    const r = mulberry(o.seed);
    const x0 = o.x0 ?? -400, x1 = o.x1 ?? 2060, bottom = o.bottom ?? 900;
    const yAt = x => o.y0 + Math.sin(x * o.freq + o.phase) * o.amp + Math.sin(x * o.freq * 2.3 + o.phase * 1.7) * o.amp * 0.35;
    let x = x0, d = `M${x0},${bottom} L${x0},${f1(yAt(x0))}`;
    while (x < x1) {
      const cw = o.crown * (0.7 + r() * 0.7), nx = x + cw;
      const top = Math.min(yAt(x), yAt(nx)) - cw * (0.45 + r() * 0.3);
      d += ` Q${f1(x + cw / 2)},${f1(top)} ${f1(nx)},${f1(yAt(nx))}`;
      x = nx;
    }
    d += ` L${x1},${bottom} Z`;
    parent.appendChild(elSVG('path', { d, fill: o.fill, opacity: o.opacity ?? 1 }));
    return yAt;
  }
  // Scatter autumn-colored crown blobs below a ridge crest (one path per color)
  function sprinkleCrowns(parent, yAt, o) {
    const r = mulberry(o.seed);
    const ds = o.colors.map(() => '');
    for (let i = 0; i < o.count; i++) {
      const x = (o.x0 ?? -380) + r() * ((o.x1 ?? 2380) - (o.x0 ?? -380));
      const y = yAt(x) + o.top + r() * o.depth;
      const rad = o.rMin + r() * o.rRange;
      const k = Math.floor(r() * o.colors.length);
      ds[k] += `M${f1(x - rad)},${f1(y)} a${f1(rad)},${f1(rad)} 0 1,0 ${f1(rad * 2)},0 a${f1(rad)},${f1(rad)} 0 1,0 ${f1(-rad * 2)},0 `;
    }
    o.colors.forEach((c, k) => ds[k] && parent.appendChild(elSVG('path', { d: ds[k], fill: c, opacity: o.opacity ?? 0.8 })));
  }
  function mistBand(parent, y, h, cls, op = 1) {
    const g = elSVG('g', { class: cls, opacity: op });
    g.appendChild(elSVG('rect', { x: -400, y, width: 2800, height: h, fill: 'url(#mistBandGrad)' }));
    parent.appendChild(g);
  }

  // ---- ROCKY MOUNTAINS -----------------------------------------------------
  (function buildRockies() {
    const host = byId('rockiesProc');
    const far = [[-260, 250, 430], [40, 215, 400], [330, 268, 460], [610, 232, 420], [890, 282, 470],
                 [1180, 240, 430], [1460, 272, 450], [1740, 236, 420], [2010, 256, 440]];
    far.forEach(([x, h, w], i) => buildPeak(host, {
      x, base: 748, h, w, seed: 11 + i * 7, lit: '#a6b5ca', shade: '#8293ad', snowFrac: 0.26,
      snowLit: '#eef2f7', snowShade: '#c6d0df', facets: false, rough: 0.06, opacity: 0.8 }));
    mistBand(host, 610, 90, 'mist-2', 0.9);
    const hero = [
      { x: 175,  base: 822, h: 472, w: 790, skew: 10,  seed: 101 },
      { x: 660,  base: 800, h: 340, w: 600, skew: -14, seed: 202 },
      { x: 1040, base: 805, h: 300, w: 520, skew: 8,   seed: 303 },
      { x: 1420, base: 815, h: 440, w: 720, skew: -6,  seed: 404 },
      { x: 1745, base: 822, h: 478, w: 700, skew: 12,  seed: 505 },
    ];
    hero.forEach(p => buildPeak(host, { ...p, lit: 'url(#rockLitGrad)', shade: 'url(#rockShadeGrad)', snowFrac: 0.30 }));
    // Cascading glacial waterfall with animated flowing dashes
    const fallD = 'M214,578 C220,612 206,640 218,676 S210,708 220,732';
    host.appendChild(elSVG('path', { d: fallD, stroke: '#bae6fd', 'stroke-width': 9, fill: 'none', opacity: 0.75, 'stroke-linecap': 'round' }));
    host.appendChild(elSVG('path', { d: fallD, class: 'falls-flow', stroke: '#ffffff', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }));
    mistBand(host, 668, 54, 'mist-1', 0.8);
    buildForestBand(host, { x0: -320, x1: 2220, y: 722, hMin: 18, hMax: 34, fill: '#2f5a45', seed: 7, opacity: 0.92 });
    sprinkleCrowns(host, () => 712, { seed: 71, count: 46, colors: ['#facc15', '#eab308', '#f59e0b'], top: -6, depth: 14, rMin: 4, rRange: 4, opacity: 0.9 });
    buildForestBand(host, { x0: -320, x1: 2220, y: 738, hMin: 26, hMax: 50, fill: '#163a2a', seed: 19 });
  })();

  // ---- GREAT SMOKY MOUNTAINS -------------------------------------------------
  (function buildSmokies() {
    const host = byId('smokiesProc');
    const autumn = ['#c2410c', '#ea580c', '#f59e0b', '#b91c1c', '#facc15'];
    buildCanopyRidge(host, { y0: 505, amp: 48, freq: 0.0042, phase: 0.6, crown: 15, fill: '#8a93c2', opacity: 0.62, seed: 31 });
    mistBand(host, 540, 70, 'mist-1');
    buildCanopyRidge(host, { y0: 555, amp: 42, freq: 0.0036, phase: 2.1, crown: 18, fill: '#6870a6', opacity: 0.82, seed: 32 });
    mistBand(host, 590, 64, 'mist-2');
    buildCanopyRidge(host, { y0: 605, amp: 36, freq: 0.0048, phase: 4.0, crown: 21, fill: '#4f4c86', seed: 33 });
    buildCanopyRidge(host, { y0: 622, amp: 32, freq: 0.0051, phase: 4.4, crown: 19, fill: '#5b4480', seed: 35 });
    mistBand(host, 640, 56, 'mist-1', 0.9);
    buildCanopyRidge(host, { y0: 652, amp: 28, freq: 0.0055, phase: 1.2, crown: 24, fill: '#5e2d4e', seed: 34 });
    buildCanopyRidge(host, { y0: 668, amp: 24, freq: 0.0058, phase: 1.6, crown: 22, fill: '#76323f', seed: 36 });
    buildCanopyRidge(host, { y0: 684, amp: 22, freq: 0.0062, phase: 2.0, crown: 20, fill: '#8a3b2a', seed: 37 });
  })();
  (function buildSmokiesMid() {
    const host = byId('smokiesMidProc');
    const rows = [
      [700, '#9a3412', 61, 26], [714, '#b45309', 62, 24], [728, '#c2410c', 63, 22],
      [742, '#a16207', 64, 24], [756, '#b91c1c', 65, 22], [770, '#7c2d12', 66, 26],
    ];
    rows.forEach(([y0, fill, seed, crown], i) => buildCanopyRidge(host, {
      y0, amp: 26 - i * 2, freq: 0.0042 + i * 0.0003, phase: 0.4 + i * 0.55, crown, fill, seed, x0: -450, x1: 2380 }));
  })();

  // ---- NEW YORK CITY -----------------------------------------------------------
  (function buildNYC() {
    const host = byId('nycProc');
    const r = mulberry(909);
    const BASE = 726;
    const add = (tag, attrs, parent = host) => { const n = elSVG(tag, attrs); parent.appendChild(n); return n; };
    const reflect = [];

    // 1. Hazy back skyline (aerial perspective) with sparse lit windows
    let dBack = '', x = -320;
    while (x < 2200) {
      const w = 30 + r() * 56, h = 120 + r() * 185, top = BASE - h;
      dBack += `M${f1(x)},${BASE} V${f1(top)} H${f1(x + w)} V${BASE} Z `;
      if (r() < 0.35) dBack += `M${f1(x + w * 0.25)},${f1(top + 1)} V${f1(top - 16 - r() * 22)} H${f1(x + w * 0.75)} V${f1(top + 1)} Z `;
      x += w + r() * 6;
    }
    add('path', { d: dBack, fill: '#68728f', opacity: 0.62 });
    add('path', { d: dBack, fill: 'url(#winLit)', opacity: 0.22 });

    // 2. Building toolkit
    const tier = (g, cx, w, top, bottom, o = {}) => {
      const xl = cx - w / 2, h = bottom - top;
      add('rect', { x: f1(xl), y: f1(top), width: f1(w), height: f1(h), fill: o.color || '#3d4864' }, g);
      add('rect', { x: f1(xl + w * 0.64), y: f1(top), width: f1(w * 0.36), height: f1(h), fill: o.side || '#252e45' }, g);
      if (h > 24 && w > 22) {
        add('rect', { x: f1(xl + 4), y: f1(top + 6), width: f1(w - 8), height: f1(h - 8), fill: 'url(#winUnlit)' }, g);
        add('rect', { x: f1(xl + 4), y: f1(top + 6), width: f1(w - 8), height: f1(h - 8), fill: 'url(#winLit)' }, g);
      }
      add('rect', { x: f1(xl - 1.5), y: f1(top - 2), width: f1(w + 3), height: 3.5, fill: o.cornice || '#7b879e' }, g);
    };
    const waterTower = (g, x, y) => {
      add('path', { d: `M${f1(x - 7)},${f1(y)} L${f1(x - 5)},${f1(y - 10)} M${f1(x + 7)},${f1(y)} L${f1(x + 5)},${f1(y - 10)} M${f1(x - 6)},${f1(y - 4)} L${f1(x + 6)},${f1(y - 4)}`,
                    stroke: '#1f2937', 'stroke-width': 1.6, fill: 'none' }, g);
      add('rect', { x: f1(x - 8), y: f1(y - 24), width: 16, height: 14, rx: 2, fill: '#7c4a25' }, g);
      add('path', { d: `M${f1(x - 8)},${f1(y - 17)} H${f1(x + 8)}`, stroke: '#4a2a12', 'stroke-width': 1.2 }, g);
      add('path', { d: `M${f1(x - 9.5)},${f1(y - 24)} L${f1(x)},${f1(y - 33)} L${f1(x + 9.5)},${f1(y - 24)} Z`, fill: '#3f2a1a' }, g);
    };
    const bldg = (cx, w, h, kind) => {
      const g = add('g', {});
      const top = BASE - h;
      if (kind === 'setback') {
        tier(g, cx, w, top + 46, BASE);
        tier(g, cx - w * 0.06, w * 0.7, top + 18, top + 46);
        tier(g, cx - w * 0.06, w * 0.42, top, top + 18);
      } else tier(g, cx, w, top, BASE);
      if (kind === 'tower') waterTower(g, cx - w * 0.18, top - 1.5);
      if (kind === 'antenna') {
        add('line', { x1: f1(cx), y1: f1(top), x2: f1(cx), y2: f1(top - 34), stroke: '#cbd5e1', 'stroke-width': 1.6 }, g);
        add('circle', { cx: f1(cx), cy: f1(top - 34), r: 2.2, fill: '#ef4444', class: 'beacon-beam' }, g);
      }
      reflect.push([cx, w, h]);
    };

    // 3. Front street wall
    [[-170, 68, 190, 'tower'], [-105, 58, 150, ''], [-45, 70, 240, 'antenna'], [20, 56, 175, 'tower'], [82, 64, 212, 'setback'],
     [152, 60, 165, 'tower'], [332, 70, 252, 'setback'], [402, 62, 186, 'tower'], [472, 78, 216, ''],
     [552, 70, 200, 'tower'], [632, 60, 170, ''], [702, 80, 232, 'setback'], [782, 64, 190, 'tower'], [862, 72, 216, ''],
     [942, 60, 182, 'antenna'], [1022, 76, 206, 'tower'], [1100, 64, 180, 'tower'], [1170, 72, 232, 'setback'],
     [1245, 58, 198, 'tower'], [1322, 76, 246, 'antenna'], [1615, 74, 252, 'tower'], [1690, 66, 200, 'setback'],
     [1762, 80, 232, 'antenna'], [1842, 70, 182, 'tower'], [1912, 62, 212, '']
    ].forEach(b => bldg(...b));

    // 4. One World Trade Center — chamfered glass prism
    (function (cx) {
      const g = add('g', {}), T = 398;
      add('polygon', { points: `${cx - 32},${BASE} ${cx - 17},${T} ${cx + 17},${T} ${cx + 32},${BASE}`, fill: '#3b4660' }, g);
      add('polygon', { points: `${cx - 32},${BASE} ${cx - 17},${T} ${cx + 2},${BASE}`, fill: '#8d9bb3' }, g);
      add('polygon', { points: `${cx - 17},${T} ${cx + 17},${T} ${cx + 2},${BASE}`, fill: '#5f6c87' }, g);
      add('polygon', { points: `${cx + 17},${T} ${cx + 32},${BASE} ${cx + 2},${BASE}`, fill: '#2c3650' }, g);
      add('polygon', { points: `${cx - 32},${BASE} ${cx - 17},${T} ${cx + 17},${T} ${cx + 32},${BASE}`, fill: 'url(#winLit)', opacity: 0.5 }, g);
      add('polygon', { points: `${cx - 25},${BASE - 40} ${cx - 15},${T + 30} ${cx - 11},${T + 30} ${cx - 19},${BASE - 40}`, fill: '#e0f2fe', opacity: 0.22 }, g);
      add('rect', { x: cx - 18, y: T - 6, width: 36, height: 6, fill: '#64748b' }, g);
      add('line', { x1: cx, y1: T - 6, x2: cx, y2: T - 70, stroke: '#e2e8f0', 'stroke-width': 2.6 }, g);
      add('circle', { cx, cy: T - 70, r: 2.6, fill: '#ef4444', class: 'beacon-beam' }, g);
      reflect.push([cx, 64, BASE - T]);
    })(247);

    // 5. Empire State Building — stepped Art-Deco setbacks, piers, lit crown & mooring mast
    (function (cx) {
      const g = add('g', {});
      tier(g, cx, 98, 560, BASE, { color: '#4a5570', side: '#2f3850' });
      tier(g, cx, 78, 486, 560, { color: '#4f5a76', side: '#323c55' });
      tier(g, cx, 60, 446, 486, { color: '#56617d', side: '#36405a' });
      tier(g, cx, 42, 420, 446, { color: '#5d6884', side: '#3a445e' });
      let d = '';
      for (let px = cx - 44; px < cx + 12; px += 9) d += `M${px},562 V${BASE} `;
      for (let px = cx - 34; px < cx + 10; px += 9) d += `M${px},488 V558 `;
      add('path', { d, stroke: '#cbd5e1', 'stroke-width': 1, opacity: 0.22 }, g);
      add('rect', { x: cx - 14, y: 398, width: 28, height: 22, fill: '#64748b' }, g);
      add('rect', { x: cx - 11, y: 401, width: 22, height: 16, style: 'fill: var(--win-glow); opacity: var(--city-lit)' }, g);
      add('polygon', { points: `${cx - 9},398 ${cx},372 ${cx + 9},398`, fill: '#94a3b8' }, g);
      add('line', { x1: cx, y1: 372, x2: cx, y2: 312, stroke: '#e2e8f0', 'stroke-width': 3 }, g);
      add('circle', { cx, cy: 312, r: 2.6, fill: '#ef4444', class: 'beacon-beam' }, g);
      reflect.push([cx, 98, BASE - 398]);
    })(1445);

    // 6. Chrysler Building — terraced stainless arches with sunburst windows & needle spire
    (function (cx) {
      const g = add('g', {});
      tier(g, cx, 62, 488, BASE, { color: '#46516c', side: '#2c354d' });
      tier(g, cx, 48, 462, 488, { color: '#4d5874', side: '#313a53' });
      [[462, 48, 30], [444, 40, 26], [428, 32, 22], [414, 24, 18]].forEach(([y, w, h]) => {
        add('path', { d: `M${cx - w / 2},${y} Q${cx},${y - h * 1.15} ${cx + w / 2},${y} Z`, fill: '#dbe2ea' }, g);
        add('path', { d: `M${cx},${y} L${cx},${f1(y - h * 0.58)} Q${f1(cx + w * 0.3)},${f1(y - h * 0.5)} ${cx + w / 2},${y} Z`, fill: '#94a3b8', opacity: 0.7 }, g);
        for (let k = -2; k <= 2; k++) {
          const tx = cx + k * w * 0.17, ty = y - 2;
          add('polygon', { points: `${f1(tx - 2)},${ty} ${f1(tx)},${f1(ty - h * 0.32)} ${f1(tx + 2)},${ty}`, style: 'fill: var(--win-glow); opacity: var(--city-lit)' }, g);
        }
      });
      add('polygon', { points: `${cx - 4},405 ${cx},352 ${cx + 4},405`, fill: '#f1f5f9' }, g);
      add('line', { x1: cx, y1: 352, x2: cx, y2: 334, stroke: '#f8fafc', 'stroke-width': 1.6 }, g);
      reflect.push([cx, 62, BASE - 405]);
    })(1541);

    // 7. Battery seawall, harbor water & rippling skyline reflections
    add('rect', { x: -350, y: BASE - 5, width: 2700, height: 8, fill: '#1f2937' });
    add('rect', { x: -350, y: BASE + 2, width: 2700, height: 145, fill: 'url(#oceanAtlGrad)' });
    const refl = add('g', { class: 'wave-swell' });
    let dR = '', dG = '';
    for (const [cx, w, h] of reflect) {
      const depth = Math.min(110, h * 0.34), bands = 6;
      for (let k = 0; k < bands; k++) {
        const y = BASE + 5 + k * depth / bands;
        const shrink = k * 2.2;
        dR += `M${f1(cx - w / 2 + shrink)},${f1(y)} h${f1(w - shrink * 2)} v${f1(depth / bands * 0.62)} h${f1(-(w - shrink * 2))} Z `;
      }
      for (let k = 0; k < 3; k++) {
        const gx = cx - w * 0.35 + r() * w * 0.6, gy = BASE + 10 + r() * depth;
        dG += `M${f1(gx)},${f1(gy)} h${f1(6 + r() * 10)} `;
      }
    }
    add('path', { d: dR, fill: '#0b1226', opacity: 0.32 }, refl);
    add('path', { d: dG, stroke: '#fde047', 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none', style: 'opacity: calc(var(--city-lit) * 0.7)' }, refl);
    add('path', { d: 'M120,770 h70 M520,786 h90 M980,768 h60 M1330,792 h84 M1700,774 h66', stroke: '#93c5fd', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.3 }, refl);
  })();


  // ---- SHARED COASTAL / DESERT TOOLKIT --------------------------------------
  function blobD(cx, cy, rx, ry, r, n = 8, jit = 0.18) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, k = 1 + (r() * 2 - 1) * jit;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const m0 = mid(pts[n - 1], pts[0]);
    let d = `M${f1(m0[0])},${f1(m0[1])} `;
    for (let i = 0; i < n; i++) {
      const p = pts[i], m = mid(p, pts[(i + 1) % n]);
      d += `Q${f1(p[0])},${f1(p[1])} ${f1(m[0])},${f1(m[1])} `;
    }
    return d + 'Z';
  }
  function yOnPoly(poly, x) {
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1], b = poly[i];
      if ((x >= a[0] && x <= b[0]) || (x <= a[0] && x >= b[0])) {
        const t = (x - a[0]) / ((b[0] - a[0]) || 1);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return poly[poly.length - 1][1];
  }
  // Perspective wave field: short swells near the horizon, longer & bolder toward the viewer
  function buildWaveField(parent, o) {
    const r = mulberry(o.seed);
    const g = elSVG('g', { class: 'wave-swell' });
    parent.appendChild(g);
    const ds = ['', '', ''];
    for (let y = o.y0 + 5; y < o.y1;) {
      const depth = (y - o.y0) / (o.y1 - o.y0);
      const band = depth < 0.33 ? 0 : depth < 0.66 ? 1 : 2;
      const n = 5 + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        const x = o.x0 + r() * (o.x1 - o.x0), L = 14 + depth * 60 + r() * 22, h = 1 + depth * 3.2;
        ds[band] += `M${f1(x)},${f1(y)} q${f1(L / 2)},${f1(-h)} ${f1(L)},0 `;
      }
      y += 5 + depth * 16 + r() * 3;
    }
    [[1, 0.32], [1.6, 0.42], [2.4, 0.52]].forEach(([w, op], k) =>
      g.appendChild(elSVG('path', { d: ds[k], stroke: o.color, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round', opacity: op })));
  }
  // Shimmering column of light on the water beneath the sun (day) or moon (night)
  function buildGlitter(parent, o) {
    const r = mulberry(o.seed);
    let d = '';
    for (let y = o.y0 + 4; y < o.y1; y += 4 + (y - o.y0) * 0.05) {
      const depth = (y - o.y0) / (o.y1 - o.y0), spread = 18 + depth * 120;
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) d += `M${f1(o.x + (r() * 2 - 1) * spread)},${f1(y)} h${f1(5 + depth * 26 * r())} `;
    }
    const g = elSVG('g', { class: 'glitter-shimmer' });
    g.appendChild(elSVG('path', { d, stroke: o.color, 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none', style: `opacity: calc(var(${o.varName}) * ${o.op})` }));
    parent.appendChild(g);
  }

  // ---- SOUTHWEST DESERT ---------------------------------------------------------
  function buildMesaSkyline(parent, o) {
    const r = mulberry(o.seed);
    let x = o.x0, d = `M${o.x0},${o.y + 80} L${o.x0},${o.y}`;
    while (x < o.x1) {
      x += 20 + r() * 120;
      d += ` L${f1(x)},${f1(o.y - r() * 4)}`;
      const h = o.hMin + r() * (o.hMax - o.hMin), w = h + 60 + r() * 200;
      d += ` L${f1(x + h * 0.32)},${f1(o.y - h * 0.45)} L${f1(x + h * 0.4)},${f1(o.y - h)} L${f1(x + w - h * 0.4)},${f1(o.y - h)}` +
           ` L${f1(x + w - h * 0.3)},${f1(o.y - h * 0.5)} L${f1(x + w)},${f1(o.y)}`;
      x += w;
    }
    d += ` L${o.x1},${o.y} L${o.x1},${o.y + 80} Z`;
    parent.appendChild(elSVG('path', { d, fill: o.fill, opacity: o.opacity }));
  }
  // Monument-Valley butte: sheer stratified columns with caprock, desert varnish, concave scree skirt
  function buildButte(parent, o) {
    const r = mulberry(o.seed);
    const g = elSVG('g');
    parent.appendChild(g);
    const H = o.talusH, cliffBot = o.base - H;
    const spans = o.cols.map(c => [o.x + c.dx - c.w / 2, o.x + c.dx + c.w / 2]);
    const minX = Math.min(...spans.map(v => v[0])) + 4, maxX = Math.max(...spans.map(v => v[1])) - 4;
    const prof = (x0, sg) => {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const d = i / 12;
        pts.push([x0 + sg * o.skirt * d, cliffBot + H * (1 - (1 - d) * (1 - d)) + (i && i < 12 ? (r() * 2 - 1) * 1.6 : 0)]);
      }
      return pts;
    };
    const pl = prof(minX, -1), pr = prof(maxX, 1);
    g.appendChild(elSVG('path', { d: polyD([...pl, ...pr.slice().reverse()]), fill: o.talus }));
    g.appendChild(elSVG('path', { d: polyD([[o.x + 12, cliffBot], ...pr, [o.x + 34, o.base]]), fill: '#7c2d12', opacity: 0.34 }));
    // scree speckle (only inside the skirt)
    let sd = '';
    for (let k = 0; k < 70; k++) {
      const x = minX - o.skirt * 0.85 + r() * (maxX - minX + o.skirt * 1.7);
      let ytop = cliffBot;
      if (x < minX) { const d = (minX - x) / o.skirt; ytop = cliffBot + H * (1 - (1 - d) * (1 - d)); }
      if (x > maxX) { const d = (x - maxX) / o.skirt; ytop = cliffBot + H * (1 - (1 - d) * (1 - d)); }
      const y = ytop + 3 + r() * Math.max(1, o.base - ytop - 5);
      sd += `M${f1(x)},${f1(y)} h${f1(1.5 + r() * 3)} `;
    }
    g.appendChild(elSVG('path', { d: sd, stroke: '#7c2d12', 'stroke-width': 1.6, opacity: 0.35, 'stroke-linecap': 'round' }));
    for (const c of o.cols) {
      const xl = o.x + c.dx - c.w / 2, xr = xl + c.w, top = cliffBot - c.h;
      const bat = c.w * 0.06 + 3;
      const L = jaggedLine([xl + bat * 0.5, top], [xl - bat, cliffBot + 3], r, 0.045, 4, 0);
      const R = jaggedLine([xr - bat * 0.5, top], [xr + bat, cliffBot + 3], r, 0.045, 4, 0);
      const T = jaggedLine([xl + bat * 0.5, top], [xr - bat * 0.5, top], r, 0.03, 3, 0);
      g.appendChild(elSVG('path', { d: polyD([...T, ...R.slice(1), ...L.slice().reverse().slice(0, -1)]), fill: o.shade }));
      const sx = xl + c.w * (c.litFrac ?? 0.6);
      const spine = jaggedLine([sx, top], [sx - 1, cliffBot + 3], r, 0.03, 4, 0);
      g.appendChild(elSVG('path', { d: polyD([...T.filter(p => p[0] < sx), ...spine, ...L.slice().reverse()]), fill: o.lit }));
      // sedimentary strata
      let st1 = '', st2 = '';
      for (let y = top + 10; y < cliffBot - 2; y += 7 + r() * 9) {
        const seg = `M${f1(xl + 3)},${f1(y)} Q${f1((xl + xr) / 2)},${f1(y + (r() * 2 - 1) * 2)} ${f1(xr - 3)},${f1(y)} `;
        if (r() < 0.5) st1 += seg; else st2 += seg;
      }
      g.appendChild(elSVG('path', { d: st1, stroke: '#fed7aa', 'stroke-width': 1.6, fill: 'none', opacity: 0.3 }));
      g.appendChild(elSVG('path', { d: st2, stroke: '#5c1a0c', 'stroke-width': 2.4, fill: 'none', opacity: 0.22 }));
      // desert varnish streaks pouring off the caprock
      let vd = '';
      for (let k = 0; k < c.w / 7; k++) {
        const vx = xl + 4 + r() * (c.w - 8);
        vd += `M${f1(vx)},${f1(top + 8)} v${f1(8 + r() * c.h * 0.4)} `;
      }
      g.appendChild(elSVG('path', { d: vd, stroke: '#3b1206', 'stroke-width': 1.6, opacity: 0.13, 'stroke-linecap': 'round' }));
      // resistant caprock ledge + sunlit rim
      g.appendChild(elSVG('path', { d: polyD([[xl - 3, top - 1], [xr + 3, top - 1], [xr + 1, top + 8], [xl - 1, top + 8]]), fill: o.cap }));
      g.appendChild(elSVG('path', { d: `M${f1(xl - 3)},${f1(top - 1)} H${f1(sx)}`, stroke: '#fdba74', 'stroke-width': 1.8, opacity: 0.65 }));
    }
    for (let k = 0; k < 7; k++) {
      const bx = minX - o.skirt * 0.7 + r() * (maxX - minX + o.skirt * 1.4), rad = 3 + r() * 5;
      g.appendChild(elSVG('path', { d: blobD(bx, o.base - rad * 0.4, rad * 1.3, rad * 0.8, r), fill: '#9a3412' }));
    }
  }
  (function buildDesert() {
    const host = byId('desertProc');
    buildMesaSkyline(host, { x0: -400, x1: 2300, y: 732, hMin: 50, hMax: 105, fill: '#c46a74', opacity: 0.42, seed: 81 });
    buildMesaSkyline(host, { x0: -400, x1: 2300, y: 734, hMin: 22, hMax: 55, fill: '#b04a2c', opacity: 0.7, seed: 82 });
    host.appendChild(elSVG('path', { d: 'M-350,900 L-350,732 L2350,732 L2350,900 Z', fill: '#c2410c' }));
    const C = { lit: 'url(#butteLitGrad)', shade: '#8a3519', talus: '#d9773a', cap: '#7a2e14' };
    buildButte(host, { ...C, x: 185,  base: 742, talusH: 62, skirt: 115, seed: 91, cols: [{ dx: -20, w: 122, h: 150 }, { dx: 62, w: 26, h: 118 }] });
    buildButte(host, { ...C, x: 555,  base: 740, talusH: 48, skirt: 90,  seed: 92, cols: [{ dx: 0, w: 150, h: 78 }] });
    buildButte(host, { ...C, x: 1355, base: 742, talusH: 60, skirt: 112, seed: 93, cols: [{ dx: 20, w: 118, h: 142, litFrac: 0.55 }, { dx: -62, w: 26, h: 108 }] });
    buildButte(host, { ...C, x: 1690, base: 744, talusH: 52, skirt: 70,  seed: 94, cols: [{ dx: 0, w: 34, h: 188, litFrac: 0.5 }] });
  })();

  // ---- PACIFIC COAST ---------------------------------------------------------------
  (function buildPacificFar() {
    const host = byId('pacificProc');
    const hills = (y0, slope, a1, a2, seed, fill, op, x1) => {
      const rr = mulberry(seed * 100);
      const pts = [];
      for (let x = -420; x <= x1; x += 14)
        pts.push([x, y0 + x * slope + Math.sin(x * 0.006 + seed) * a1 + Math.sin(x * 0.017 + seed * 2) * a2 + (rr() * 2 - 1) * 1.6]);
      host.appendChild(elSVG('path', { d: polyD([...pts, [x1, 900], [-420, 900]]), fill, opacity: op }));
      return pts;
    };
    hills(556, 0.06, 34, 10, 3, '#8b97ad', 0.62, 2140);           // hazy outer coast range
    const front = hills(584, 0.075, 28, 9, 5, '#b08d57', 1, 1500); // golden autumn Marin headlands
    hills(604, 0.075, 26, 8, 5.3, '#8a6a3d', 0.55, 1500);          // shadowed lower folds
    const r = mulberry(152);
    let dc = '';                                                    // dark coastal-chaparral clumps
    for (let k = 0; k < 120; k++) {
      const x = -400 + r() * 1700, y = yOnPoly(front, x) + 5 + r() * 40;
      if (y > 642) continue;
      const rad = 3 + r() * 5;
      dc += `M${f1(x - rad)},${f1(y)} a${f1(rad)},${f1(rad * 0.75)} 0 1,0 ${f1(rad * 2)},0 a${f1(rad)},${f1(rad * 0.75)} 0 1,0 ${f1(-rad * 2)},0 `;
    }
    host.appendChild(elSVG('path', { d: dc, fill: '#4d5b2a', opacity: 0.75 }));
    host.appendChild(elSVG('rect', { x: -400, y: 646, width: 2540, height: 254, fill: 'url(#oceanPacGrad)' }));
    host.appendChild(elSVG('path', { d: 'M-400,646.5 H2140', stroke: '#e0f2fe', 'stroke-width': 1.2, opacity: 0.5 }));
    const mist = elSVG('g', { class: 'mist-1' });
    mist.appendChild(elSVG('rect', { x: -200, y: 622, width: 1100, height: 44, fill: 'url(#mistBandGrad)' }));
    host.appendChild(mist);
    buildWaveField(host, { y0: 646, y1: 830, x0: -400, x1: 2080, seed: 153, color: '#bae6fd' });
    buildGlitter(host, { x: 237, y0: 646, y1: 820, color: '#fef08a', varName: '--sun-op', op: 0.6, seed: 154 });
    buildGlitter(host, { x: 1260, y0: 646, y1: 820, color: '#fef3c7', varName: '--stars-op', op: 0.6, seed: 155 });
    const stack = (x, base, w, h, seed) => {
      const rr = mulberry(seed);
      const L = jaggedLine([x - w / 2, base], [x - w * 0.15, base - h], rr, 0.12, 4, 0);
      const T = jaggedLine([x - w * 0.15, base - h], [x + w * 0.2, base - h * 0.85], rr, 0.1, 3, 0);
      const R = jaggedLine([x + w * 0.2, base - h * 0.85], [x + w / 2, base], rr, 0.12, 4, 0);
      host.appendChild(elSVG('path', { d: polyD([...L, ...T.slice(1), ...R.slice(1)]), fill: '#334155' }));
      host.appendChild(elSVG('path', { d: polyD([...L, ...T.slice(1, Math.ceil(T.length / 2)), [x, base]]), fill: '#64748b' }));
      host.appendChild(elSVG('path', { d: `M${f1(x - w * 0.75)},${base} Q${x},${base + 5} ${f1(x + w * 0.75)},${base}`,
        stroke: '#e0f2fe', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round', class: 'surf-foam' }));
    };
    stack(1292, 690, 58, 54, 161); stack(1348, 686, 30, 34, 162); stack(1396, 684, 20, 20, 163);
  })();
  (function buildBigSurCliff() {
    const host = byId('pacificCliffProc');
    const r = mulberry(121);
    const top = [...jaggedLine([1252, 646], [1450, 588], r, 0.05, 4, 0),
                 ...jaggedLine([1450, 588], [1760, 632], r, 0.04, 4, 0).slice(1),
                 ...jaggedLine([1760, 632], [2350, 820], r, 0.03, 4, 0).slice(1)];
    const face = jaggedLine([1132, 862], [1252, 646], r, 0.07, 5, 0);
    host.appendChild(elSVG('path', { d: polyD([...face, ...top.slice(1), [2350, 900], [1132, 900]]), fill: '#7a3b1e' }));
    const inner = face.map(([x, y], i) => [x + 72 + (r() * 2 - 1) * 6, y + 8]).reverse();
    host.appendChild(elSVG('path', { d: polyD([...face, ...inner]), fill: '#b5673a' }));
    let fd = '';                                                    // dipping strata & fissures
    for (let k = 0; k < 12; k++) {
      const p = face[Math.floor(r() * (face.length - 1))], len = 40 + r() * 70;
      fd += lineD(jaggedLine([p[0] + 4, p[1]], [p[0] + len, p[1] + len * 0.32], r, 0.08, 3, 0)) + ' ';
    }
    for (let k = 0; k < 9; k++) {
      const p = top[Math.floor(r() * (top.length - 1))];
      fd += lineD(jaggedLine([p[0], p[1] + 12], [p[0] + (r() * 2 - 1) * 8, p[1] + 40 + r() * 60], r, 0.1, 3, 0)) + ' ';
    }
    host.appendChild(elSVG('path', { d: fd, stroke: '#4a220f', 'stroke-width': 1.5, fill: 'none', opacity: 0.32, 'stroke-linecap': 'round' }));
    const capLow = top.map(([x, y]) => [x, y + 9 + r() * 7]).reverse();
    host.appendChild(elSVG('path', { d: polyD([...top, ...capLow]), fill: '#8a8a3a' }));
    let sd = '';
    for (let k = 0; k < 46; k++) {
      const p = top[Math.floor(r() * (top.length - 1))], rad = 4 + r() * 5;
      sd += blobD(p[0], p[1] - 1, rad * 1.3, rad * 0.85, r) + ' ';
    }
    host.appendChild(elSVG('path', { d: sd, fill: '#55652c' }));
    for (const [x, y, w] of [[1095, 812, 80], [1150, 820, 70], [1210, 806, 60]]) {
      host.appendChild(elSVG('path', { d: `M${x - w / 2},${y} Q${x},${y - 8} ${x + w / 2},${y}`, stroke: '#f0f9ff', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', class: 'surf-foam' }));
    }
  })();

  // ---- ATLANTIC COAST ---------------------------------------------------------------
  (function buildAtlanticFar() {
    const host = byId('atlanticProc');
    const r = mulberry(141);
    let d = 'M-350,657';
    for (let x = -350; x <= 900; x += 20) d += ` L${x},${f1(655 - Math.max(0, Math.sin((x + 350) / 1250 * Math.PI)) * 14 - r() * 3)}`;
    host.appendChild(elSVG('path', { d: d + ' L900,657 Z', fill: '#64748b', opacity: 0.55 }));
    host.appendChild(elSVG('rect', { x: -350, y: 655, width: 2490, height: 240, fill: 'url(#oceanAtlGrad)' }));
    host.appendChild(elSVG('path', { d: 'M-350,655.5 H2140', stroke: '#dbeafe', 'stroke-width': 1.2, opacity: 0.5 }));
    buildWaveField(host, { y0: 655, y1: 840, x0: -350, x1: 2080, seed: 142, color: '#dbeafe' });
    buildGlitter(host, { x: 237, y0: 655, y1: 830, color: '#fef08a', varName: '--sun-op', op: 0.55, seed: 143 });
    buildGlitter(host, { x: 1260, y0: 655, y1: 830, color: '#fef3c7', varName: '--stars-op', op: 0.65, seed: 144 });
    for (const [x, sc] of [[820, 0.5], [1640, 0.42]]) {
      const g = elSVG('g', { transform: `translate(${x}, 652) scale(${sc})` });
      const b = elSVG('g', { class: 'ferry-bob' });
      b.innerHTML = '<path d="M-14,8 L14,8 L10,13 L-10,13 Z" fill="#334155"/><path d="M0,6 L0,-26 L12,6 Z" fill="#f8fafc"/><path d="M-2,6 L-2,-18 L-11,6 Z" fill="#e2e8f0"/>';
      g.appendChild(b); host.appendChild(g);
    }
  })();
  (function buildAtlanticBluff() {
    const host = byId('atlanticBluffProc');
    const r = mulberry(131);
    const top = [...jaggedLine([1405, 712], [1545, 703], r, 0.03, 4, 0),
                 ...jaggedLine([1545, 703], [1700, 708], r, 0.02, 3, 0).slice(1),
                 ...jaggedLine([1700, 708], [2320, 762], r, 0.03, 4, 0).slice(1)];
    const face = jaggedLine([1298, 862], [1405, 712], r, 0.08, 5, 0);
    host.appendChild(elSVG('path', { d: polyD([...face, ...top.slice(1), [2320, 900], [1298, 900]]), fill: '#454a55' }));
    // stacked New England granite boulders tumbling down the seaward face
    const rocks = [];
    for (let i = 0; i < 30; i++) {
      const p = face[Math.floor(r() * (face.length - 1))];
      rocks.push([p[0] + r() * 46 - 6, p[1] + r() * 28 - 6, 10 + r() * 15]);
    }
    for (let i = 0; i < 10; i++) rocks.push([1240 + r() * 150, 828 + r() * 30, 9 + r() * 14]);
    rocks.sort((a, b) => a[1] - b[1]);
    for (const [cx, cy, rad] of rocks) {
      host.appendChild(elSVG('path', { d: blobD(cx, cy, rad * 1.2, rad * 0.85, r), fill: '#5a606e' }));
      host.appendChild(elSVG('path', { d: blobD(cx - rad * 0.25, cy - rad * 0.28, rad * 0.78, rad * 0.5, r), fill: '#9198a7' }));
      host.appendChild(elSVG('path', { d: `M${f1(cx - rad * 0.2)},${f1(cy - rad * 0.1)} l${f1(rad * 0.4)},${f1(rad * 0.45)}`, stroke: '#3b3f48', 'stroke-width': 1, opacity: 0.5 }));
    }
    // dune-grass cap, wind-combed tufts & a little picket fence by the lighthouse
    const capLow = top.map(([x, y]) => [x, y + 8 + r() * 6]).reverse();
    host.appendChild(elSVG('path', { d: polyD([...top, ...capLow]), fill: '#6f7f38' }));
    let td = '';
    for (let x = 1410; x < 2300; x += 6 + r() * 6) {
      const y = yOnPoly(top, x) + 1, h = 7 + r() * 7;
      td += `M${f1(x)},${f1(y)} l${f1(-3 - r() * 2)},${f1(-h * 0.8)} M${f1(x)},${f1(y)} l${f1(1)},${f1(-h)} M${f1(x)},${f1(y)} l${f1(4 + r() * 2)},${f1(-h * 0.75)} `;
    }
    host.appendChild(elSVG('path', { d: td, stroke: '#c2b25a', 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round', opacity: 0.9 }));
    let fence = '';
    for (let x = 1592; x <= 1724; x += 9) { const y = yOnPoly(top, x); fence += `M${x},${f1(y)} V${f1(y - 13)} `; }
    const fy = x => yOnPoly(top, x);
    fence += `M1592,${f1(fy(1592) - 5)} L1724,${f1(fy(1724) - 5)} M1592,${f1(fy(1592) - 10)} L1724,${f1(fy(1724) - 10)}`;
    host.appendChild(elSVG('path', { d: fence, stroke: '#f5f5f4', 'stroke-width': 1.8, fill: 'none', opacity: 0.9 }));
    for (const [x, y, w] of [[1262, 848, 90], [1330, 856, 80], [1205, 842, 60]]) {
      host.appendChild(elSVG('path', { d: `M${x - w / 2},${y} Q${x},${y - 9} ${x + w / 2},${y}`, stroke: '#f0f9ff', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', class: 'surf-foam' }));
    }
  })();

  // ---- BOUNDING WHITE-TAILED DEER (Smokies midground) ---------------------
  const animatedDeer = [];
  function buildDeer(container) {
    const roam = elSVG('g');
    const g = elSVG('g');
    const mk = c => elSVG('path', { stroke: c, 'stroke-width': '2.6', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const legFf = mk('#5e3314'), legBf = mk('#5e3314'), legFn = mk('#8b5022'), legBn = mk('#8b5022');
    const tail = elSVG('path', { fill: '#fffbeb' });
    const body = elSVG('path', { d: 'M-15,-22 C-7,-28 9,-28 15,-23 C19,-19 17,-13 12,-12 L-11,-12 C-17,-13 -19,-19 -15,-22 Z', fill: '#a0612b' });
    const belly = elSVG('path', { d: 'M-9,-12.5 Q1,-10 10,-12.5', stroke: '#f5e6d3', 'stroke-width': '2', fill: 'none', 'stroke-linecap': 'round' });
    const head = elSVG('g');
    head.innerHTML = `
      <path d="M10,-23 C13,-29 15,-34 18,-37 L23,-34 C20,-31 18,-26 16,-20 Z" fill="#a0612b"/>
      <path d="M17,-39 C21,-41 28,-39 31,-35.5 C28,-33.5 22,-33.5 18.5,-34 Z" fill="#8b5022"/>
      <circle cx="30.6" cy="-35.6" r="1.3" fill="#1c1917"/>
      <ellipse cx="17.5" cy="-42.5" rx="1.9" ry="4.4" transform="rotate(-28 17.5 -42.5)" fill="#8b5022"/>
      <ellipse cx="20.5" cy="-43" rx="1.7" ry="4" transform="rotate(-8 20.5 -43)" fill="#6b3b17"/>
      <circle cx="23.5" cy="-37.4" r="1.1" fill="#1c1917"/>
      <path d="M19,-33.5 Q23,-32 27,-33" stroke="#f5e6d3" stroke-width="1.2" fill="none"/>`;
    g.append(legFf, legBf, tail, body, belly, head, legFn, legBn);
    roam.appendChild(g);
    container.appendChild(roam);
    animatedDeer.push({ roam, g, legFf, legBf, legFn, legBn, tail, head });
  }
  svg.querySelectorAll('[data-deer]').forEach(buildDeer);

  const animatedElk = [];
  function buildElk(container) {
    const roam = elSVG('g'), g = elSVG('g');
    const mk = c => elSVG('path', { stroke: c, 'stroke-width': '3.2', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const lFf = mk('#3f2410'), lBf = mk('#3f2410'), lFn = mk('#5e3314'), lBn = mk('#5e3314');
    const body = elSVG('path', { d: 'M-19,-25 C-12,-34 10,-34 17,-28 C22,-24 20,-17 14,-16 L-14,-16 C-21,-17 -23,-22 -19,-25 Z', fill: '#9a6a3a' });
    const shade = elSVG('path', { d: 'M-17,-18 Q0,-14 16,-18 L14,-16 L-14,-16 Z', fill: '#6b4423', opacity: '0.7' });
    const rump = elSVG('path', { d: 'M-20,-26 C-24,-23 -23,-18 -17,-17 C-15,-21 -16,-25 -20,-26 Z', fill: '#ead7b4' });
    const head = elSVG('g');
    head.innerHTML = `
      <path d="M9,-29 C13,-35 17,-41 21,-45 L28,-41 C24,-37 20,-31 18,-22 Z" fill="#4a2a12"/>
      <path d="M20,-47 C25,-49 33,-47 36,-43 C33,-41 27,-41 21,-41 Z" fill="#6b3b17"/>
      <circle cx="27" cy="-45.4" r="1.3" fill="#1c1917"/>
      <ellipse cx="19.5" cy="-48" rx="1.8" ry="3.8" transform="rotate(-30 19.5 -48)" fill="#6b3b17"/>
      <path d="M22,-48 C20,-59 24,-67 32,-71 M21.6,-54 L15,-59 M22.2,-60 L16,-67 M25,-65 L23,-73 M29,-69 L31,-77" stroke="#f5e6c8" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    g.append(lFf, lBf, body, shade, rump, head, lFn, lBn);
    roam.appendChild(g);
    container.appendChild(roam);
    animatedElk.push({ roam, g, lFf, lBf, lFn, lBn, head });
  }
  svg.querySelectorAll('[data-elk]').forEach(buildElk);
  function deerLegs(ext, hipX, hipY, front) {
    if (front) {
      const kx = hipX + 3 + ext * 6, ky = hipY + 7 - ext;
      const fx = hipX + ext * 13 - (1 - ext), fy = hipY + 14 - ext * 5;
      return `M${f1(hipX)},${f1(hipY)} L${f1(kx)},${f1(ky)} L${f1(fx)},${f1(fy)}`;
    }
    const kx = hipX - 4 - ext * 5, ky = hipY + 8 - ext;
    const fx = hipX - ext * 13 + (1 - ext) * 2, fy = hipY + 15 - ext * 4;
    return `M${f1(hipX)},${f1(hipY)} L${f1(kx)},${f1(ky)} L${f1(fx)},${f1(fy)}`;
  }

  // =========================================================================
  // COAST-TO-COAST REGIONS & STATE
  // =========================================================================
  const REGIONS = [
    { name: '🌊 Stop 1 of 7 · Pacific Coast, CA',      ribbon: '🌊 West Coast 2023',      caption: 'Golden Gate & Big Sur — California' },
    { name: '🌵 Stop 2 of 7 · Monument Valley, AZ',    ribbon: '🌵 Desert Southwest',     caption: 'Red Rock Mesas — Arizona' },
    { name: '🏔️ Stop 3 of 7 · Rocky Mountains, CO',    ribbon: '🏔️ Alpine Pass 2024',     caption: 'Continental Divide — Colorado' },
    { name: '🌾 Stop 4 of 7 · Heartland Plains, KS',   ribbon: '🌾 Great Plains 2024',    caption: 'Amber Waves of Grain — Kansas' },
    { name: '🍂 Stop 5 of 7 · Great Smoky Mtns, TN',   ribbon: '🍂 Smoky Ridges 2024',    caption: 'Blue Mist Hollow — Tennessee' },
    { name: '🗽 Stop 6 of 7 · New York Harbor, NY',    ribbon: '🗽 Autumn in New York',   caption: 'Manhattan & Lady Liberty — New York' },
    { name: '🦃 Stop 7 of 7 · Atlantic Feast, MA',     ribbon: '🥧 Thanksgiving Feast!',  caption: 'Lighthouse Bluff — New England Coast' },
  ];

  const REGION_SPAN = 5600;
  const TOTAL_LOOP  = REGIONS.length * REGION_SPAN;
  const P_FAR = 0.44;
  const P_MID = 0.65;

  const farEls = REGIONS.map((_, i) => byId('far-' + i));
  const midEls = REGIONS.map((_, i) => byId('mid-' + i));
  const carEls = [
    { el: byId('car-0'), bx: 1432, by: 798 },
    { el: byId('car-1'), bx: 1196, by: 848 },
    { el: byId('car-2'), bx: 738,  by: 868 },
    { el: byId('car-3'), bx: 450,  by: 846 },
    { el: byId('car-4'), bx: 185,  by: 840 },
  ];

  let activeIdx = ((initialRegion % REGIONS.length) + REGIONS.length) % REGIONS.length;
  let cameraX = activeIdx * REGION_SPAN - 420;
  let isPaused = !!initialPaused;
  let rafId = 0;
  let surgeDelayTimer: number | null = null;
  let destroyed = false;

  function updateHUD(idx: number) {
    activeIdx = idx;
    onRegionChange?.(idx);
  }

  const cloudPlaneFar   = byId('cloudPlaneFar');
  const cloudPlane      = byId('cloudPlane');
  const telegraphPlane  = byId('telegraphPlane');
  const embankmentPlane = byId('embankmentPlane');
  const foregroundPlane = byId('foregroundPlane');
  const trainGroup      = byId('trainGroup');
  const worldSteamLayer = byId('worldSteamLayer');
  const worldSparkLayer = byId('worldSparkLayer');
  const valveRod        = byId('valveRod');
  const pistonRod       = byId('pistonRod');
  const crosshead       = byId('crosshead');
  const mainRod         = byId('mainRod');
  const sideRod         = byId('sideRod');
  const scissorL        = byId('scissorL');
  const scissorR        = byId('scissorR');
  const scissorPin      = byId('scissorPin');
  const liftCradle      = byId('liftCradle');
  const liftBeam        = byId('liftBeam');
  const squirrelTail    = byId('squirrelTail');
  const squirrelTailHi  = byId('squirrelTailHi');
  const squirrelHead    = byId('squirrelHead');
  const gondolaSquirrel = byId('gondolaSquirrel');
  const gondolaBunting  = byId('gondolaBunting');
  const engineerHead    = byId('engineerHead');
  const engineerSnood   = byId('engineerSnood');
  const engineerWing    = byId('engineerWing');
  const bandanaTail     = byId('bandanaTail');

  const smallWheels = Array.from(svg.querySelectorAll('.wheel'));
  const driveWheels = Array.from(svg.querySelectorAll('.drive-wheel'));

  const CRUISE_SPEED = 165;
  let surgeStartCam = 0, surgeEndCam = 0, surgeT = 0, surging = false, pendingIdx = null, trainSurgeX = 0;

  // Multi-Lobe Volumetric World-Space Steam Cumulus Pool + Firebox Sparks!
  const steamPool = Array.from({ length: 24 }, (_, i) => {
    const g = elSVG('g');
    g.style.display = 'none';
    if (i % 4 === 0) {
      g.appendChild(elSVG('path', { d: 'M0,4 C-7,-6 -19,-2 -15,10 C-12,18 0,24 0,24 C0,24 12,18 15,10 C19,-2 7,-6 0,4 Z', fill: '#fde68a' }));
    } else {
      // 3-lobe billowing volumetric cloud puff
      g.appendChild(elSVG('circle', { cx: '-8', cy: '3', r: '11', fill: '#fed7aa', opacity: '0.78' }));
      g.appendChild(elSVG('circle', { cx: '8', cy: '2', r: '10', fill: '#fff7ed', opacity: '0.88' }));
      g.appendChild(elSVG('circle', { cx: '0', cy: '-4', r: '13', fill: '#ffffff', opacity: '0.94' }));
    }
    worldSteamLayer.appendChild(g);
    return { el: g, active: false, wx: 0, y: 0, age: 0, life: 1.9, rot: (i * 37) % 360 };
  });
  const sparkPool = Array.from({ length: 10 }, () => {
    const c = elSVG('circle', { r: '2.4', fill: '#fde047' });
    c.style.display = 'none';
    worldSparkLayer.appendChild(c);
    return { el: c, active: false, wx: 0, y: 0, vy: 0, age: 0, life: 1.1 };
  });
  let steamTimer = 0;
  // Chuff-sync + speed state (exhaust beats locked to driver rotation: 4 beats per revolution)
  let prevCamX = null, smoothSpeed = CRUISE_SPEED, lastBlurK = -1, lastChuff = null, chuffCooldown = 0, chuffCount = 0;
  const CHUFF_PX = (2 * Math.PI * 25) / 4;
  const cw16Spokes = byId('cw16Spokes');
  const cw16Blur   = byId('cw16Blur');
  const dwSpokes   = Array.from(svg.querySelectorAll('.dw-spokes'));
  const dwBlur     = Array.from(svg.querySelectorAll('.dw-blur'));
  // Cylinder-cock steam jets (drawn in front of the wheels)
  const worldCockLayer = elSVG('g');
  trainGroup.parentNode.insertBefore(worldCockLayer, trainGroup.nextSibling);
  const cockPool = Array.from({ length: 8 }, () => {
    const c = elSVG('ellipse', { rx: '9', ry: '6', fill: '#f8fafc' });
    c.style.display = 'none';
    worldCockLayer.appendChild(c);
    return { el: c, active: false, wx: 0, age: 0, life: 0.8 };
  });
  function spawnCock() {
    const c = cockPool.find(s => !s.active);
    if (!c) return;
    c.active = true; c.age = 0; c.life = 0.7 + Math.random() * 0.25;
    c.wx = cameraX + 1432 + 186 + trainSurgeX;
    c.el.style.display = '';
  }

  function spawnWorldSteam() {
    const slot = steamPool.find(s => !s.active);
    if (!slot) return;
    slot.active = true;
    slot.wx = cameraX + 1707 + trainSurgeX;
    slot.y = 794;
    slot.age = 0;
    slot.life = surging ? 1.45 : 2.2;
    slot.el.style.display = '';
    if (surging || Math.random() < 0.35) {
      const sp = sparkPool.find(p => !p.active);
      if (sp) {
        sp.active = true;
        sp.wx = slot.wx;
        sp.y = 796;
        sp.vy = 65 + Math.random() * 45;
        sp.age = 0;
        sp.life = 0.85 + Math.random() * 0.45;
        sp.el.style.display = '';
      }
    }
  }

  // World-space sculpted autumn leaves overtaken by train
  const worldLeafLayer = byId('worldLeafLayer');
  const leafColors = ['#ea580c', '#f59e0b', '#dc2626', '#facc15', '#d97706'];
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const p = elSVG('path', {
      d: 'M0,-12 C4,-8 10,-9 9,-3 C12,2 7,8 2,9 L0,14 L-2,9 C-7,8 -12,2 -9,-3 C-10,-9 -4,-8 0,-12 Z',
      fill: leafColors[i % leafColors.length]
    });
    worldLeafLayer.appendChild(p);
    return { el: p, wx: cameraX + i * 260, y: 110 + (i * 105) % 720, rot: i * 40 };
  });

  function setScissor(up) {
    const topY = up ? -16 : 48;
    scissorL.setAttribute('y2', topY);
    scissorR.setAttribute('y2', topY);
    scissorPin.setAttribute('cy', (60 + topY) / 2);
    liftCradle.setAttribute('y', topY - 6);
    liftBeam.style.opacity = up ? '1' : '0.08';
  }

  let lastOrderKey = '';
  const wrapSigned = (d, period) => ((d + period / 2) % period + period) % period - period / 2;
  const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function twoJointLeg(hx, hy, phase, strideX, liftY, shinLen) {
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const kx = hx + s * strideX * 0.55 + 3;
    const ky = hy + 7 - Math.max(0, c) * liftY * 0.5;
    const fx = hx + s * strideX - Math.max(0, -c) * 4;
    const fy = hy + shinLen - Math.max(0, c) * liftY;
    return `M${hx},${hy} L${kx.toFixed(1)},${ky.toFixed(1)} L${fx.toFixed(1)},${fy.toFixed(1)}`;
  }

  function updateFluidCreatures(tSec) {
    // 1. Multi-joint aerodynamic birds (shoulder + delayed wingtip wave!)
    for (const b of animatedBirds) {
      const spd = b.slow ? 3.2 : 6.8;
      const ph = tSec * spd - b.phase;
      const shoulder = Math.sin(ph);
      const tip      = Math.sin(ph - 0.95);
      const bobY     = -shoulder * 2.2;
      const driftX   = Math.sin(tSec * 0.6 + b.phase) * 28;
      b.g.setAttribute('transform', `translate(${(b.ox + driftX).toFixed(1)}, ${(b.oy + bobY).toFixed(1)})`);

      if (b.kind === 'goose') {
        const wy1 = -shoulder * 11.5;
        const wy2 = -tip * 18;
        b.foreWing.setAttribute('d', `M-3,0 Q2,${wy1.toFixed(1)} 10,${wy2.toFixed(1)} Q4,${(wy1 * 0.5 + 2).toFixed(1)} 2,1 Z`);
        const bwy1 = -Math.sin(ph + 0.15) * 9 - 2;
        const bwy2 = -Math.sin(ph - 0.8) * 14.5 - 2;
        b.backWing.setAttribute('d', `M-5,-1 Q0,${bwy1.toFixed(1)} 7,${bwy2.toFixed(1)} Q2,${(bwy1 * 0.4).toFixed(1)} 0,0 Z`);
      } else if (b.kind === 'gull2') {
        const wy1 = -shoulder * 10;
        const wy2 = -tip * 16;
        b.foreWing.setAttribute('d', `M-3,0 Q1,${wy1.toFixed(1)} 9,${wy2.toFixed(1)} Q3,${(wy1 * 0.55 + 1.5).toFixed(1)} 2,1 Z`);
        const bwy1 = -Math.sin(ph + 0.2) * 8 - 1.5;
        const bwy2 = -Math.sin(ph - 0.75) * 13 - 1.5;
        b.backWing.setAttribute('d', `M-4,-1 Q-1,${bwy1.toFixed(1)} 6,${bwy2.toFixed(1)} Q1,${(bwy1 * 0.45).toFixed(1)} 0,0 Z`);
      } else if (b.kind === 'hawk') {
        const bank = Math.sin(tSec * 0.9) * 8;
        const soarX = Math.sin(tSec * 0.55) * 65;
        const soarY = Math.cos(tSec * 0.55) * 14;
        b.g.setAttribute('transform', `translate(${soarX.toFixed(1)}, ${soarY.toFixed(1)}) rotate(${bank.toFixed(1)})`);
        const wy1 = -shoulder * 6 - 4;
        const wy2 = -tip * 10 - 6;
        b.foreWing.setAttribute('d', `M-4,0 Q3,${wy1.toFixed(1)} 16,${wy2.toFixed(1)} Q6,${(wy1 * 0.5 + 2).toFixed(1)} 4,1 Z`);
        b.backWing.setAttribute('d', `M-6,-1 Q0,${(wy1 * 0.8 - 2).toFixed(1)} 12,${(wy2 * 0.85 - 2).toFixed(1)} Q3,-1 0,0 Z`);
      }
    }

    // 2. Articulated 4-Legged Fox + Pilgrim + Runaway Turkey Chase!
    const cycle = (tSec % 10) / 10;
    const dir = cycle < 0.5 ? 1 : -1;
    const roamX = dir === 1 ? cycle * 2 * 340 : (1 - (cycle - 0.5) * 2) * 340;
    const runW = tSec * 15.5;

    for (const ch of animatedChases) {
      ch.roam.setAttribute('transform', `translate(${roamX.toFixed(1)}, 0) scale(${dir}, 1)`);
      ch.speech.setAttribute('transform', `translate(-28, -74) scale(${dir}, 1)`); // counter-flip so text never mirrors

      const gPh = tSec * 13.5;
      const flex = Math.sin(gPh);
      const foxY = -Math.abs(Math.cos(gPh)) * 5.5;
      ch.fox.setAttribute('transform', `translate(-152, ${(-4 + foxY).toFixed(1)}) rotate(${(flex * 6).toFixed(1)})`);
      ch.foxTorso.setAttribute('d', `M-12,-6 Q0,${(-10 - flex * 3.5).toFixed(1)} 12,-7 Q14,0 9,1 Q0,${(-1 - flex * 2).toFixed(1)} -11,1 Z`);
      const tw1 = Math.sin(gPh - 0.8) * 6;
      const tw2 = Math.sin(gPh - 1.7) * 9;
      ch.foxTail.setAttribute('d', `M-11,-4 C-22,${(-4 + tw1).toFixed(1)} -30,${(-14 + tw2).toFixed(1)} -25,${(-18 + tw2).toFixed(1)} C-18,${(-18 + tw1).toFixed(1)} -13,-10 -10,-6 Z`);
      ch.foxTailTip.setAttribute('cx', '-25');
      ch.foxTailTip.setAttribute('cy', (-17 + tw2).toFixed(1));
      ch.foxLegF1.setAttribute('d', twoJointLeg(9, -2, gPh, 8.5, 5.5, 9));
      ch.foxLegF2.setAttribute('d', twoJointLeg(7, -2, gPh + 0.55, 8.5, 5.5, 9));
      ch.foxLegB1.setAttribute('d', twoJointLeg(-9, -2, gPh + Math.PI, 8.5, 5.5, 9));
      ch.foxLegB2.setAttribute('d', twoJointLeg(-11, -2, gPh + Math.PI + 0.55, 8.5, 5.5, 9));

      const pBob = -Math.abs(Math.sin(runW)) * 5.5;
      const capeWave = Math.sin(runW - 0.8) * 5;
      ch.pilCape.setAttribute('d', `M-10,${(-26 + pBob).toFixed(1)} Q-20,${(-16 + pBob + capeWave).toFixed(1)} -26,${(-6 + pBob - capeWave * 0.5).toFixed(1)} L-10,${(-8 + pBob).toFixed(1)} Z`);
      ch.pilBody.setAttribute('transform', `translate(0, ${pBob.toFixed(1)}) rotate(${(4 + Math.sin(runW * 2) * 2).toFixed(1)})`);
      ch.pilArm.setAttribute('transform', `translate(0, ${pBob.toFixed(1)}) rotate(${(Math.sin(runW) * 14).toFixed(1)} 6 -29)`);
      ch.pilLegFront.setAttribute('d', twoJointLeg(0, -9 + pBob, runW, 12, 8, 17));
      ch.pilLegBack.setAttribute('d',  twoJointLeg(0, -9 + pBob, runW + Math.PI, 12, 8, 17));

      const tW = tSec * 18.5;
      const tBob = -Math.abs(Math.sin(tW)) * 6;
      ch.turkBody.setAttribute('transform', `translate(0, ${tBob.toFixed(1)})`);
      ch.turkTail.setAttribute('transform', `translate(-14, -18) rotate(${(-16 + Math.sin(tW - 0.9) * 11).toFixed(1)})`);
      ch.turkNeckHead.setAttribute('transform', `rotate(${(Math.sin(tW - 0.5) * 8).toFixed(1)} 10 -17)`);
      ch.turkWing.setAttribute('transform', `rotate(${(Math.sin(tSec * 32) * 28).toFixed(1)} -6 -16)`);
      ch.turkLegF.setAttribute('d', twoJointLeg(1, -6 + tBob, tW, 11, 8, 15));
      ch.turkLegB.setAttribute('d', twoJointLeg(-2, -6 + tBob, tW + Math.PI, 11, 8, 15));
    }

    // 2b. Bounding white-tailed deer (pronk arc, pitch with trajectory, flagging tail)
    const dCycle = (tSec % 11) / 11;
    const dDir = dCycle < 0.5 ? 1 : -1;
    const dX = dDir === 1 ? dCycle * 2 * 245 : (1 - (dCycle - 0.5) * 2) * 245;
    const bp = tSec * 6.2;
    const air = Math.abs(Math.sin(bp));
    const pitch = -Math.cos(bp) * Math.sign(Math.sin(bp) || 1) * 9;
    const air2 = Math.abs(Math.sin(bp - 0.25));
    for (const d of animatedDeer) {
      d.roam.setAttribute('transform', `translate(${dX.toFixed(1)}, 0) scale(${dDir}, 1)`);
      d.g.setAttribute('transform', `translate(0, ${(-air * 18).toFixed(1)}) rotate(${pitch.toFixed(1)} 0 -18)`);
      d.legFn.setAttribute('d', deerLegs(air, 11, -14, true));
      d.legFf.setAttribute('d', deerLegs(air2, 13, -14, true));
      d.legBn.setAttribute('d', deerLegs(air, -11, -15, false));
      d.legBf.setAttribute('d', deerLegs(air2, -9, -15, false));
      d.tail.setAttribute('d', `M-15,-21 Q-22,${(-26 - air * 5).toFixed(1)} -20,${(-31 - air * 6).toFixed(1)} Q-15,-27 -13,-20 Z`);
      d.head.setAttribute('transform', `rotate(${(Math.sin(bp * 2) * 3).toFixed(1)} 14 -22)`);
    }

    // 2c. Bull elk: walk (diagonal-pair gait) -> graze -> turn -> walk back -> graze
    const eT = tSec % 16;
    let ex, eDir, walking, graze = 0;
    if (eT < 5)       { ex = eT / 5 * 130; eDir = 1; walking = true; }
    else if (eT < 8)  { ex = 130; eDir = 1; walking = false; graze = Math.sin((eT - 5) / 3 * Math.PI); }
    else if (eT < 13) { ex = 130 - (eT - 8) / 5 * 130; eDir = -1; walking = true; }
    else              { ex = 0; eDir = -1; walking = false; graze = Math.sin((eT - 13) / 3 * Math.PI); }
    const wp = walking ? tSec * 6.5 : Math.PI / 2;
    const eStride = walking ? 6.5 : 0, eLift = walking ? 4.5 : 0;
    for (const e of animatedElk) {
      e.roam.setAttribute('transform', `translate(${ex.toFixed(1)}, 0) scale(${eDir}, 1)`);
      e.g.setAttribute('transform', `translate(0, ${(walking ? -Math.abs(Math.sin(wp)) * 1.3 : 0).toFixed(1)})`);
      e.lFn.setAttribute('d', twoJointLeg(13, -17, wp, eStride, eLift, 17));
      e.lBf.setAttribute('d', twoJointLeg(-11, -17, wp + 0.3, eStride, eLift, 17));
      e.lFf.setAttribute('d', twoJointLeg(15, -17, wp + Math.PI, eStride, eLift, 17));
      e.lBn.setAttribute('d', twoJointLeg(-13, -17, wp + Math.PI + 0.3, eStride, eLift, 17));
      const nod = walking ? Math.sin(wp * 2) * 2.5 : Math.sin(tSec * 5) * graze * 3;
      e.head.setAttribute('transform', `rotate(${(graze * 40 + nod).toFixed(1)} 14 -27)`);
    }

    // 3. Gondola Squirrel (plush S-tail wave + highlight + head nibble bob!)
    const sqPop = Math.max(0, Math.sin(tSec * 1.3)) * 11;
    gondolaSquirrel.setAttribute('transform', `translate(132, ${(26 - sqPop).toFixed(1)})`);
    const st = Math.sin(tSec * 4.2) * 5;
    squirrelTail.setAttribute('d', `M-8,6 C-28,${(0 + st).toFixed(1)} -33,${(-24 - st).toFixed(1)} -14,${(-28 + st * 0.6).toFixed(1)} C-2,-30 -1,-12 -6,2 Z`);
    squirrelTailHi.setAttribute('d', `M-11,2 C-24,${(-3 + st * 0.7).toFixed(1)} -26,${(-20 - st * 0.7).toFixed(1)} -13,${(-24 + st * 0.4).toFixed(1)}`);
    squirrelHead.setAttribute('transform', `rotate(${(Math.sin(tSec * 5.5) * 6).toFixed(1)} 8 -6)`);
    gondolaBunting.setAttribute('transform', `translate(0, ${(Math.sin(tSec * (surging ? 16 : 6)) * 1.1).toFixed(1)})`);

    // 4. Locomotive Turkey Engineer (head bob, snood lag, fluttering bandana, natural wing wave!)
    engineerHead.setAttribute('transform', `translate(0, ${(Math.sin(tSec * 3.8) * 1.4).toFixed(1)}) rotate(${(Math.sin(tSec * 2.1) * 4).toFixed(1)} 6 -10)`);
    engineerSnood.setAttribute('transform', `rotate(${(Math.sin(tSec * 6.5 - 0.6) * 12).toFixed(1)} 14 -10)`);
    engineerWing.setAttribute('transform', `rotate(${(Math.sin(tSec * (surging ? 9 : 4.5)) * 22).toFixed(1)} -4 2)`);
    const bf = Math.sin(tSec * (surging ? 22 : 11)) * 3.8;
    bandanaTail.setAttribute('d', `M-6,-3 Q-14,${(-7 + bf).toFixed(1)} -22,${(-4 - bf).toFixed(1)} L-17,${(3 + bf * 0.6).toFixed(1)} Z`);
  }

  function renderWorldAtCamera(camX, dt, tSec) {
    // Speed estimate -> wheel motion blur (spokes dissolve into a blurred disc at speed)
    let dCam = prevCamX === null ? 0 : camX - prevCamX;
    if (Math.abs(dCam) > 4000) dCam = 0;
    prevCamX = camX;
    if (dt > 0) smoothSpeed += (Math.abs(dCam) / dt - smoothSpeed) * Math.min(1, dt * 8);
    const blurK = Math.max(0, Math.min(1, (smoothSpeed - 450) / 1400));
    if (Math.abs(blurK - lastBlurK) > 0.02) {
      lastBlurK = blurK;
      cw16Spokes.setAttribute('opacity', (1 - blurK * 0.85).toFixed(2));
      cw16Blur.setAttribute('opacity', (blurK * 0.7).toFixed(2));
      dwSpokes.forEach(s => s.setAttribute('opacity', (1 - blurK * 0.85).toFixed(2)));
      dwBlur.forEach(s => s.setAttribute('opacity', (blurK * 0.65).toFixed(2)));
    }
    cloudPlaneFar.setAttribute('transform', `translate(${-((camX * 0.08) % 1920 + 1920) % 1920}, 0)`);
    cloudPlane.setAttribute('transform', `translate(${-((camX * 0.14) % 1920 + 1920) % 1920}, 0)`);

    const farWorld = byId('farWorld');
    const midWorld = byId('midWorld');
    const visibleRegs = [];
    for (let i = 0; i < REGIONS.length; i++) {
      const delta = wrapSigned(camX - i * REGION_SPAN, TOTAL_LOOP);
      if (Math.abs(delta) < REGION_SPAN * 1.05) {
        visibleRegs.push({ i, delta });
        farEls[i].style.display = '';
        midEls[i].style.display = '';
        farEls[i].setAttribute('transform', `translate(${(-delta * P_FAR).toFixed(1)}, 0)`);
        midEls[i].setAttribute('transform', `translate(${(-delta * P_MID).toFixed(1)}, 0)`);
      } else {
        farEls[i].style.display = 'none';
        midEls[i].style.display = 'none';
      }
    }
    visibleRegs.sort((a, b) => b.delta - a.delta);
    // Re-inserting a node restarts every CSS animation inside it (mist, fireflies, waving bear...),
    // which caused flicker/frozen animations. Only re-order when the visible set actually changes.
    const orderKey = visibleRegs.map(v => v.i).join(',');
    if (orderKey !== lastOrderKey) {
      lastOrderKey = orderKey;
      for (const v of visibleRegs) {
        farWorld.appendChild(farEls[v.i]);
        midWorld.appendChild(midEls[v.i]);
      }
    }

    telegraphPlane.setAttribute('transform', `translate(${(-((camX * 0.56) % 380 + 380) % 380).toFixed(1)}, 0)`);
    embankmentPlane.setAttribute('transform', `translate(${(-((camX) % 640 + 640) % 640).toFixed(1)}, 0)`);
    tiesLayer.setAttribute('transform', `translate(${(-((camX) % 70 + 70) % 70).toFixed(1)}, 0)`);
    foregroundPlane.setAttribute('transform', `translate(${(-((camX * 1.65) % 960 + 960) % 960).toFixed(1)}, 0)`);

    // Exact Walschaerts / Piston Crank Kinematics!
    const driveRad = (camX / 25);
    const driveDeg = (driveRad * 180 / Math.PI) % 360;
    const smallDeg = ((camX / 16) * 180 / Math.PI) % 360;

    for (const dw of driveWheels) dw.setAttribute('transform', `rotate(${driveDeg.toFixed(1)})`);
    for (const sw of smallWheels) sw.setAttribute('transform', `rotate(${smallDeg.toFixed(1)})`);

    const rCrank = 10.5;
    const cx = Math.cos(driveRad) * rCrank;
    const cy = Math.sin(driveRad) * rCrank;
    sideRod.setAttribute('transform', `translate(${cx.toFixed(1)}, ${cy.toFixed(1)})`);

    const pinX = 126 + cx;
    const pinY = 154 + cy;
    const crossX = 166 + cx * 0.95;
    mainRod.setAttribute('x1', pinX.toFixed(1));
    mainRod.setAttribute('y1', pinY.toFixed(1));
    mainRod.setAttribute('x2', crossX.toFixed(1));
    mainRod.setAttribute('y2', '150');
    crosshead.setAttribute('x', (crossX - 6).toFixed(1));
    pistonRod.setAttribute('x1', crossX.toFixed(1));
    // Quarter-phase valve stem motion above steam cylinder
    const vx = 156 + Math.cos(driveRad + Math.PI / 2) * 5.5;
    valveRod.setAttribute('x1', vx.toFixed(1));

    // Coupled-car rail-joint wave + locomotive throttle surge
    const targetSurge = surging ? 40 * Math.sin(Math.PI * surgeT) : 0;
    trainSurgeX += (targetSurge - trainSurgeX) * Math.min(1, dt * 6);
    trainGroup.setAttribute('transform', `translate(${trainSurgeX.toFixed(1)}, 0)`);
    for (let c = 0; c < carEls.length; c++) {
      const bob = Math.sin(camX * 0.045 - c * 1.05) * (surging ? 2.5 : 1.4);
      carEls[c].el.setAttribute('transform', `translate(${carEls[c].bx}, ${(carEls[c].by + bob).toFixed(1)})`);
    }

    // World-space multi-lobe steam trail + firebox embers
    // Exhaust beats locked to the drivers: one chuff every quarter revolution
    const chuff = Math.floor(camX / CHUFF_PX);
    chuffCooldown -= dt;
    if (chuff !== lastChuff) {
      lastChuff = chuff;
      if (chuffCooldown <= 0) {
        spawnWorldSteam();
        chuffCooldown = 0.055;
        chuffCount++;
        if ((chuffCount & 1) === 0 && smoothSpeed < 900) spawnCock();
      }
    }
    for (const s of steamPool) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.life) {
        s.active = false;
        s.el.style.display = 'none';
        continue;
      }
      const p = s.age / s.life;
      const ease = 1 - Math.pow(1 - p, 2.4);       // fast blast, then billowing deceleration
      const sx = s.wx - camX - p * 26;            // gentle crosswind drift
      const sy = s.y - ease * 128;
      const sc = 0.38 + ease * 1.45;
      s.el.setAttribute('transform', `translate(${sx.toFixed(1)}, ${sy.toFixed(1)}) scale(${sc.toFixed(2)}) rotate(${(s.rot + p * 28).toFixed(1)})`);
      s.el.setAttribute('opacity', ((1 - p) * 0.86).toFixed(2));
    }
    for (const sp of sparkPool) {
      if (!sp.active) continue;
      sp.age += dt;
      if (sp.age >= sp.life) {
        sp.active = false;
        sp.el.style.display = 'none';
        continue;
      }
      const p = sp.age / sp.life;
      const sx = sp.wx - camX - p * 35;
      const sy = sp.y - sp.vy * sp.age + 40 * sp.age * sp.age;
      sp.el.setAttribute('cx', sx.toFixed(1));
      sp.el.setAttribute('cy', sy.toFixed(1));
      sp.el.setAttribute('opacity', (1 - p).toFixed(2));
    }

    for (const c of cockPool) {
      if (!c.active) continue;
      c.age += dt;
      if (c.age >= c.life) { c.active = false; c.el.style.display = 'none'; continue; }
      const p = c.age / c.life;
      c.el.setAttribute('transform', `translate(${(c.wx - camX + p * 55).toFixed(1)}, ${(950 - p * 16).toFixed(1)}) scale(${(0.4 + p * 1.7).toFixed(2)})`);
      c.el.setAttribute('opacity', ((1 - p) * 0.55).toFixed(2));
    }

    // World-space sculpted autumn leaves
    for (const lf of leaves) {
      lf.y += 46 * dt;
      lf.rot = (lf.rot + 90 * dt) % 360;
      let sx = lf.wx - camX * 0.85;
      if (sx < -60) { lf.wx += 2050; sx = lf.wx - camX * 0.85; }
      if (lf.y > 960) lf.y = -30;
      lf.el.setAttribute('transform', `translate(${sx.toFixed(1)}, ${lf.y.toFixed(1)}) rotate(${lf.rot.toFixed(1)})`);
    }

    updateFluidCreatures(tSec);
  }

  updateHUD(activeIdx);
  setScissor(true);
  for (let k = 0; k < 5; k++) {
    spawnWorldSteam();
    steamPool[k].wx -= k * 54;
    steamPool[k].age = k * 0.34;
  }
  renderWorldAtCamera(cameraX, 0.016, 1.2);

  let lastT = performance.now();
  let simTime = 1.2;

  function tick(now: number) {
    if (destroyed || isPaused) {
      rafId = 0;
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    simTime += dt;

    if (surging) {
      surgeT = Math.min(1, surgeT + dt / 2.65);
      cameraX = surgeStartCam + (surgeEndCam - surgeStartCam) * easeInOutCubic(surgeT);
      if (surgeT >= 1) {
        surging = false;
        cameraX = ((cameraX % TOTAL_LOOP) + TOTAL_LOOP) % TOTAL_LOOP;
        updateHUD(pendingIdx);
        setScissor(true);
      }
    } else {
      cameraX = (cameraX + CRUISE_SPEED * dt) % TOTAL_LOOP;
    }

    renderWorldAtCamera(cameraX, dt, simTime);
    rafId = requestAnimationFrame(tick);
  }

  if (!isPaused && !isStatic) {
    rafId = requestAnimationFrame(tick);
  }

  function surgeToRegion(targetIdx: number) {
    if (destroyed) return;
    const next = ((targetIdx % REGIONS.length) + REGIONS.length) % REGIONS.length;
    if (surgeDelayTimer !== null) {
      window.clearTimeout(surgeDelayTimer);
      surgeDelayTimer = null;
    }
    pendingIdx = next;
    setScissor(false);
    surgeDelayTimer = window.setTimeout(() => {
      surgeDelayTimer = null;
      if (destroyed) return;
      surgeStartCam = cameraX;
      let dest = pendingIdx * REGION_SPAN - 450;
      while (dest <= surgeStartCam + 600) dest += TOTAL_LOOP;
      surgeEndCam = dest;
      surgeT = 0;
      surging = true;
    }, 320);
  }

  function setPaused(paused: boolean) {
    if (destroyed || isPaused === paused) return;
    isPaused = paused;
    if (!isPaused && !isStatic && !rafId) {
      lastT = performance.now();
      rafId = requestAnimationFrame(tick);
    } else if (isPaused && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function destroy() {
    destroyed = true;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (surgeDelayTimer !== null) {
      window.clearTimeout(surgeDelayTimer);
      surgeDelayTimer = null;
    }
  }

  return {
    surgeToRegion,
    setPaused,
    destroy,
  };
}
