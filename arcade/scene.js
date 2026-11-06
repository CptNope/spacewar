import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// This exhibit renders the *existing* PDP-1 emulator's canvas as a live 3D texture.
// Game mechanics, physics, graphics and keyboard mappings remain in spacewar.js.
const stage = document.getElementById("stage");
const mount = document.getElementById("scene");
const status = document.getElementById("status");
const error = document.getElementById("error");
const sourceCanvas = document.getElementById("swcanvas");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let renderer;
let controls;
let resizeObserver;
let animationStarted = false;

function showError(message) {
  status.textContent = "3D DISPLAY UNAVAILABLE";
  error.classList.add("visible");
  if (message) console.error("[Spacewar arcade]", message);
}

function makeLabel(text, subtitle) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 192;
  const x = c.getContext("2d");
  x.fillStyle = "#0b1921";
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = "#63c7cc";
  x.lineWidth = 6;
  x.strokeRect(5, 5, c.width - 10, c.height - 10);
  x.fillStyle = "#8ef5e9";
  x.textAlign = "center";
  x.font = "bold 84px monospace";
  x.fillText(text, c.width / 2, 105);
  x.font = "32px monospace";
  x.fillStyle = "#d7b77e";
  x.fillText(subtitle, c.width / 2, 156);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeStars(scene) {
  // Deterministic star positions. This is decoration, not a replacement game sky.
  let seed = 1962;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const coords = new Float32Array(500 * 3);
  for (let i = 0; i < 500; i++) {
    coords[i * 3] = (rand() - 0.5) * 38;
    coords[i * 3 + 1] = rand() * 19 - 1;
    coords[i * 3 + 2] = -4 - rand() * 16;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(coords, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0x92d9d8, size: 0.035, transparent: true, opacity: 0.72,
    sizeAttenuation: true, depthWrite: false
  }));
  scene.add(points);
  return points;
}

function buildMuseum(scene) {
  const charcoal = new THREE.MeshStandardMaterial({ color: 0x17252d, metalness: 0.6, roughness: 0.37 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x080f15, metalness: 0.42, roughness: 0.48 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x56727a, metalness: 0.83, roughness: 0.29 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xbda06b, metalness: 0.76, roughness: 0.35 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x6de6df });
  const floor = new THREE.MeshStandardMaterial({ color: 0x0b1921, metalness: 0.33, roughness: 0.6 });

  function box(parent, w, h, d, x, y, z, material, bevel) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floor);
  roomFloor.rotation.x = -Math.PI / 2;
  roomFloor.position.y = -0.08;
  roomFloor.receiveShadow = true;
  scene.add(roomFloor);
  const grid = new THREE.GridHelper(30, 30, 0x245463, 0x142e3a);
  grid.position.y = -0.07;
  grid.material.transparent = true;
  grid.material.opacity = 0.28;
  scene.add(grid);

  const cabinet = new THREE.Group();
  scene.add(cabinet);

  // Pedestal and housing are a stylised museum arcade display, not a
  // historical representation of the original PDP-1 hardware.
  box(cabinet, 3.15, 0.22, 1.85, 0, 0.09, 0.12, trim);
  box(cabinet, 2.75, 0.42, 1.53, 0, 0.40, 0.03, charcoal);
  box(cabinet, 3.42, 3.18, 1.35, 0, 2.12, 0, charcoal);
  box(cabinet, 3.2, 2.97, 0.04, 0, 2.13, 0.697, graphite);
  box(cabinet, 3.32, 0.09, 1.41, 0, 3.74, 0, trim);
  box(cabinet, 3.35, 0.08, 1.45, 0, 0.55, 0, trim);

  // Original 550 x 550 game canvas mapped directly to a circular CRT.
  const screenTexture = new THREE.CanvasTexture(sourceCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.minFilter = THREE.LinearFilter;
  screenTexture.magFilter = THREE.LinearFilter;
  screenTexture.generateMipmaps = false;

  const screenCenter = new THREE.Vector3(0, 2.12, 0.76);
  const backing = new THREE.Mesh(
    new THREE.CircleGeometry(1.18, 96),
    new THREE.MeshBasicMaterial({ color: 0x01090c })
  );
  backing.position.copy(screenCenter);
  cabinet.add(backing);

  const screen = new THREE.Mesh(
    new THREE.CircleGeometry(1.12, 96),
    new THREE.MeshBasicMaterial({
      map: screenTexture, transparent: true, toneMapped: false,
      depthWrite: false, side: THREE.DoubleSide
    })
  );
  screen.position.copy(screenCenter);
  screen.position.z += 0.012;
  cabinet.add(screen);

  const rims = [
    { radius: 1.14, tube: 0.068, z: 0.79, material: trim },
    { radius: 1.22, tube: 0.065, z: 0.78, material: graphite },
    { radius: 1.30, tube: 0.025, z: 0.75, material: brass }
  ];
  for (const rim of rims) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rim.radius, rim.tube, 12, 110), rim.material);
    ring.position.set(0, screenCenter.y, rim.z);
    cabinet.add(ring);
  }

  const marquee = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.49),
    new THREE.MeshBasicMaterial({ map: makeLabel("SPACEWAR!", "1962  ·  PDP-1"), toneMapped: false })
  );
  marquee.position.set(0, 3.47, 0.738);
  cabinet.add(marquee);

  // Console surface, two banks of ornamental controls.
  const console = box(cabinet, 3.12, 0.22, 0.95, 0, 0.77, 0.97, charcoal);
  console.rotation.x = -0.27;
  for (const side of [-1, 1]) {
    for (let j = 0; j < 4; j++) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.065, 20), j === 3 ? brass : trim);
      cap.rotation.x = Math.PI / 2 - 0.27;
      cap.position.set(side * (0.76 + (j % 2) * 0.29), 0.91 - Math.floor(j / 2) * 0.13, 1.36 - Math.floor(j / 2) * 0.06);
      cabinet.add(cap);
    }
  }
  box(cabinet, 3.17, 0.052, 0.05, 0, 1.14, 0.754, glow);

  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 0.3), new THREE.MeshBasicMaterial({
    map: makeLabel("ORIGINAL", "PDP-1 GAME RUNNING"), toneMapped: false
  }));
  plaque.position.set(0, 0.37, 0.81);
  cabinet.add(plaque);

  // Flanking light bars and museum backdrop.
  for (const side of [-1, 1]) {
    box(scene, 0.16, 3.1, 0.22, side * 4.3, 1.62, -2.2, trim);
    box(scene, 0.055, 2.7, 0.25, side * 4.3, 1.62, -2.05, glow);
    const light = new THREE.PointLight(0x4bd4d5, 11, 7);
    light.position.set(side * 3.8, 2.2, -0.3);
    scene.add(light);
  }

  return { screenTexture, cabinet };
}

function bindTouchControls() {
  const active = new Map();
  const update = (button) => {
    const bit = Number(button.dataset.bit);
    const down = [...active.values()].some((value) => value === button);
    button.classList.toggle("down", down);
    if (typeof window.control !== "number") return;
    if (down) window.control |= bit;
    else window.control &= ~bit;
  };
  document.querySelectorAll(".pad button").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      active.set(event.pointerId, button);
      update(button);
    });
    const release = (event) => {
      if (active.get(event.pointerId) !== button) return;
      active.delete(event.pointerId);
      update(button);
    };
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
  });
  window.addEventListener("blur", () => {
    for (const button of new Set(active.values())) {
      const bit = Number(button.dataset.bit);
      if (typeof window.control === "number") window.control &= ~bit;
      button.classList.remove("down");
    }
    active.clear();
  });
}

function boot() {
  try {
    if (!sourceCanvas || typeof window.setup !== "function" || !window.memory) {
      throw new Error("The original emulator scripts are missing.");
    }
    // Preserve the unmodified 1962 game emulator for controls and simulation.
    window.setup();
    bindTouchControls();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030b11);
    scene.fog = new THREE.FogExp2(0x030b11, 0.035);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
    camera.position.set(0, 2.35, 8.2);
    scene.add(new THREE.HemisphereLight(0x9ec5d2, 0x13202e, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffe3b1, 3);
    keyLight.position.set(-4, 7, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x73d6ef, 1.4);
    fillLight.position.set(5, 3, 4);
    scene.add(fillLight);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const stars = makeStars(scene);
    const exhibit = buildMuseum(scene);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.9, 0);
    controls.enablePan = false;
    controls.enableDamping = !reduceMotion;
    controls.dampingFactor = 0.065;
    controls.enableZoom = true;
    controls.minDistance = 5.4;
    controls.maxDistance = 10.8;
    controls.minAzimuthAngle = -0.48;
    controls.maxAzimuthAngle = 0.48;
    controls.minPolarAngle = Math.PI / 2 - 0.2;
    controls.maxPolarAngle = Math.PI / 2 + 0.18;
    controls.update();

    const resize = () => {
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      camera.aspect = w / h;
      camera.fov = w < 600 ? 48 : 43;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    let lastTexture = 0;
    const animate = (time) => {
      if (document.hidden) return;
      controls.update();
      if (time - lastTexture > 25) {
        exhibit.screenTexture.needsUpdate = true;
        lastTexture = time;
      }
      if (!reduceMotion) stars.rotation.y = Math.sin(time * 0.000025) * 0.02;
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);
    animationStarted = true;
    status.textContent = "PDP-1 ONLINE · 2 PLAYER";

    document.getElementById("reset").addEventListener("click", () => location.reload());
    document.getElementById("fullscreen").addEventListener("click", async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (stage.requestFullscreen) await stage.requestFullscreen();
      } catch (err) { console.warn("Fullscreen unavailable:", err); }
    });
    document.addEventListener("keydown", (event) => {
      if (/^[wasdijkl]$/i.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
      }
    }, { capture: true });

    window.addEventListener("beforeunload", () => {
      if (animationStarted && renderer) renderer.setAnimationLoop(null);
      if (resizeObserver) resizeObserver.disconnect();
      if (controls) controls.dispose();
      if (typeof window.timer !== "undefined") clearInterval(window.timer);
    });
  } catch (err) {
    showError(err);
  }
}

if (document.readyState === "complete") boot();
else window.addEventListener("load", boot, { once: true });
