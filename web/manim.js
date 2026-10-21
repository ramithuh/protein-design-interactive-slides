// A manim-web scene that builds up a click at a time: the on-click transitions of a manim talk, live in the
// browser. You describe the scene's objects once and what each click does to them; the stage plays a click's
// animations when you step forward, and when you jump (back a step, or onto the slide from a later one) it
// rebuilds the objects and applies the steps up to there instantly, so every step looks the same however
// you reached it.
//
//   const stage = Deck.manim(host, {
//     build: ({ M, P }) => ({                                 // fresh objects; called again on every rebuild
//       dot: new M.Dot({ color: P.accent }),
//       square: new M.Square({ sideLength: 2, color: P.fg }),
//     }),
//     steps: [                                                // steps[k - 1] takes you from step k - 1 to k
//       ({ dot }, { M }) => [new M.FadeIn(dot)],             //   return the animations to play together...
//       async ({ dot, square }, { M, play, wait }) => {      //   ...or call play() as often as you like
//         await play(new M.Transform(dot, square));
//         await wait(0.3);
//         await play(new M.Indicate(square));
//       },
//     ],
//     scene: { frameWidth: 16, frameHeight: 9 },             // optional: M.Scene options (these are the defaults)
//   });
//
// and in the slide's mount():
//
//   return { enter: stage.go, freeze: stage.freeze, destroy: stage.dispose };
//
// Step 1 is what plays as the slide arrives; a slide whose first frame should be still can make steps[0]
// add things without animating (`({ a }, { add }) => add(a)`). The scene is transparent, so the slide's
// background and HTML text show around it; put HTML text over it in the slide, or use M.Text / M.MathTex
// inside it. World units: x right, y up, origin at the centre, frameWidth x frameHeight across the host.
// Colours come from ctx.palette (P), so both themes work; never hard-code white or black.
(function () {
  'use strict';

  // Every leaf animation of a group (AnimationGroup, LaggedStart, Succession), for the instant path.
  const leaves = (a) => (a && Array.isArray(a.animations) ? a.animations.flatMap(leaves) : [a]);

  function manim(host, { build, steps, scene: options = {} }) {
    const M = window.ManimWeb, P = window.Deck.palette;
    const scene = new M.Scene(host, { backgroundOpacity: 0, frameWidth: 16, frameHeight: 9, ...options });
    let objects = null, at = 0, want = null, running = null, dead = false;

    // Applying a step at once: begin every animation, put it at its end and let it tidy the scene, as play()
    // would at the end of a run (FadeOut removes, ReplacementTransform swaps).
    const instant = (...anims) => {
      for (const a of anims.flat()) {
        for (const leaf of leaves(a)) {
          if (leaf.mobject && !leaf.remover) scene.add(leaf.mobject);
        }
        a.begin();
        a.interpolate(1);
        a.finish();
        for (const leaf of leaves(a)) leaf.cleanUpFromScene(scene);
      }
      return Promise.resolve();
    };
    const live = (...anims) => (dead ? Promise.resolve() : scene.play(...anims.flat()));
    const add = (...mobjects) => { scene.add(...mobjects.flat()); return Promise.resolve(); };

    async function run(k, fast) {
      const play = fast ? instant : live;
      const wait = fast ? () => Promise.resolve() : (s = 1) => scene.wait(s);
      const out = await steps[k](objects, { M, P, scene, play, wait, add, fast });
      if (Array.isArray(out) && out.length) await play(...out);
    }

    async function rebuild(step) {
      scene.clear({ render: false });
      objects = build({ M, P, scene }) || {};
      for (let k = 0; k < step; k++) await run(k, true);
      at = step;
      scene.render();
    }

    // Requests queue up: clicking ahead while a step is still playing plays the next ones in order, and
    // anything that is not a plain step forward rebuilds instantly.
    async function pump() {
      await document.fonts.load('600 32px Lato').catch(() => {});  // M.Text draws with the page's fonts
      while (want && !dead) {
        const { step, animate } = want;
        if (objects && step === at) { want = null; break; }
        if (animate && step > at) {
          if (!objects) await rebuild(0);
          await run(at, false);
          at += 1;
        } else {
          await rebuild(step);
        }
        if (want && want.step === at && objects) want = null;
      }
    }

    return {
      scene,
      get objects() { return objects; },
      get step() { return at; },
      go(step, animate = true) {
        want = { step: Math.max(0, Math.min(step, steps.length)), animate };
        if (!running) running = pump().finally(() => { running = null; });
        return running;
      },
      freeze() { scene.render(); },
      dispose() { dead = true; scene.dispose(); },
    };
  }

  window.Deck.manim = manim;
})();
