// A Mol*-like look for manim-web 3D scenes (Mol* is the viewer on the PDB's pages): a dark outline wherever
// depth jumps (around each atom and where it passes in front of another), ambient occlusion in the creases
// where bonds meet atoms and atoms crowd each other, matte surfaces under a soft key light beside the viewer,
// and a little depth fog.
//
//   const look = Deck.molstar(scene, { scale: s, fog: [near, far] })  // right after making the scene; s is the
//   look.fog(near, far)              // slide's scene units per Å. Colour atoms with palette.cpk. Move the fog
//   look.scale(s)                    // as the camera does, and the scale if the slide zooms or learns it later.
//
// THE DECK'S LOOK is Deck.molstar.look, below, in Å and CSS pixels so every slide looks alike whatever its
// scale. Change it there, or for one talk from its page before the slides mount:
//   <script>Deck.molstar.configure({ occlusion: { strength: 1.2 } })</script>
// and for one slide, pass the same keys to Deck.molstar(scene, {...}).
//
// It takes over the scene's draw: the scene renders offscreen with its depth buffer, an occlusion pass reads
// the depth (SSAO: samples a hemisphere over each surface point, rebuilt from depth), and a final pass blurs the
// occlusion and adds outline and fog. Fog distances are in scene units, from the camera.
(function () {
  'use strict';

  // Tuned side by side with Mol* itself (the same structures in both viewers). Mol* lights colours as displayed, with a dim
  // ambient light and occlusion reaching 32 Å, so a protein's far side and the undersides of strands go dark;
  // three.js lights in linear space, which lifts shadows, hence the low ambient, the matte surface and a
  // second, wide occlusion pass.
  const LOOK = {
    outline: {
      width: 1.5,           // CSS pixels
      threshold: 1.25,      // Å: drawn only where depth jumps by more, so a cartoon ribbon's own 0.4 Å is not inked
      color: '#000000',
      strength: 1,          // < 1 for a fainter line
    },
    occlusion: {
      radius: 9.4, bias: 0.06, strength: 1.5,  // Å: the creases where atoms and ribbons crowd each other
      wide: { radius: 31, strength: 1.4 },      // Å: whole parts shading the ones behind (radius 0 turns it off)
    },
    light: { ambient: 0.2, key: 2.7, from: [-0.45, 0.55, 1] },  // key light direction in camera space
    roughness: 1,           // matte, as Mol*'s default material
    fogStrength: 0.4,       // fog: [near, far] per slide, fading toward the background between them
    scale: 0.16,            // scene units per Å when a slide gives none (a whole protein across half a slide)
  };
  const merge = (a, b = {}) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? merge(a[k], v) : v;
    }
    return out;
  };
  const SAMPLES = 16;

  const VERTEX = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  // Occlusion: 1 where nothing covers the hemisphere over the surface, toward 0 in creases (red), and the same
  // over a wider hemisphere (green; Mol*'s default reaches 32 A, which is what shades a protein's far side).
  const OCCLUSION = `
    #include <packing>
    uniform sampler2D tDepth;
    uniform vec2 size;
    uniform float cameraNear, cameraFar;
    uniform mat4 projection, projectionInverse;
    uniform vec3 kernel[${SAMPLES}];
    uniform float radius, bias, wideRadius;
    varying vec2 vUv;

    vec3 at(vec2 uv) {
      vec4 v = projectionInverse * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).x * 2.0 - 1.0, 1.0);
      return v.xyz / v.w;
    }

    float occluded(vec3 p, mat3 basis, float radius) {
      float occ = 0.0;
      for (int i = 0; i < ${SAMPLES}; i++) {
        vec3 s = p + basis * kernel[i] * radius;
        vec4 c = projection * vec4(s, 1.0);
        vec2 uv = c.xy / c.w * 0.5 + 0.5;
        float d = texture2D(tDepth, uv).x;
        float z = d >= 1.0 ? -1e5 : perspectiveDepthToViewZ(d, cameraNear, cameraFar);
        occ += (z >= s.z + bias ? 1.0 : 0.0) * smoothstep(0.0, 1.0, radius / abs(p.z - z));
      }
      return 1.0 - occ / float(${SAMPLES});
    }

    void main() {
      if (texture2D(tDepth, vUv).x >= 1.0) { gl_FragColor = vec4(1.0); return; }
      vec2 t = 1.0 / size;
      vec3 p = at(vUv);
      // the normal, from whichever neighbour on each axis is on the same surface (closer in depth)
      vec3 x1 = at(vUv + vec2(t.x, 0.0)) - p, x0 = p - at(vUv - vec2(t.x, 0.0));
      vec3 y1 = at(vUv + vec2(0.0, t.y)) - p, y0 = p - at(vUv - vec2(0.0, t.y));
      vec3 n = normalize(cross(abs(x1.z) < abs(x0.z) ? x1 : x0, abs(y1.z) < abs(y0.z) ? y1 : y0));
      // the kernel turned by a 4 x 4 pixel pattern, which the final pass's 4 x 4 blur removes
      vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
      float a = (cell.x * 4.0 + cell.y) * 0.3926991 + cell.x * 0.7;
      vec3 r = vec3(cos(a), sin(a), 0.0);
      vec3 tx = normalize(r - n * dot(r, n));
      mat3 basis = mat3(tx, cross(n, tx), n);
      gl_FragColor = vec4(occluded(p, basis, radius), wideRadius > 0.0 ? occluded(p, basis, wideRadius) : 1.0, 1.0, 1.0);
    }`;

  const COMPOSITE = `
    #include <packing>
    uniform sampler2D tColor, tDepth, tOcclusion;
    uniform vec2 size;
    uniform float cameraNear, cameraFar;
    uniform float outlineWidth, outlineThreshold, outlineStrength;
    uniform vec3 outlineColor;
    uniform float aoStrength, wideStrength;
    uniform vec3 fogColor;
    uniform vec3 fog;               // near, far, strength
    varying vec2 vUv;

    // Distance from the camera, or far away for the background.
    float dist(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return d >= 0.999999 ? 1e5 : -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
    }

    void main() {
      vec4 c = texture2D(tColor, vUv);
      vec3 col = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
      float z = dist(vUv);
      vec2 t = 1.0 / size;

      if (c.a > 0.0) {
        // occlusion, blurred over 4 x 4 pixels, leaving out pixels on other surfaces
        vec2 sum = vec2(0.0);
        float weight = 0.0;
        for (int i = -2; i < 2; i++) for (int j = -2; j < 2; j++) {
          vec2 uv = vUv + vec2(float(i) + 0.5, float(j) + 0.5) * t;
          float w = 1.0 / (0.02 + abs(dist(uv) - z));
          sum += texture2D(tOcclusion, uv).xy * w;
          weight += w;
        }
        sum /= weight;
        col *= (1.0 - aoStrength * (1.0 - sum.x)) * (1.0 - wideStrength * (1.0 - sum.y));
        col = mix(col, fogColor, fog.z * smoothstep(fog.x, fog.y, z));
      }

      // Outline: how far (in pixels) the nearest clearly-closer surface is; drawn within outlineWidth of it,
      // with a one-pixel soft edge.
      float nearest = 1e3;
      for (int r = 1; r <= 6; r++) {
        float rad = float(r);
        if (rad > outlineWidth + 1.0) break;
        for (int k = 0; k < 8; k++) {
          float a = (float(k) + 0.5 * float(r)) * 0.7853982;
          if (z - dist(vUv + vec2(cos(a), sin(a)) * rad * t) > outlineThreshold) nearest = min(nearest, rad);
        }
      }
      float edge = clamp(outlineWidth + 0.5 - nearest, 0.0, 1.0) * outlineStrength;

      col = mix(c.a > 0.0 ? col : outlineColor, outlineColor, edge);
      gl_FragColor = vec4(col, max(c.a, edge));
      #include <colorspace_fragment>
      gl_FragColor.rgb *= gl_FragColor.a;   // the canvas wants premultiplied alpha
    }`;

  // Hemisphere samples (z up), more of them close in; fixed so every run looks the same.
  function hemisphere(THREE) {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: SAMPLES }, (_, i) => {
      const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 0.85 + 0.15).normalize();
      const s = (i + 1) / SAMPLES;
      return v.multiplyScalar(0.15 + 0.85 * s * s);
    });
  }

  function molstar(scene, options = {}) {
    const THREE = window.ManimWeb.THREE;
    const o = merge(molstar.look, options);
    const linear = (hex) => new THREE.Color(hex);  // THREE.Color keeps linear values

    // Mol*'s lighting: ambient plus one directional light from just above-left of the viewer.
    scene.lighting.removeAll();
    scene.lighting.addAmbient({ intensity: o.light.ambient });
    const key = scene.lighting.addDirectional({ intensity: o.light.key, position: [0, -1, 0] });
    const from = new THREE.Vector3(...o.light.from).normalize();

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType });
    target.texture.colorSpace = THREE.SRGBColorSpace;  // 8-bit sRGB storage: no banding in the darks
    target.depthTexture = new THREE.DepthTexture(1, 1);
    target.depthTexture.type = THREE.UnsignedIntType;
    const occlusion = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false });
    const shared = {
      tDepth: { value: target.depthTexture }, size: { value: new THREE.Vector2(1, 1) },
      cameraNear: { value: 0.1 }, cameraFar: { value: 1000 },
    };
    const pass = (fragmentShader, uniforms) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
        vertexShader: VERTEX, fragmentShader, uniforms: { ...shared, ...uniforms },
        depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      }));
      mesh.frustumCulled = false;
      const s = new THREE.Scene();
      s.add(mesh);
      return { scene: s, mesh, u: mesh.material.uniforms };
    };
    const ao = pass(OCCLUSION, {
      projection: { value: new THREE.Matrix4() }, projectionInverse: { value: new THREE.Matrix4() },
      kernel: { value: hemisphere(THREE) }, radius: { value: 0 }, bias: { value: 0 }, wideRadius: { value: 0 },
    });
    const composite = pass(COMPOSITE, {
      tColor: { value: target.texture }, tOcclusion: { value: occlusion.texture },
      outlineWidth: { value: o.outline.width }, outlineThreshold: { value: 0 },
      outlineStrength: { value: o.outline.strength },
      outlineColor: { value: linear(o.outline.color) }, aoStrength: { value: o.occlusion.strength },
      wideStrength: { value: o.occlusion.wide.strength },
      fogColor: { value: linear(window.Deck.palette.bg) },
      fog: { value: new THREE.Vector3(...(o.fog || [0, 1]), o.fog ? o.fogStrength : 0) },
    });
    // Å to scene units: everything measured in Å follows the slide's scale
    const setScale = (k) => {
      ao.u.radius.value = o.occlusion.radius * k;
      ao.u.bias.value = o.occlusion.bias * k;
      ao.u.wideRadius.value = o.occlusion.wide.radius * k;
      composite.u.outlineThreshold.value = o.outline.threshold * k;
    };
    setScale(o.scale);
    const flat = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const buffer = new THREE.Vector2();

    // ThreeDScene draws with renderer.render(scene, camera) directly (it skips manim-web's post-processing
    // hook), so wrap that call on this scene's renderer.
    const renderer = scene.renderer.getThreeRenderer();
    const draw = renderer.render.bind(renderer);
    renderer.render = (threeScene, camera) => {
      if (threeScene !== scene.threeScene || renderer.getRenderTarget() !== null) return draw(threeScene, camera);
      renderer.getDrawingBufferSize(buffer);
      if (target.width !== buffer.x || target.height !== buffer.y) {
        target.setSize(buffer.x, buffer.y);
        occlusion.setSize(buffer.x, buffer.y);
      }
      // the key light keeps its place beside the viewer however the camera turns
      camera.updateMatrixWorld();
      key.position.copy(from).transformDirection(camera.matrixWorld).multiplyScalar(50).add(camera.position);
      threeScene.traverse((m) => {  // new meshes (manim-web rebuilds bonds) get the same material
        const mat = m.material;
        if (mat && mat.isMeshStandardMaterial && mat.roughness !== o.roughness) mat.roughness = o.roughness;
      });
      shared.size.value.copy(buffer);
      shared.cameraNear.value = camera.near;
      shared.cameraFar.value = camera.far;
      ao.u.projection.value.copy(camera.projectionMatrix);
      ao.u.projectionInverse.value.copy(camera.projectionMatrixInverse);
      composite.u.outlineWidth.value = o.outline.width * renderer.getPixelRatio();
      renderer.setRenderTarget(target);
      renderer.clear();
      draw(threeScene, camera);
      renderer.setRenderTarget(occlusion);
      draw(ao.scene, flat);
      renderer.setRenderTarget(null);
      draw(composite.scene, flat);
    };
    const dispose = scene.dispose.bind(scene);
    scene.dispose = () => {
      target.depthTexture.dispose();
      target.dispose();
      occlusion.dispose();
      for (const p of [ao, composite]) { p.mesh.material.dispose(); p.mesh.geometry.dispose(); }
      dispose();
    };
    return { fog(near, far) { composite.u.fog.value.set(near, far, o.fogStrength); }, scale: setScale };
  }

  molstar.look = LOOK;
  molstar.configure = (changes) => { molstar.look = merge(molstar.look, changes); return molstar.look; };
  window.Deck.molstar = molstar;
})();
