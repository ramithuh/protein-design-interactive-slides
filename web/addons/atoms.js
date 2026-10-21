// Atoms for three.js scenes, cheap enough to draw hundreds and fade as one: ball-and-stick and cages.
//
//   const sc = Deck.ballStick(points, colours, bonds, { atom: 0.25, bond: 0.1 });  // points [[x, y, z]], colours THREE.Color
//   view.add(sc.group); sc.opacity(0.5); sc.put(newPoints); sc.dispose();
//
//   const cg = Deck.cages(points, { radius: 0.45, color: P.fg });   // an open wireframe ball at each point
//   view.add(cg.mesh); cg.opacity(0.6); cg.dispose();
//
// A cage marks where something should be (a requested atom, a target), so you can see at a glance whether the
// atom that was built sits inside it. Its icosahedron has few enough edges that it still reads as a net when
// small. Units are whatever the points are in (Å in the examples, with the group scaled into the scene).
// Deck.elementColours(elements, P, carbon) gives Mol*'s element colours, with carbon in a colour of your choice.
(function () {
  'use strict';

  function ballStick(points, colours, bonds, { atom = 0.25, bond = 0.1, detail = 16 } = {}) {
    const T = window.ManimWeb.THREE;
    const mat = new T.MeshStandardMaterial({ transparent: true });
    const sg = new T.SphereGeometry(atom, detail, Math.round(detail * 0.75));
    const cg = new T.CylinderGeometry(bond, bond, 1, 12, 1, true);
    const spheres = new T.InstancedMesh(sg, mat, points.length);
    const sticks = new T.InstancedMesh(cg, mat, Math.max(1, 2 * bonds.length));
    sticks.visible = bonds.length > 0;
    // each bond is two half-sticks, one in each atom's colour
    points.forEach((_, k) => spheres.setColorAt(k, colours[k]));
    bonds.forEach(([i, j], k) => { sticks.setColorAt(2 * k, colours[i]); sticks.setColorAt(2 * k + 1, colours[j]); });
    const group = new T.Group();
    group.add(spheres, sticks);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    function put(at) {
      at.forEach((p, k) => spheres.setMatrixAt(k, m4.makeTranslation(p[0], p[1], p[2])));
      bonds.forEach(([i, j], k) => {
        const a = new T.Vector3(...at[i]), b = new T.Vector3(...at[j]), mid = a.clone().add(b).multiplyScalar(0.5);
        [[a, mid], [b, mid]].forEach(([u, w], h) => {
          const d = w.clone().sub(u);
          q.setFromUnitVectors(up, d.clone().normalize());
          m4.compose(u.clone().add(w).multiplyScalar(0.5), q, new T.Vector3(1, Math.max(1e-4, d.length()), 1));
          sticks.setMatrixAt(2 * k + h, m4);
        });
      });
      spheres.instanceMatrix.needsUpdate = true;
      sticks.instanceMatrix.needsUpdate = true;
    }
    put(points);
    return {
      group, put,
      // below 1 the atoms stop writing depth, so the Mol*-style outline and shading treat them as see-through
      opacity(a) { mat.opacity = a; mat.depthWrite = a > 0.99; group.visible = a > 0.001; },
      dispose() { mat.dispose(); sg.dispose(); cg.dispose(); },
    };
  }

  function cages(points, { radius = 0.45, color = '#000000', opacity = 0.6 } = {}) {
    const T = window.ManimWeb.THREE;
    const geo = new T.IcosahedronGeometry(radius, 1);
    const mat = new T.MeshBasicMaterial({ color: new T.Color(color), wireframe: true, transparent: true, opacity });
    const mesh = new T.InstancedMesh(geo, mat, points.length);
    const m = new T.Matrix4();
    points.forEach((p, k) => mesh.setMatrixAt(k, m.makeTranslation(p[0], p[1], p[2])));
    mesh.renderOrder = 3;  // over the atoms inside them
    return {
      mesh,
      opacity(a) { mat.opacity = opacity * a; mesh.visible = a > 0.004; },
      dispose() { geo.dispose(); mat.dispose(); },
    };
  }

  function elementColours(elements, P, carbon = null) {
    const T = window.ManimWeb.THREE;
    return elements.map((el) => new T.Color(el === 'C' && carbon ? carbon : (P.cpk[el] || P.cpk.other)));
  }

  Object.assign(window.Deck, { ballStick, cages, elementColours });
})();
