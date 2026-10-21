// A protein cartoon for three.js scenes: helices as flat elliptical ribbons, strands as flat slabs ending in an
// arrow, everything else as a thin tube. Built the way Mol*'s cartoon is (mol-repr polymer-trace-mesh and
// curve-segment, 5.9): the same spline through the Cα atoms (tension 0.9 in helices, 0.5 elsewhere; strand Cα
// smoothed first), the same ribbon facing (each residue's C→O, averaged with its neighbours'), the same normal
// interpolation along a residue and the same sizes (0.2 Å, ribbons 5x as wide, arrows 1.5x that).
// A reimplementation, not Mol*'s code. Mol* (MIT): D. Sehnal et al., Nucleic Acids Res. 49, W431 (2021).
//
//   const toon = Deck.cartoon(data.ubiquitin, { color: palette.neutral })   // from tools/prep_protein.py
//   view.add(toon.mesh);        // a Deck.turntable, or any three.js group
//   Deck.cartoon(data.ubiquitin, { ss: palette.ss })   // or coloured by secondary structure
//   toon.update(caPositions);   // optional: new Cα positions ([[x, y, z], ...]); the mesh layout never changes
//   toon.dispose();
//
// The facing comes in as coordinates in a frame built from the Cα trace (frameAt, as in prep_protein.py), so a
// slide can move the Cα atoms and the ribbons turn with them. Not drawn yet: chain breaks (data.breaks).
(function () {
  'use strict';

  const SIZE = 0.2, ASPECT = 5, ARROW = 1.5;      // Mol*'s cartoon defaults, Å
  const HELIX_TENSION = 0.9, TENSION = 0.5;       // its spline tensions
  const EXTEND = 1.5;                              // virtual Cα spacing past the chain ends, Å

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => { const l = Math.sqrt(dot(a, a)); return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 0]; };
  const match = (a, b) => (dot(a, b) > 0 ? a : scale(a, -1));
  const orthogonalize = (t, d) => unit(cross(cross(t, d), t));   // d made perpendicular to t
  const lerp = (a, b, t) => a + (b - a) * t;
  function slerp(a, b, t) {
    const d = Math.max(-1, Math.min(1, dot(a, b)));
    const theta = Math.acos(d) * t;
    const rel = unit(sub(b, scale(a, d)));
    return add(scale(a, Math.cos(theta)), scale(rel, Math.sin(theta)));
  }
  const smoothstep = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  // Mol*'s cardinal spline (mol-math/interpolate spline), per coordinate
  function spline(p0, p1, p2, p3, t, tension) {
    const t2 = t * t, t3 = t2 * t, out = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const v0 = (p2[c] - p0[c]) * tension, v1 = (p3[c] - p1[c]) * tension;
      out[c] = (2 * p1[c] - 2 * p2[c] + v0 + v1) * t3 + (-3 * p1[c] + 3 * p2[c] - 2 * v0 - v1) * t2 + v0 * t + p1[c];
    }
    return out;
  }

  // (tangent, bend, normal) at residue i from its neighbours' Cα; the ends borrow the next one in.
  // Must match ca_frame() in tools/prep_protein.py.
  function frameAt(ca, i) {
    i = Math.min(Math.max(i, 1), ca.length - 2);
    const t = unit(sub(ca[i + 1], ca[i - 1]));
    let b = sub(add(ca[i], ca[i]), add(ca[i - 1], ca[i + 1]));
    b = unit(sub(b, scale(t, dot(t, b))));
    return [t, b, cross(t, b)];
  }

  function cartoon(data, options = {}) {
    const THREE = window.ManimWeb.THREE;
    const S = options.segments || 8, R = options.radial || 16;
    const n = data.ss.length, ss = data.ss;
    const kind = (k) => ss[Math.min(Math.max(k, 0), n - 1)];

    // Every vertex and triangle, in one fixed order; `index` is filled on the first build only.
    function build(ca, index) {
      const pos = [], nrm = [], res = [];
      let residue = 0;
      const vert = (p, q) => { pos.push(p[0], p[1], p[2]); nrm.push(q[0], q[1], q[2]); res.push(residue); return pos.length / 3 - 1; };
      const tri = (a, b, c) => { if (index) index.push(a, b, c); };

      // the Cα trace with virtual points past each end, so every residue has two neighbours each side
      const at = (k) => {
        if (k >= 0 && k < n) return ca[k];
        const [end, inner, steps] = k < 0 ? [ca[0], ca[1], -k] : [ca[n - 1], ca[n - 2], k - n + 1];
        return add(end, scale(unit(sub(end, inner)), EXTEND * steps));
      };
      const control = (k) => (kind(k) === 'E' ? scale(add(add(at(k - 1), at(k + 1)), scale(at(k), 2)), 0.25) : at(k));
      // carbonyl directions back in model space, then averaged with the neighbours' (sign-matched)
      const dir = data.dir.map((c, i) => {
        const [t, b, m] = frameAt(ca, i);
        return unit(add(add(scale(t, c[0]), scale(b, c[1])), scale(m, c[2])));
      });
      const d = (k) => dir[Math.min(Math.max(k, 0), n - 1)];
      const D = (k) => scale(add(add(match(d(k - 1), d(k)), match(d(k + 1), d(k))), scale(d(k), 2)), 0.25);

      for (let i = 0; i < n; i++) {
        residue = i;
        const type = ss[i];
        const first = i === 0 || ss[i - 1] !== type, last = i === n - 1 || ss[i + 1] !== type;
        const tension = type === 'H' ? HELIX_TENSION : TENSION;
        const tBeg = first ? 0.5 : tension, tEnd = last ? 0.5 : tension;
        const p = [-2, -1, 0, 1, 2].map((o) => control(i + o));

        // stations along the residue: from halfway back to the previous Cα, through this one, halfway on
        const pts = [], tan = [];
        for (let j = 0; j <= S; j++) {
          const t = j / S;
          if (t < 0.5) {
            pts.push(spline(p[0], p[1], p[2], p[3], t + 0.5, lerp(tBeg, tension, t)));
            tan.push(unit(sub(spline(p[0], p[1], p[2], p[3], t + 0.51, tBeg), spline(p[0], p[1], p[2], p[3], t + 0.49, tBeg))));
          } else {
            const te = lerp(tension, tEnd, t);
            pts.push(spline(p[1], p[2], p[3], p[4], t - 0.5, te));
            tan.push(unit(sub(spline(p[1], p[2], p[3], p[4], t - 0.49, te), spline(p[1], p[2], p[3], p[4], t - 0.51, te))));
          }
        }
        // normals: from this residue's direction to the next one's, turned gradually, then smoothed
        const firstN = orthogonalize(tan[0], D(i)), lastN = match(orthogonalize(tan[S], D(i + 1)), firstN);
        const nor = [];
        let prev = firstN;
        for (let j = 0; j <= S; j++) {
          const jj = smoothstep(j / S) * S;
          const t = j === 0 ? 0 : 1 / (S + 1 - jj);
          prev = orthogonalize(tan[j], slerp(prev, lastN, t));
          nor.push(prev);
        }
        for (let j = 1; j < S; j++) nor[j] = scale(add(add(nor[j - 1], nor[j + 1]), nor[j]), 1 / 3);
        const bin = nor.map((m, j) => unit(cross(tan[j], m)));

        // the chain's first and last residues draw only their inner half
        const j0 = i === 0 ? S / 2 : 0, j1 = i === n - 1 ? S / 2 : S;
        const half = SIZE, wide = SIZE * ASPECT;
        const point = (j, a, b) => add(add(pts[j], scale(nor[j], a)), scale(bin[j], b));

        if (type === 'E') {
          // a flat slab: wide along the normal, thin along the binormal; the last residue is the arrow
          const height = (j) => (last ? wide * ARROW * (1 - (j - j0) / (j1 - j0)) : wide);
          const faces = [  // two corners per face, ordered so the triangles face out
            [[1, 1], [-1, 1], (j) => bin[j]], [[-1, -1], [1, -1], (j) => scale(bin[j], -1)],
            [[1, -1], [1, 1], (j) => nor[j]], [[-1, 1], [-1, -1], (j) => scale(nor[j], -1)],
          ];
          for (const [a, b, out] of faces) {
            const base = pos.length / 3;
            for (let j = j0; j <= j1; j++) {
              const h = height(j);
              vert(point(j, a[0] * h, a[1] * half), out(j));
              vert(point(j, b[0] * h, b[1] * half), out(j));
            }
            for (let k = 0; k < j1 - j0; k++) {
              const v = base + 2 * k;
              tri(v, v + 1, v + 2); tri(v + 1, v + 3, v + 2);
            }
          }
          const cap = (j, sign) => {  // a rectangle across the slab, facing back (-1) or forward (+1)
            const h = height(j), out = scale(tan[j], sign);
            const v = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([a, b]) => vert(point(j, a * h, b * half), out));
            if (sign > 0) { tri(v[0], v[1], v[2]); tri(v[0], v[2], v[3]); } else { tri(v[0], v[2], v[1]); tri(v[0], v[3], v[2]); }
          };
          if (first || last) cap(j0, -1);   // the strand's start, and the back of the arrowhead
          if (i === n - 1 && !last) cap(j1, 1);
        } else {
          // a tube: an ellipse for helices (wide along the normal), a circle elsewhere
          const h = type === 'H' ? wide : half, w = half;
          const base = pos.length / 3;
          for (let j = j0; j <= j1; j++) {
            for (let k = 0; k < R; k++) {
              const th = 2 * Math.PI * k / R, c = Math.cos(th), s = Math.sin(th);
              vert(point(j, h * c, w * s), unit(add(scale(nor[j], w * c), scale(bin[j], h * s))));
            }
          }
          for (let j = 0; j < j1 - j0; j++) {
            for (let k = 0; k < R; k++) {
              const a = base + j * R + k, b = base + j * R + (k + 1) % R;
              tri(a, b, a + R); tri(b, b + R, a + R);
            }
          }
          const cap = (j, sign) => {
            const out = scale(tan[j], sign), centre = vert(pts[j], out);
            const ring = [];
            for (let k = 0; k < R; k++) {
              const th = 2 * Math.PI * k / R;
              ring.push(vert(point(j, h * Math.cos(th), w * Math.sin(th)), out));
            }
            for (let k = 0; k < R; k++) {
              if (sign > 0) tri(centre, ring[k], ring[(k + 1) % R]); else tri(centre, ring[(k + 1) % R], ring[k]);
            }
          };
          if (first) cap(j0, -1);
          if (last) cap(j1, 1);
        }
      }
      return { pos, nrm, res };
    }

    const index = [];
    const first = build(data.ca, index);
    const geometry = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(new Float32Array(first.pos), 3);
    const normal = new THREE.BufferAttribute(new Float32Array(first.nrm), 3);
    geometry.setAttribute('position', position);
    geometry.setAttribute('normal', normal);
    geometry.setIndex(index);
    geometry.computeBoundingSphere();
    // one colour, or options.ss = {H, E, C} to colour helices, strands and loops apart (palette.ss)
    let colors = null;
    if (options.ss) {
      // each vertex takes the colour of the residue it was built for
      colors = new Float32Array(first.pos.length);
      const c = Object.fromEntries(Object.entries(options.ss).map(([k, v]) => [k, new THREE.Color(v)]));
      first.res.forEach((r, v) => { const col = c[data.ss[r]] || c.C; colors.set([col.r, col.g, col.b], 3 * v); });
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    const material = options.material || new THREE.MeshStandardMaterial({
      color: new THREE.Color(options.ss ? '#ffffff' : options.color || '#9aa0a6'), vertexColors: !!options.ss });
    const mesh = new THREE.Mesh(geometry, material);
    return {
      mesh,
      update(ca) {
        const { pos, nrm } = build(ca, null);
        position.array.set(pos);
        normal.array.set(nrm);
        position.needsUpdate = true;
        normal.needsUpdate = true;
        geometry.computeBoundingSphere();
      },
      dispose() { geometry.dispose(); if (!options.material) material.dispose(); },
    };
  }

  window.Deck.cartoon = cartoon;
})();
