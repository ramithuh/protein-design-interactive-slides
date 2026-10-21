// Checking a generated design against its request: the same design and transitions on two slides. An enzyme
// design task (an iron, taurine and α-ketoglutarate, from PDB 1OS7) asks for given atoms of four residues;
// a protein generated for it (data/enzyme_design.js) is checked by zooming into it. Requested positions are
// open cages, never atoms, so nothing on screen suggests a bond to a position that is only a request.
//
// Slide 1, the task: 1 the request on its own · 2 the camera pulls back as the design is built around it ·
// 3 into the four requested residues, each with its distance from the request · 4 in on His9, the furthest
// off · 5 a post-processing step pastes the requested atoms in, and the ring tears · 6 back out to the whole.
// Slide 2 opens on that same view (same angle: the rocking angle is handed over) and zooms into two other
// side chains packed into each other: 1 the whole design · 2 Glu111 and Arg139 · 3 each one fine on its own.
//
// Elements show from step data-from on, or only on the steps in data-only.
{
const reveal = (frame, step, animate) => {
  frame.classList.toggle('instant', !animate);
  void frame.offsetWidth;  // flush styles, so a fresh mount fades in from the hidden state
  for (const el of frame.querySelectorAll('[data-from]')) el.classList.toggle('in', step >= Number(el.dataset.from));
  for (const el of frame.querySelectorAll('[data-only]')) el.classList.toggle('in', el.dataset.only.split(' ').map(Number).includes(step));
};
// red for what is wrong, blue for the clash's positive partner (the talk this came from called them
// classes.negative / classes.positive); per theme
const MARK = {
  dark: { negative: '#ef6b6b', positive: '#6c8cff' },
  light: { negative: '#cf3434', positive: '#3a5bd9' },
};

const EXVIEW = { fov: 30, distance: 4.5 / Math.tan(Math.PI / 12) };
const WHOLE = { x: -3.7, z: -0.2, box: [7.0, 5.4] };   // where the whole design sits, and its box
const CLOSE_CLASH = { x: -3.7, z: -0.3, box: [7.0, 4.8] };  // the two side chains lie across the screen
const CLOSE_MOTIF = { x: -3.7, z: -0.3, box: [6.4, 5.0] };  // one residue, so it can fill more of the frame
const CONTEXT = 0.07;  // what is left of the cartoon and the ligands once a close-up has zoomed all the way in
const VDW = { C: 1.7, N: 1.55, O: 1.52, S: 1.8, FE: 2.05 };
const dScene = ([x, y, z]) => [x, -z, y];

// The design: its cartoon and ligands, inside the nesting both slides steer —
//   group (scale, place, rock) > axes (data axes to the scene's) > turn (the close-up's rotation) > shift (its centre)
// so a shot is a centre, a rotation, a scale and a place, and zooming is a tween between two of them.
function designStage(host, P, data, M) {
  const T = M.THREE;
  const D = data.enzyme_design;
  const scene = new M.ThreeDScene(host, {
    backgroundOpacity: 0, phi: Math.PI / 2, theta: -Math.PI / 2, distance: EXVIEW.distance, fov: EXVIEW.fov,
    enableOrbitControls: false,
  });
  const shade = Deck.molstar(scene, { scale: 1, fog: [EXVIEW.distance - 3, EXVIEW.distance + 6] });
  const cam = scene.camera3D.getCamera();
  const group = new T.Group();
  const axes = new T.Group();
  const turn = new T.Group();
  const shift = new T.Group();
  axes.matrixAutoUpdate = false;
  axes.matrix.set(1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1);  // as dScene does: [x, -z, y]
  group.add(axes); axes.add(turn); turn.add(shift);
  scene.threeScene.add(group);
  const owned = [];

  // a shot: what to look at, turned face-on, scaled to fill its box
  const quatOf = (r) => new T.Quaternion().setFromRotationMatrix(
    new T.Matrix4().set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1));
  function shotOf(points, rot, centre, place, pad = 0) {
    const q = rot ? quatOf(rot) : new T.Quaternion();
    const c = new T.Vector3(...(centre || [0, 0, 0]));
    const v = new T.Vector3();
    let w = 0, h = 0;
    for (const p of points) {
      v.set(p[0], p[1], p[2]).sub(c).applyQuaternion(q);
      w = Math.max(w, Math.abs(v.x)); h = Math.max(h, Math.abs(v.y));
    }
    return { q, c, s: Math.min(place.box[0] / (2 * w + pad), place.box[1] / (2 * h + pad)),
             p: new T.Vector3(place.x, 0, place.z) };
  }
  const whole = shotOf(D.ca, null, null, WHOLE);
  const task = shotOf(D.task.xyz.concat(...D.ligands.map((l) => l.xyz)), null, null, CLOSE_MOTIF, 5);

  // the cartoon and the ligands, both in the design's frame
  const toonMat = new T.MeshStandardMaterial({ color: new T.Color(P.neutral), transparent: true });
  const toon = Deck.cartoon(data.enzyme_design_cartoon, { material: toonMat });
  shift.add(toon.mesh);
  owned.push(toonMat, toon);

  const unitY = new T.Vector3(0, 1, 0), m4 = new T.Matrix4(), q4 = new T.Quaternion();
  const cpkOf = (el, carbon) => new T.Color(el === 'C' ? carbon : (P.cpk[el] || P.cpk.other));
  const cpk = cpkOf;
  function ballStick(parent, pts, colours, bonds, ar, br) {
    const mat = new T.MeshStandardMaterial({ transparent: true });
    const sg = new T.SphereGeometry(ar, 16, 12), cg = new T.CylinderGeometry(br, br, 1, 12, 1, true);
    const spheres = new T.InstancedMesh(sg, mat, pts.length);
    const sticks = new T.InstancedMesh(cg, mat, 2 * bonds.length);
    sticks.visible = bonds.length > 0;
    pts.forEach((p, k) => spheres.setColorAt(k, colours[k]));
    bonds.forEach(([i, j], k) => { sticks.setColorAt(2 * k, colours[i]); sticks.setColorAt(2 * k + 1, colours[j]); });
    const g = new T.Group();
    g.add(spheres, sticks);
    parent.add(g);
    owned.push(mat, sg, cg);
    const put = (at) => {
      at.forEach((p, k) => spheres.setMatrixAt(k, m4.makeTranslation(p[0], p[1], p[2])));
      bonds.forEach(([i, j], k) => {
        const a = new T.Vector3(...at[i]), b = new T.Vector3(...at[j]), mid = a.clone().add(b).multiplyScalar(0.5);
        [[a, mid], [b, mid]].forEach(([u, w], h) => {
          const d = w.clone().sub(u);
          q4.setFromUnitVectors(unitY, d.clone().normalize());
          m4.compose(u.clone().add(w).multiplyScalar(0.5), q4, new T.Vector3(1, Math.max(1e-4, d.length()), 1));
          sticks.setMatrixAt(2 * k + h, m4);
        });
      });
      spheres.instanceMatrix.needsUpdate = true;
      sticks.instanceMatrix.needsUpdate = true;
    };
    put(pts);
    return { put, set(a) { mat.opacity = a; mat.depthWrite = a > 0.99; g.visible = a > 0.001; } };
  }

  const ligParts = D.ligands.map((l) => {
    if (l.xyz.length === 1) {  // a lone ion: one sphere in the metal colour
      const geo = new T.SphereGeometry(1.1, 24, 16);
      const mat = new T.MeshStandardMaterial({ color: new T.Color(P.metal), transparent: true });
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(...l.xyz[0]);
      shift.add(mesh);
      owned.push(geo, mat);
      return { set(a) { mat.opacity = a; mat.depthWrite = a > 0.99; mesh.visible = a > 0.001; } };
    }
    return ballStick(shift, l.xyz, l.elements.map((el) => cpk(el, P.ligand)), l.bonds, 0.4, 0.16);
  });
  // the cartoon and the ligands fade separately: the first slide shows the ligands before anything is built
  const setContext = (a, lig = a) => {
    toonMat.opacity = a; toonMat.depthWrite = a > 0.99; toon.mesh.visible = a > 0.001;
    ligParts.forEach((p) => p.set(lig));
  };

  // posing: a shot, or a point between two of them
  let shot = whole;
  function pose(a, b, t, mult = 1) {
    const s = (b ? a.s + (b.s - a.s) * t : a.s) * mult;
    group.scale.setScalar(s);
    sizeCages();
    group.position.copy(b ? a.p.clone().lerp(b.p, t) : a.p);
    turn.quaternion.copy(b ? a.q.clone().slerp(b.q, t) : a.q);
    shift.position.copy((b ? a.c.clone().lerp(b.c, t) : a.c).clone().negate());
    shade.scale(s);
  }
  const project = (p) => {
    const w = shift.localToWorld(new T.Vector3(p[0], p[1], p[2])).project(cam);
    return [(w.x + 1) / 2 * host.clientWidth, (1 - w.y) / 2 * host.clientHeight];
  };
  // Where the task wants an atom, as an open cage. Few enough edges that it still reads as a net when small
  // (a denser one merges into a dark ball), and faded out only once it is a handful of pixels across.
  const CAGE_R = 0.45;
  const cageGeo = new T.IcosahedronGeometry(CAGE_R, 1);
  const cageParts = [];
  owned.push(cageGeo);
  function cages(points) {
    const mat = new T.MeshBasicMaterial({ color: new T.Color(P.fg), wireframe: true, transparent: true });
    const mesh = new T.InstancedMesh(cageGeo, mat, points.length);
    const m = new T.Matrix4();
    points.forEach((q, k) => mesh.setMatrixAt(k, m.makeTranslation(q[0], q[1], q[2])));
    mesh.renderOrder = 3;
    shift.add(mesh);
    owned.push(mat);
    const part = { mat, mesh, want: 0 };
    cageParts.push(part);
    return (v) => { part.want = v; sizeCages(); };
  }
  function sizeCages() {
    const px = CAGE_R * group.scale.x * (host.clientWidth / 16);  // on-screen radius; the frame is 16 units
    const k = Math.max(0, Math.min(1, (px - 4) / 5));
    for (const c of cageParts) {
      c.mat.opacity = 0.6 * c.want * k;
      c.mesh.visible = c.mat.opacity > 0.004;
    }
  }

  // Every side chain the design built, faintly, minus the residues a slide draws itself. The Cα goes in too,
  // or the Cα–Cβ bond is dropped and the side chains float free of the ribbon they hang off.
  function sideChains({ skip = [], only = null, colour = null, ar = 0.22, br = 0.09 } = {}) {
    const A = D.all, out = new Set(skip), want = only && new Set(only);
    const hasSide = new Set(A.residue.filter((r, i) => !A.backbone[i]));  // glycine has none, so no lone Cα
    const take = A.xyz.map((_, i) => i).filter((i) => !out.has(A.residue[i]) && (!want || want.has(A.residue[i]))
      && hasSide.has(A.residue[i]) && (!A.backbone[i] || A.names[i] === 'CA'));
    const at = new Map(take.map((i, k) => [i, k]));
    const bonds = A.bonds.filter(([i, j]) => at.has(i) && at.has(j)).map(([i, j]) => [at.get(i), at.get(j)]);
    const paint = colour ? new T.Color(colour) : null;
    return ballStick(shift, take.map((i) => A.xyz[i]),
      take.map((i) => paint || cpkOf(A.elements[i], P.cpk.C)), bonds, ar, br);
  }
  return { T, D, scene, cam, group, shift, owned, whole, task, shotOf, ballStick, cages, cpk, setContext, sideChains, pose, project,
           dispose() { owned.forEach((o) => o.dispose()); scene.dispose(); } };
}

// The two slides show the same design, so the second picks up the first's rocking angle: without this
// they cross-fade at different angles and the molecule ghosts.
let handoff = null;

// Drag to turn and scroll to zoom, rocking on its own 1.5 s after you let go; shared by both slides.
// `user` multiplies whatever scale the step asked for, so a zoom rides on top of the slide's own framing.
function rocking(host, frame, onDirty) {
  const state = { theta: 0, tilt: 0.1, base: 0, phase: 0, held: false, resume: 0, amp: 0.22, speed: 0.35, user: 1 };
  host.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.user = Math.min(8, Math.max(0.5, state.user * Math.exp(-e.deltaY * 0.0014)));
    onDirty();
  }, { passive: false });
  let drag = null;
  host.addEventListener('pointerdown', (e) => {
    const box = host.getBoundingClientRect();
    state.held = true; clearTimeout(state.resume);
    drag = { x: e.clientX, y: e.clientY, k: 0.01 * host.clientWidth / box.width };
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag) return;
    state.theta += (e.clientX - drag.x) * drag.k;
    state.tilt = Math.min(1.4, Math.max(-1.4, state.tilt + (e.clientY - drag.y) * drag.k));
    Object.assign(drag, { x: e.clientX, y: e.clientY });
    onDirty();
  });
  const release = () => {
    if (!drag) return;
    drag = null;
    state.resume = setTimeout(() => { state.held = false; state.base = state.theta - state.amp * Math.sin(state.phase); }, 1500);
  };
  host.addEventListener('pointerup', release);
  host.addEventListener('pointercancel', release);
  return state;
}

// The motif, first: what the task asks for, what the model returns, and what a paste step does to it.
const COPY = {
  // The heading turns with the picture: step 1 is the task on its own, so it names the task; from step 2 the
  // design is on screen and it names what built it. Both are .deck-heading, which is absolutely positioned,
  // so they stack and cross-fade in place.
  headings: ['A typical enzyme design task', 'Checking a generated design'],
  // Steps 1 and 2 — the task, and the design it returns — are said out loud, not written; the figure carries
  // the per-residue distances, so the column starts at step 3 and does not repeat them. Each point names the
  // step it belongs to, because step 4 only moves in on the residue and the paste waits for step 5.
  at: [3, 5],
  points: [
    ['Satisfies two residues well, misses two', ''],
    ['So a post-processing step pastes them in', 'only the pinned atoms move, and His9’s ring tears: ND1–CE1 goes to 3.19 Å'],
  ],
  pinLabel: 'pinned by the task',
};

Deck.slide('design-task', {
  steps: 6,
  interactive: true,
  notes: 'The task (from PDB 1OS7, taurine dioxygenase): an Fe(II), taurine and alpha-ketoglutarate, all given, '
    + 'and given atoms of four residues - two histidines (three and five atoms), an aspartate (four) and an '
    + 'arginine (two), 14 atoms in all. No backbone, no positions in the chain, no other residues. Step 2: the '
    + 'design generated for it, 180 residues. Step 3: the four as the model built them, each with the RMSD of '
    + 'its requested atoms - Asp10 0.2 and Arg29 0.4 A are fine, His8 1.1 and His9 2.1 A are not. Step 4: His9, '
    + 'a sound imidazole (ND1-CE1 1.31 A against an ideal 1.32) whose three requested atoms sit 2.1 A from where '
    + 'they were asked to be. Step 5: a post-processing step overwrites exactly those three with the requested '
    + 'coordinates and leaves the rest of the residue alone, so ND1-CE1 stretches to 3.19 A - the ring tears. '
    + 'Step 6 zooms back out; the next slide continues from that view. The framing: a representation problem, '
    + 'not a bug - the request arrives as a few atoms with no way to say what the rest of the residue should do.',

  mount(frame, ctx) {
    const { palette: P, data, M, css, esc } = ctx;
    css(`
      .mo-scene, .mo-over { position: absolute; inset: 0; }
      .mo-scene { touch-action: none; cursor: grab; }
      .mo-over { pointer-events: none; overflow: visible; }
      .mo-lab { transition: opacity .5s; }
      .instant .mo-lab { transition: none; }
      .mo-switch { position: absolute; left: 4.2%; top: 84%; display: flex; align-items: center; gap: .55em;
        padding: .3em .2em; border: 0; background: none; color: var(--muted); cursor: pointer;
        font: 400 var(--t-caption) Lato, "Helvetica Neue", sans-serif; transition: opacity .5s; }
      .mo-switch i { position: relative; width: 2.3em; height: 1.25em; border-radius: 1em; background: var(--muted);
        opacity: .55; transition: background .25s, opacity .25s; }
      .mo-switch i::after { content: ''; position: absolute; left: .15em; top: .15em; width: .95em; height: .95em;
        border-radius: 50%; background: var(--bg); transition: transform .25s; }
      .mo-switch[aria-pressed="true"] i { background: var(--accent); opacity: 1; }
      .mo-switch[aria-pressed="true"] i::after { transform: translateX(1.05em); }
      .mo-switch[hidden] { display: none; }
    `);
    frame.innerHTML = `
      <div class="mo-scene"></div>
      <svg class="mo-over"><g class="mo-lab mo-task" opacity="0"></g><g class="mo-lab mo-pins" opacity="0"></g>
        <g class="mo-lab mo-cluster" opacity="0"></g><g class="mo-lab mo-miss" opacity="0"></g>
        <g class="mo-lab mo-broken" opacity="0"></g></svg>
      <h2 class="deck-heading reveal-in" data-only="1">${esc(COPY.headings[0])}</h2>
      <h2 class="deck-heading reveal-in" data-from="2">${esc(COPY.headings[1])}</h2>
      <button class="mo-switch" aria-pressed="true" hidden><i></i>the design</button>
      <div class="deck-col mo-col">${COPY.points.map(([t, sub], i) => `<div class="deck-point reveal-in" data-from="${COPY.at[i]}">
        <div class="deck-point-t"><span>${i + 1}</span>${esc(t)}</div>${sub ? `<div class="deck-point-s">${esc(sub)}</div>` : ''}</div>`).join('')}</div>`;
    const host = frame.querySelector('.mo-scene');
    const over = frame.querySelector('.mo-over');
    const taskLayer = over.querySelector('.mo-task'), pinLayer = over.querySelector('.mo-pins');
    const clusterLayer = over.querySelector('.mo-cluster');
    const missLayer = over.querySelector('.mo-miss'), brokenLayer = over.querySelector('.mo-broken');

    const st = designStage(host, P, data, M);
    const { T, D } = st;
    const Mo = D.motif, Task = D.task;

    // Where the task wants an atom is drawn as an open cage, never as an atom: only atoms the model actually
    // generated get a sphere and a bond, so nothing on screen suggests a bond to a position that is a request.
    // The residue the last step zooms into keeps its own cages and atoms, so the rest can be pushed back.
    const FOCUS = D.motif_index;
    const pinsOf = (pick) => pick.flatMap((mi) => D.motifs[mi].pinned.map((a) => D.motifs[mi].want[a]));
    const others = D.motifs.map((_, i) => i).filter((i) => i !== FOCUS);
    const cageFocus = st.cages(pinsOf([FOCUS]));
    const cageRest = st.cages(pinsOf(others));
    const taskAtoms = { set(v) { cageFocus(v); cageRest(v); } };
    taskAtoms.set(1);

    // what the model built around it: the cartoon (in the stage) and its side chains, faint
    const side = st.sideChains({ skip: D.motifs.map((m) => m.residue.index - 1) });
    side.set(0);

    // The motif residues as the model itself built them, rebuilt every frame: the paste is a morph from the
    // network's own atoms (pre) to the ones the paste step writes out (post).
    function morphSet(pick) {
      const flat = [];
      pick.forEach((mi) => D.motifs[mi].atoms.forEach((a) => flat.push([mi, a])));
      const start = {};
      pick.forEach((mi) => { start[mi] = flat.findIndex(([j]) => j === mi); });
      const bonds = pick.flatMap((mi) => D.motifs[mi].bonds.map(([i, j]) => [start[mi] + i, start[mi] + j]));
      const at = flat.map(([mi, a]) => D.motifs[mi].pre[a]);
      const set = st.ballStick(st.shift, at, flat.map(([mi, a]) => st.cpk(D.motifs[mi].elements[a], P.cpk.C)),
        bonds, 0.3, 0.12);
      return {
        at,
        put(mix) {
          flat.forEach(([mi, a], k) => {
            const q = D.motifs[mi].pre[a], r = D.motifs[mi].post[a];
            at[k] = [q[0] + (r[0] - q[0]) * mix, q[1] + (r[1] - q[1]) * mix, q[2] + (r[2] - q[2]) * mix];
          });
          set.put(at);
        },
        where: (mi, a) => at[start[mi] + D.motifs[mi].atoms.indexOf(a)],
        set: set.set,
      };
    }
    const resFocus = morphSet([FOCUS]);
    const resRest = morphSet(others);
    const res = { set(v) { resFocus.set(v); resRest.set(v); } };
    const setAtoms = (mix) => { resFocus.put(mix); resRest.put(mix); };
    const whereIs = (mi, a) => (mi === FOCUS ? resFocus : resRest).where(mi, a);
    const nowAt = (a) => whereIs(FOCUS, a);
    const close = st.shotOf(Mo.atoms.map((a) => Mo.post[a]).concat(Object.values(Mo.want)), Mo.rot, Mo.centre, CLOSE_MOTIF, 2.2);
    const cluster = st.shotOf(Task.xyz.concat(Task.pre), null, null, CLOSE_CLASH, 5);
    const broken = Mo.broken.slice(0, 2);

    function place() {
      const W = host.clientWidth, H = host.clientHeight;
      if (!W) return;
      over.setAttribute('viewBox', `0 0 ${W} ${H}`);
      st.group.updateMatrixWorld(true);
      st.cam.updateMatrixWorld();
      const fs = W * 0.0145, red = MARK[Deck.theme].negative;
      const halo = `stroke="${P.bg}" stroke-width="4" paint-order="stroke" font-family="Lato, sans-serif"`;
      // step 1: name the ligands and the pinned residues where they sit
      const all = Task.xyz.concat(...D.ligands.map((l) => l.xyz)).map((p) => st.project(p));
      const mx = all.reduce((t, q) => t + q[0], 0) / all.length;
      const my = all.reduce((t, q) => t + q[1], 0) / all.length;
      // pushed away from the middle of the whole task — but something sitting at that middle, like the lone
      // iron, has no direction to be pushed in, so its label goes straight above it
      const label = (pts, text, colour) => {
        const xs = pts.map((p) => st.project(p));
        const x = xs.reduce((t, q) => t + q[0], 0) / xs.length;
        const y = xs.reduce((t, q) => t + q[1], 0) / xs.length;
        const dx = x - mx, dy = y - my, n = Math.hypot(dx, dy);
        const [ox, oy] = n < W * 0.035 ? [0, -W * 0.032] : [dx / n * W * 0.05, dy / n * W * 0.05];
        return `<text x="${x + ox}" y="${y + oy + fs * 0.35}" font-size="${fs * 0.95}"
          font-weight="700" text-anchor="middle" fill="${colour}" ${halo}>${esc(text)}</text>`;
      };
      taskLayer.innerHTML = D.ligands.map((l) => label(l.xyz, l.name, P.ligand)).join('')
        + Task.residues.map((r, k) => {
          const pts = Task.xyz.filter((_, i) => Task.residue[i] === k);
          return label(pts, `${r.name}${r.index}`, P.accent);
        }).join('');
      const pinAt = Mo.pinned.map((a) => st.project(Mo.want[a]));
      const lx = pinAt.reduce((t, q) => t + q[0], 0) / pinAt.length;
      const ly = Math.min(...pinAt.map((q) => q[1]));
      pinLayer.innerHTML = `<text x="${lx}" y="${ly - W * 0.04}" font-size="${fs}" font-weight="700"
        text-anchor="middle" fill="${P.accent}" ${halo}>${esc(COPY.pinLabel)}</text>`
        + (() => {  // pushed out from the middle, then pulled apart where two pins sit on top of each other
          const cx = pinAt.reduce((t, q) => t + q[0], 0) / pinAt.length;
          const cy = pinAt.reduce((t, q) => t + q[1], 0) / pinAt.length;
          const spots = pinAt.map(([x, y]) => {
            const dx = x - cx, dy = y - cy, n = Math.hypot(dx, dy) || 1;
            return [x + dx / n * W * 0.04, y + dy / n * W * 0.04];
          });
          const gap = fs * 1.3;
          spots.slice().sort((a, b) => a[1] - b[1]).forEach((q, i, order) => {
            if (i && Math.abs(q[0] - order[i - 1][0]) < W * 0.05 && q[1] - order[i - 1][1] < gap) {
              q[1] = order[i - 1][1] + gap;
            }
          });
          return Mo.pinned.map((a, k) => `<text x="${spots[k][0]}" y="${spots[k][1] + fs * 0.35}"
            font-size="${fs * 0.9}" font-weight="700" text-anchor="middle" fill="${P.accent}"
            ${halo}>${esc(a)}</text>`).join('');
        })();
      clusterLayer.innerHTML = Task.xyz.map((want, i) => {
        const [x1, y1] = st.project(whereIs(Task.residue[i], Task.names[i]));
        const [x2, y2] = st.project(want);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${P.muted}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
      }).join('') + (() => {
        const all = Task.xyz.map((q) => st.project(q));
        const mx = all.reduce((t, q) => t + q[0], 0) / all.length;
        const my = all.reduce((t, q) => t + q[1], 0) / all.length;
        return Task.residues.map((r, k) => {
          const pts = Task.xyz.filter((_, i) => Task.residue[i] === k).map((q) => st.project(q));
          const x = pts.reduce((t, q) => t + q[0], 0) / pts.length;
          const y = pts.reduce((t, q) => t + q[1], 0) / pts.length;
          const dx = x - mx, dy = y - my, n = Math.hypot(dx, dy) || 1;
          const met = r.rmsd <= 0.5;
          return `<text x="${x + dx / n * W * 0.085}" y="${y + dy / n * W * 0.085 + fs * 0.35}" font-size="${fs}"
            font-weight="700" text-anchor="middle" fill="${met ? P.ligand : red}" ${halo}>${esc(r.name)}${r.index} ${r.rmsd.toFixed(1)} Å</text>`;
        }).join('');
      })();
      missLayer.innerHTML = Mo.pinned.map((a) => {
        const [x1, y1] = st.project(nowAt(a)), [x2, y2] = st.project(Mo.want[a]);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${P.accent}" stroke-width="2" stroke-dasharray="4 3"/>`;
      }).join('') + `<text x="${lx + W * 0.055}" y="${Math.max(...pinAt.map((q) => q[1])) + W * 0.062}" font-size="${fs}"
        font-weight="700" text-anchor="middle" fill="${P.accent}" ${halo}>${Mo.rmsd.toFixed(1)} Å off</text>`;
      brokenLayer.innerHTML = broken.map(({ atoms: [a, b], after, ideal }, i) => {
        const [x1, y1] = st.project(nowAt(a)), [x2, y2] = st.project(nowAt(b));
        const mx = (x1 + x2) / 2 + (i ? -W * 0.1 : W * 0.075), my = (y1 + y2) / 2 + (i ? -W * 0.012 : -W * 0.02);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${red}" stroke-width="3" stroke-dasharray="5 4"/>
          <line x1="${(x1 + x2) / 2}" y1="${(y1 + y2) / 2}" x2="${mx}" y2="${my}" stroke="${red}" stroke-width="1.2"/>
          <text x="${mx}" y="${my - fs * 0.5}" font-size="${fs}" font-weight="700" text-anchor="middle"
            fill="${red}" ${halo}>${esc(a)}–${esc(b)} ${after} Å</text>
          <text x="${mx}" y="${my + fs * 0.7}" font-size="${fs * 0.82}" text-anchor="middle"
            fill="${P.muted}" ${halo}>should be ${ideal}</text>`;
      }).join('');
    }

    let dead = false, active = false, dirty = true, step = 0, run = 0, zoom = 0, mix = 0, built = 0;
    let from = st.task, to = st.task, at01 = 0;   // the two shots this step moves between, and how far
    const rock = rocking(host, frame, () => { dirty = true; });
    function render() {
      if (dead) return;
      st.pose(from, to, at01, rock.user);
      st.group.rotation.set(rock.tilt, 0, rock.theta);
      st.scene.render();
      place();
    }
    let prev = performance.now(), raf = 0;
    const tick = (now) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (active && !rock.held) { rock.phase += rock.speed * dt; rock.theta = rock.base + rock.amp * Math.sin(rock.phase); dirty = true; }
      if (dirty) { dirty = false; render(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const tween = (ms, fn, id) => new Promise((done) => {
      const t0 = performance.now();
      const go = (now) => {
        if (dead || id !== run) return done();
        const t = Math.min(1, (now - t0) / ms);
        fn(t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
        dirty = true;
        if (t < 1) requestAnimationFrame(go); else done();
      };
      requestAnimationFrame(go);
    });
    // what the design (cartoon + its side chains) is worth at each step, and how far the close-up has zoomed
    // b: how much of the design is built, z: how far into a close-up, own: the model's own pinned atoms.
    // The switch below multiplies b, so the task stays and only what the model built comes and goes.
    let designOn = true, last = [0, 0, 0];
    const show = (b0, z, own = 0) => {
      last = [b0, z, own];
      const b = designOn ? b0 : 0;
      built = b; zoom = z;
      // the close-up takes the design almost away; the cluster step only pushes it back
      const fade = Math.min(z > 0 ? 1 - (1 - CONTEXT) * z : 1, own > 0 ? 1 - 0.72 * own : 1);
      // the cartoon drops away faster than the side chains: up close it is a huge shape right by the camera
      st.setContext(b * fade * fade, Math.max(fade, own > 0 && z === 0 ? 0.45 : 0));
      side.set(b * 0.45 * fade);
      resFocus.set(b * (z > 0 ? Math.max(fade, z) : 1));
      resRest.set(b * (z > 0 ? fade : 1));
      cageFocus(1);
      cageRest(Math.max(0, 1 - 1.6 * z));  // the last step is about one residue, so the others' cages go
    };
    const toggle = frame.querySelector('.mo-switch');
    toggle.addEventListener('click', () => {
      designOn = !designOn;
      toggle.setAttribute('aria-pressed', String(designOn));
      show(...last);
      dirty = true;
    });
    const moveTo = (a, b, t) => { from = a; to = b; at01 = t; };
    function enter(target, animate) {
      const id = ++run, was = step;
      step = target;
      rock.user = 1;  // each step sets its own framing again
      reveal(frame, target, animate);
      toggle.hidden = target < 2;
      taskLayer.style.opacity = target === 1 ? 1 : 0;
      clusterLayer.style.opacity = target === 3 ? 1 : 0;
      pinLayer.style.opacity = target === 4 ? 1 : 0;
      missLayer.style.opacity = 0;
      brokenLayer.style.opacity = target === 5 ? 1 : 0;
      if (animate && was === 1 && target === 2) {  // zoom out from the task, and build the design around it
        return tween(1500, (t) => { moveTo(st.task, st.whole, t); show(t, 0); }, id);
      }
      if (animate && was === 2 && target === 3) {  // in to the four the task named, with the model's own atoms beside them
        mix = 0; setAtoms(0);
        return tween(1600, (t) => { moveTo(st.whole, cluster, t); show(1, 0, t); }, id);
      }
      if (animate && was === 3 && target === 4) {  // in on the one that is furthest out, and stop there
        return tween(1400, (t) => { moveTo(cluster, close, t); show(1, t, 1 - t); }, id);
      }
      if (animate && was === 4 && target === 5) {  // the paste itself, on its own click
        moveTo(cluster, close, 1);
        return tween(1600, (t) => {
          mix = t; setAtoms(mix);
          brokenLayer.style.opacity = Math.max(0, (t - 0.55) / 0.45);
        }, id);
      }
      if (animate && was === 5 && target === 6) {  // back out to the whole design, where the next slide picks up
        return tween(2000, (t) => {
          moveTo(close, st.whole, t);
          show(1, 1 - t, 0);
          brokenLayer.style.opacity = Math.max(0, 1 - 2.5 * t);
        }, id);
      }
      if (target === 1) moveTo(st.task, st.task, 0);
      else if (target === 2 || target === 6) moveTo(st.whole, st.whole, 0);
      else if (target === 3) moveTo(st.whole, cluster, 1);
      else moveTo(cluster, close, 1);
      show(target >= 2 ? 1 : 0, target === 4 || target === 5 ? 1 : 0, target === 3 ? 1 : 0);
      mix = target >= 5 ? 1 : 0;
      setAtoms(mix);
      dirty = true;
      return undefined;
    }
    const resize = new ResizeObserver(() => { dirty = true; });
    resize.observe(frame);
    moveTo(st.task, st.task, 0);
    show(0, 0);
    setAtoms(0);
    return {
      enter(target, animate) { active = true; return enter(target, animate); },
      leave() {
        active = false;
        handoff = { theta: rock.theta, tilt: rock.tilt, phase: rock.phase, base: rock.base };
      },
      freeze() { render(); },
      destroy() {
        dead = true; active = false;
        cancelAnimationFrame(raf); clearTimeout(rock.resume); resize.disconnect();
        st.dispose();
      },
      get step() { return step; },
    };
  },
});

// ------------------------------------------------------------------------------------------------------------
// The same design, zoomed back out: the motif is not the only thing wrong with it.
const CLASH = {
  heading: 'What about other side chains?',
  // Step 1 is the view the previous slide zoomed out to, which speaks for itself; the column starts at 2.
  from: 2,
  points: [
    ['Glu111 and Arg139 are inside each other', 'their closest atoms are 1.3 Å apart, where an O and an N touch at ~3 Å'],
    ['Yet each side chain is fine on its own', 'favoured rotamers, bond RMSZ 1.0: the chemistry is right, the packing is not'],
  ],
};

Deck.slide('design-clash', {
  steps: 3,
  interactive: true,
  notes: 'The bridge from the last slide: that side chain was torn by the paste, so what about the ones the '
    + 'model built freely? Same design, so one structure carries both problems. Glu111 and Arg139 are scaffold, '
    + 'not requested. Their closest heavy atoms: Glu111 OE2 - Arg139 NH2 1.30 A, CD - NH2 2.27 A, OE2 - CZ '
    + '2.47 A. In a salt bridge a carboxylate oxygen and a guanidinium nitrogen sit about 2.8-3.0 A apart, so '
    + 'this is roughly 1.5 A too close: the salt bridge is built through itself. Both are favoured rotamers; '
    + 'the scaffold bond RMSZ is 1.04 and angle RMSZ 0.9, so nothing is wrong with either side chain alone - '
    + 'the chemistry is right, the packing is not.',

  mount(frame, ctx) {
    const { palette: P, data, M, css, esc } = ctx;
    css(`
      .rc-scene, .rc-over { position: absolute; inset: 0; }
      .rc-scene { touch-action: none; cursor: grab; }
      .rc-over { pointer-events: none; overflow: visible; }
      .rc-lab { transition: opacity .5s; }
      .instant .rc-lab { transition: none; }
    `);
    frame.innerHTML = `
      <div class="rc-scene"></div>
      <svg class="rc-over"><g class="rc-lab rc-pairs" opacity="0"></g><g class="rc-lab rc-names" opacity="0"></g></svg>
      <h2 class="deck-heading reveal-in in">${esc(CLASH.heading)}</h2>
      <div class="deck-col rc-col">${CLASH.points.map(([t, sub], i) => `<div class="deck-point reveal-in" data-from="${i + CLASH.from}">
        <div class="deck-point-t"><span>${i + 1}</span>${esc(t)}</div>${sub ? `<div class="deck-point-s">${esc(sub)}</div>` : ''}</div>`).join('')}</div>`;
    const host = frame.querySelector('.rc-scene');
    const over = frame.querySelector('.rc-over');
    const pairLayer = over.querySelector('.rc-pairs'), nameLayer = over.querySelector('.rc-names');

    const st = designStage(host, P, data, M);
    const { T, D } = st;
    const C = D.clash;
    const resColour = [MARK[Deck.theme].negative, MARK[Deck.theme].positive].map((c) => new T.Color(c));

    const side = st.sideChains({ skip: C.residues.map((r) => r.num - 1)
      .concat(D.motifs.map((m) => m.residue.index - 1)) });
    side.set(0.5);
    const colours = C.elements.map((el, i) => st.cpk(el, resColour[C.residue[i]]));
    const atoms = st.ballStick(st.shift, C.xyz, colours, C.bonds, 0.34, 0.13);
    atoms.set(1);
    const vdwMat = new T.MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const vdwGeo = new T.SphereGeometry(1, 24, 16);
    const vdw = new T.InstancedMesh(vdwGeo, vdwMat, C.xyz.length);
    const m4 = new T.Matrix4();
    C.xyz.forEach((p, k) => {
      const r = VDW[C.elements[k]] || 1.7;
      vdw.setMatrixAt(k, m4.compose(new T.Vector3(...p), new T.Quaternion(), new T.Vector3(r, r, r)));
      vdw.setColorAt(k, resColour[C.residue[k]]);
    });
    vdw.renderOrder = 2;
    st.shift.add(vdw);
    st.owned.push(vdwMat, vdwGeo);

    const close = st.shotOf(C.xyz, C.rot, C.centre, CLOSE_CLASH, 2.0);
    // The previous slide zooms back out to this same whole-design view before handing over, so this one opens
    // on it directly; what it keeps on screen is the motif it worked on, below.
    const Mo = D.motifs[D.motif_index];
    // The motif the previous slide worked on stays on screen through the pull-out and in the wide view, so the
    // two slides share an anchor; it only fades when this slide zooms somewhere else.
    function motifSet(pick) {
      const flat = [];
      pick.forEach((mi) => D.motifs[mi].atoms.forEach((a) => flat.push([mi, a])));
      const start = {};
      pick.forEach((mi) => { start[mi] = flat.findIndex(([j]) => j === mi); });
      const bonds = pick.flatMap((mi) => D.motifs[mi].bonds.map(([i, j]) => [start[mi] + i, start[mi] + j]));
      const res = st.ballStick(st.shift, flat.map(([mi, a]) => D.motifs[mi].post[a]),
        flat.map(([mi, a]) => st.cpk(D.motifs[mi].elements[a], P.cpk.C)), bonds, 0.3, 0.12);
      const cage = st.cages(pick.flatMap((mi) => D.motifs[mi].pinned.map((a) => D.motifs[mi].want[a])));
      return (v) => { res.set(v); cage(v); };
    }
    const heldFocus = motifSet([D.motif_index]);           // exactly what the previous slide ended on
    const heldRest = motifSet(D.motifs.map((_, i) => i).filter((i) => i !== D.motif_index));
    heldFocus(0);
    heldRest(0);
    const shown = C.pairs.filter((p) => p[2] < 2.6);
    function place() {
      const W = host.clientWidth, H = host.clientHeight;
      if (!W) return;
      over.setAttribute('viewBox', `0 0 ${W} ${H}`);
      st.group.updateMatrixWorld(true);
      st.cam.updateMatrixWorld();
      const fs = W * 0.0145, red = MARK[Deck.theme].negative;
      const halo = `stroke="${P.bg}" stroke-width="4" paint-order="stroke" font-family="Lato, sans-serif"`;
      pairLayer.innerHTML = shown.map(([i, j, d], k) => {
        const [x1, y1] = st.project(C.xyz[i]), [x2, y2] = st.project(C.xyz[j]);
        const lab = k === 0 ? `<text x="${(x1 + x2) / 2 + W * 0.02}" y="${(y1 + y2) / 2 - W * 0.012}" font-size="${fs}"
          font-weight="700" fill="${red}" ${halo}>${d.toFixed(1)} Å</text>` : '';
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${red}" stroke-width="${k ? 1.5 : 2.5}"
          stroke-dasharray="4 3"/>${lab}`;
      }).join('');
      nameLayer.innerHTML = C.residues.map((r, k) => {
        const idx = C.residue.map((o, i) => (o === k ? i : -1)).filter((i) => i >= 0);
        const c = idx.reduce((a, i) => a.add(new T.Vector3(...C.xyz[i])), new T.Vector3()).multiplyScalar(1 / idx.length);
        const far = idx.reduce((b, i) => (new T.Vector3(...C.xyz[i]).distanceTo(c) > new T.Vector3(...C.xyz[b]).distanceTo(c) ? i : b), idx[0]);
        const [x, y] = st.project(C.xyz[far]), [x0, y0] = st.project([c.x, c.y, c.z]);
        const dx = x - x0, dy = y - y0, n = Math.hypot(dx, dy) || 1;
        return `<text x="${x + dx / n * W * 0.035}" y="${y + dy / n * W * 0.035}" font-size="${fs}" font-weight="700"
          text-anchor="middle" dominant-baseline="middle" fill="#${resColour[k].getHexString(T.SRGBColorSpace)}"
          ${halo}>${esc(r.name)}${r.num}</text>`;
      }).join('');
    }

    let dead = false, active = false, dirty = true, step = 0, run = 0, zoom = 0;
    const rock = rocking(host, frame, () => { dirty = true; });
    function render() {
      if (dead) return;
      st.pose(st.whole, close, zoom, rock.user);
      st.group.rotation.set(rock.tilt, 0, rock.theta);
      st.scene.render();
      place();
    }
    let prev = performance.now(), raf = 0;
    const tick = (now) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (active && !rock.held) { rock.phase += rock.speed * dt; rock.theta = rock.base + rock.amp * Math.sin(rock.phase); dirty = true; }
      if (dirty) { dirty = false; render(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const tween = (ms, fn, id) => new Promise((done) => {
      const t0 = performance.now();
      const go = (now) => {
        if (dead || id !== run) return done();
        const t = Math.min(1, (now - t0) / ms);
        fn(t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
        dirty = true;
        if (t < 1) requestAnimationFrame(go); else done();
      };
      requestAnimationFrame(go);
    });
    const look = (k, t) => {
      zoom = k >= 2 ? t : 0;
      const fade = k >= 2 ? 1 - (1 - CONTEXT) * t : 1;
      // arriving from the close-up, the design is still faded to what the previous slide showed, and comes
      // up as the view opens; the held-over residue and cages go the other way
      st.setContext(fade, fade);
      side.set(0.5 * fade);
      heldFocus(fade);   // the motif stays as the anchor between the two slides, and fades with this zoom
      heldRest(fade);
      atoms.set(k >= 2 ? t : 0);
      vdwMat.opacity = k >= 2 ? 0.2 * t : 0;
      vdw.visible = vdwMat.opacity > 0.001;
    };
    function enter(target, animate) {
      const id = ++run, from = step;
      step = target;
      rock.user = 1;  // each step sets its own framing again
      reveal(frame, target, animate);
      pairLayer.style.opacity = target >= 2 ? 1 : 0;
      nameLayer.style.opacity = target >= 2 ? 1 : 0;
      if (animate && from === 1 && target === 2) return tween(1800, (t) => look(2, t), id);
      if (from === 0 && target === 1 && handoff) {  // arriving from the motif slide, which has already zoomed
        Object.assign(rock, handoff);               // back out to this view: same framing, same angle
      }
      look(target, 1);
      dirty = true;
      return undefined;
    }
    const resize = new ResizeObserver(() => { dirty = true; });
    resize.observe(frame);
    look(1, 1);
    return {
      enter(target, animate) { active = true; return enter(target, animate); },
      leave() { active = false; },
      freeze() { render(); },
      destroy() {
        dead = true; active = false;
        cancelAnimationFrame(raf); clearTimeout(rock.resume); resize.disconnect();
        st.dispose();
      },
      get step() { return step; },
    };
  },
});
}
