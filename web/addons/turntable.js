// A 3D stage for molecules and other models: a transparent manim-web ThreeDScene with the Mol*-like look
// (web/addons/molstar.js), a camera you can turn by dragging and zoom with the wheel, and a gentle idle rock
// so the model reads as 3D while you talk. Turning moves the camera, not the model, so anything in the scene
// (manim mobjects such as M.Molecule3D, or plain three.js meshes such as Deck.cartoon) turns together.
//
//   const view = Deck.turntable(host, {
//     radius: 3,            // scene units: about the model's half-size (sets the camera distance and the fog)
//     scale: 0.16,          // scene units per Å, for the look's Å-based outline and occlusion
//     rock: 0.4,            // radians either way while idle (0: still)
//     tilt: 0.25,           // radians the camera starts above the equator
//   });
//   view.add(mobjectOrMesh);         // M.Molecule3D and other mobjects, or any THREE.Object3D (scene units)
//   view.model.add(mesh);            // or three.js objects in Å: view.model is a group scaled by `scale`
//   view.model.rotation.x = Math.PI / 2;   // for data with y up (the default view has z up)
//   await view.focus(pointInÅ, 4, 1200);   // turn about that point at 4x zoom, moving there over 1.2 s
//   await view.focus(p, 4, 1200, { from: dirInÅ });   // ...and swing round to look from that side
//   view.project(pointInÅ);          // where a model point is on screen, [x, y] px in the host (for labels)
//   view.start(); view.stop();       // from the slide's enter() and leave()
//   return { enter, leave, freeze: view.render, destroy: view.dispose };
//
// Set the host's class to "deck-stage turnable" for the grab cursor. A press that moves is a drag here, so the
// deck's click-to-advance still works on a plain click. Coordinates: z is up on screen at the start, the
// camera looks along +y, x is to the right.
(function () {
  'use strict';

  function turntable(host, { radius = 3, scale = 0.16, rock = 0.4, speed = 0.55, tilt = 0.25, fov = 30,
                             zoom = [0.45, 2.5], look = {} } = {}) {
    const M = window.ManimWeb;
    const distance = radius / Math.tan((fov / 2) * Math.PI / 180) * 1.15;
    const scene = new M.ThreeDScene(host, {
      backgroundOpacity: 0, fov, distance, phi: Math.PI / 2 - tilt, theta: -Math.PI / 2, enableOrbitControls: false,
    });
    const style = look && window.Deck.molstar ? window.Deck.molstar(scene, { scale, ...look }) : null;

    const T = M.THREE;
    const view = { theta: -Math.PI / 2, phi: Math.PI / 2 - tilt, zoom: 1, user: 1, base: -Math.PI / 2, phase: 0 };
    // Å-space content, and what the camera turns about: focus() slides the model so that point is at the origin
    const model = new T.Group();
    model.scale.setScalar(scale);
    scene.threeScene.add(model);
    const cam = scene.camera3D.getCamera();
    let active = false, held = false, resume = 0, dirty = true, dead = false, raf = 0, moving = 0;

    function render() {
      if (dead) return;
      const d = distance / (view.zoom * view.user), r = radius / view.zoom;
      scene.setCameraOrientation(view.phi, view.theta, d);
      if (style) style.fog(d - r * 0.3, d + r * 1.2);
      scene.render();
      if (api.onRender) api.onRender();
    }

    let prev = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (active && !held && rock) {
        view.phase += speed * dt;
        view.theta = view.base + rock * Math.sin(view.phase);
        dirty = true;
      }
      if (dirty) { dirty = false; render(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // drag turns, and the rock carries on from wherever you left it 1.5 s after you let go
    let drag = null;
    const down = (e) => {
      if (e.button !== 0) return;
      clearTimeout(resume);
      held = true;
      drag = { x: e.clientX, y: e.clientY, k: 6 / host.getBoundingClientRect().width };
      host.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!drag) return;
      view.theta -= (e.clientX - drag.x) * drag.k;
      view.phi = Math.min(Math.PI - 0.15, Math.max(0.15, view.phi - (e.clientY - drag.y) * drag.k));
      Object.assign(drag, { x: e.clientX, y: e.clientY });
      dirty = true;
    };
    const up = () => {
      if (!drag) return;
      drag = null;
      resume = setTimeout(() => { held = false; view.base = view.theta - rock * Math.sin(view.phase); }, 1500);
    };
    const wheel = (e) => {
      e.preventDefault();
      view.user = Math.min(zoom[1], Math.max(zoom[0], view.user * Math.exp(-e.deltaY * 0.0015)));
      dirty = true;
    };
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
    host.addEventListener('wheel', wheel, { passive: false });
    const resize = new ResizeObserver(() => { dirty = true; });
    resize.observe(host);

    const api = {
      scene,
      look: style,
      add(...things) {
        for (const t of things) {
          if (t && t.isObject3D) scene.threeScene.add(t); else scene.add(t);
        }
        dirty = true;
      },
      remove(...things) {
        for (const t of things) {
          if (t && t.isObject3D) scene.threeScene.remove(t); else scene.remove(t);
        }
        dirty = true;
      },
      model,
      dirty() { dirty = true; },
      render,
      // Move the turning point to `point` (Å, in the model) and the zoom to `z`, eased over `ms` (0: at once).
      // With { from: [x, y, z] } (a direction in the model, Å frame) the camera also swings round to look from
      // that side, e.g. face-on to two side chains that would hide each other edge-on. A newer call takes over.
      focus(point, z = 1, ms = 0, { from = null } = {}) {
        // the model may be turned (model.rotation), so the point is turned with it before it is centred
        const to = new T.Vector3(...point).applyQuaternion(model.quaternion).multiplyScalar(-scale);
        const p0 = model.position.clone(), z0 = view.zoom;
        // where the camera ends up: theta round the vertical, phi down from it (manim's spherical angles)
        let th0 = view.theta, th1 = th0, ph0 = view.phi, ph1 = ph0;
        if (from) {
          const d = new T.Vector3(...from).applyQuaternion(model.quaternion).normalize();
          th1 = Math.atan2(d.y, d.x);
          th1 = th0 + Math.atan2(Math.sin(th1 - th0), Math.cos(th1 - th0));   // the short way round
          ph1 = Math.min(Math.PI - 0.15, Math.max(0.15, Math.acos(d.z)));
          view.phase = 0;   // the rock restarts about the new direction
        }
        const id = ++moving;
        const at = (e) => {
          model.position.lerpVectors(p0, to, e);
          view.zoom = z0 * Math.pow(z / z0, e);  // zoom eases evenly in log scale
          if (from) { view.base = view.theta = th0 + (th1 - th0) * e; view.phi = ph0 + (ph1 - ph0) * e; }
          dirty = true;
        };
        if (!ms) { at(1); return Promise.resolve(); }
        return new Promise((done) => {
          const t0 = performance.now();
          const step = (now) => {
            if (dead || id !== moving) return done();
            const t = Math.min(1, (now - t0) / ms);
            at(t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
            if (t < 1) requestAnimationFrame(step); else done();
          };
          requestAnimationFrame(step);
        });
      },
      // the direction the camera looks from, in the model's own frame (to hand back to focus() later)
      get from() {
        const d = new T.Vector3(Math.sin(view.phi) * Math.cos(view.theta), Math.sin(view.phi) * Math.sin(view.theta), Math.cos(view.phi));
        return d.applyQuaternion(model.quaternion.clone().invert()).toArray();
      },
      project(point) {
        cam.updateMatrixWorld();
        const v = model.localToWorld(new T.Vector3(...point)).project(cam);
        return [(v.x + 1) / 2 * host.clientWidth, (1 - v.y) / 2 * host.clientHeight];
      },
      start() { active = true; prev = performance.now(); },
      stop() { active = false; },
      reset() {
        Object.assign(view, { theta: -Math.PI / 2, phi: Math.PI / 2 - tilt, zoom: 1, user: 1, base: -Math.PI / 2, phase: 0 });
        model.position.set(0, 0, 0);
        dirty = true;
      },
      onRender: null,     // set to a function to run after every redraw (e.g. placing HTML labels)
      dispose() {
        dead = true;
        cancelAnimationFrame(raf);
        clearTimeout(resume);
        resize.disconnect();
        scene.dispose();
      },
    };
    return api;
  }

  window.Deck.turntable = turntable;
})();
