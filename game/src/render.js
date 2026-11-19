// Neon Bay 3D — renderer: golden-hour sun, sunset sky dome, fog, shadows and the
// third-person follow camera (right-drag orbits, wheel zooms). World (x, y)
// maps to Three.js (x, 0, y); north (-y) is screen-up at yaw 0.
import * as THREE from '../vendor/three.min.js';
import { CONFIG } from './config.js';

export class Render3D {
  constructor(canvas) {
    this.canvas = canvas;
    // ?fast=1: low-cost rendering for scripted headless playthroughs
    // (half resolution, no shadows, no MSAA). Gameplay is identical; the
    // ?shot= screenshots always render at full quality.
    this.fast = new URLSearchParams(location.search).get('fast') === '1';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.fast });
    this.renderer.setPixelRatio(this.fast ? 0.5 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.fast;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene = new THREE.Scene();
    const C = CONFIG.colors;
    this.scene.fog = new THREE.Fog(C.fog, 700, 2800);
    this.camera = new THREE.PerspectiveCamera(55, 1, 1, 6000);
    // Hemisphere: warm sky bounce, dark ground.
    const hemi = new THREE.HemisphereLight(0xff9a5c, 0x3a2a3a, 1.0);
    this.scene.add(hemi);
    // Low golden sun from the west, casts the long shadows.
    this.sun = new THREE.DirectionalLight(C.sun, 2.4);
    this.sun.castShadow = !this.fast;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -480;
    this.sun.shadow.camera.right = 480;
    this.sun.shadow.camera.top = 480;
    this.sun.shadow.camera.bottom = -480;
    this.sun.shadow.camera.near = 50;
    this.sun.shadow.camera.far = 2600;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    // Sunset sky dome (gradient shader, follows the camera).
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(C.skyTop) },
        mid: { value: new THREE.Color(C.skyMid) },
        low: { value: new THREE.Color(C.skyLow) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
        void main(){ float h = normalize(vP).y; vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.65, h)) : mix(low, mid, smoothstep(-0.08, 0.18, h));
        gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(4200, 24, 16), skyMat);
    this.scene.add(this.sky);
    // Sun disc low in the west.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(150, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd28a, fog: false })
    );
    disc.position.set(-1500, 260, 1552);
    disc.lookAt(1800, 260, 1552);
    this.scene.add(disc);
    this.yaw = 0;
    this.pitch = 0.42;
    this.dist = 430;
    this.focus = { x: 488, y: 1360 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Follow `focus` (ground coords). Orbit with right-drag deltas, zoom with wheel.
  update(dt, focus, input) {
    if (input && input.mouse.rdown) {
      this.yaw -= input.mouse.dx * 0.004;
      this.pitch = Math.max(0.15, Math.min(1.1, this.pitch + input.mouse.dy * 0.003));
    }
    if (input && input.mouse.wheel) {
      this.dist = Math.max(230, Math.min(900, this.dist + input.mouse.wheel * 0.25));
    }
    this.focus = focus;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const cx = focus.x + Math.sin(this.yaw) * cp * this.dist;
    const cy = focus.y + Math.cos(this.yaw) * cp * this.dist;
    const ch = sp * this.dist + 10;
    this.camera.position.set(cx, ch, cy);
    this.camera.lookAt(focus.x, 4, focus.y);
    this.sky.position.set(this.camera.position.x, 0, this.camera.position.z);
    // Sun follows the focus so shadows stay crisp wherever the player is.
    this.sun.position.set(focus.x - 700, 430, focus.y + 320);
    this.sun.target.position.set(focus.x, 0, focus.y);
    this.sun.target.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
  }

  // Ground point (wx, wy) -> screen pixels (for aiming / screenshots).
  project(wx, wy, h = 2) {
    const v = new THREE.Vector3(wx, h, wy).project(this.camera);
    const w = this.canvas.clientWidth || window.innerWidth;
    const hh = this.canvas.clientHeight || window.innerHeight;
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * hh, behind: v.z > 1 };
  }
}
