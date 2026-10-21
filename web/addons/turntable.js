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
//   view.add(mobjectOrMesh);         // M.Molecule3D and other mobjects, or any THREE.Object3D
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

    const view = { theta: -Math.PI / 2, phi: Math.PI / 2 - tilt, zoom: 1, base: -Math.PI / 2, phase: 0 };
    let active = false, held = false, resume = 0, dirty = true, dead = false, raf = 0;

    function render() {
      if (dead) return;
      const d = distance / view.zoom;
      scene.setCameraOrientation(view.phi, view.theta, d);
      if (style) style.fog(d - radius * 0.3, d + radius * 1.2);
      scene.render();
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
      view.zoom = Math.min(zoom[1], Math.max(zoom[0], view.zoom * Math.exp(-e.deltaY * 0.0015)));
      dirty = true;
    };
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
    host.addEventListener('wheel', wheel, { passive: false });
    const resize = new ResizeObserver(() => { dirty = true; });
    resize.observe(host);

    return {
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
      dirty() { dirty = true; },
      render,
      start() { active = true; prev = performance.now(); },
      stop() { active = false; },
      reset() { Object.assign(view, { theta: -Math.PI / 2, phi: Math.PI / 2 - tilt, zoom: 1, base: -Math.PI / 2, phase: 0 }); dirty = true; },
      dispose() {
        dead = true;
        cancelAnimationFrame(raf);
        clearTimeout(resume);
        resize.disconnect();
        scene.dispose();
      },
    };
  }

  window.Deck.turntable = turntable;
})();
