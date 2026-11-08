import * as THREE from "three";

// A decorative scene only: participant data never enters canvas textures.
export function mountScene(host) {
  let renderer;
  const resources = new Set();
  const track = (value) => {
    resources.add(value);
    return value;
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 0, 8.5);
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    return () => {};
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.append(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7c809c, 2.5));
  const key = new THREE.DirectionalLight(0xfff6df, 4.5);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc5d8ff, 3);
  rim.position.set(4, 1, 3);
  scene.add(rim);
  const root = new THREE.Group();
  scene.add(root);
  const mesh = (geometry, material, parent = root) => {
    const object = new THREE.Mesh(track(geometry), material);
    parent.add(object);
    return object;
  };
  const gold = track(
    new THREE.MeshStandardMaterial({
      color: 0xd6a54b,
      metalness: 0.78,
      roughness: 0.27,
    }),
  );
  const edgeGold = track(
    new THREE.MeshStandardMaterial({
      color: 0xf8d58b,
      metalness: 0.65,
      roughness: 0.3,
    }),
  );
  const paper = track(
    new THREE.MeshStandardMaterial({ color: 0xfffdf5, roughness: 0.85 }),
  );
  const navy = track(
    new THREE.MeshStandardMaterial({
      color: 0x284b80,
      roughness: 0.45,
      metalness: 0.15,
    }),
  );
  const medal = new THREE.Group();
  root.add(medal);
  medal.position.set(0.85, 0.36, 0.55);
  medal.rotation.set(0.12, -0.38, -0.16);
  const disk = mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 0.14, 80),
    gold,
    medal,
  );
  disk.rotation.x = Math.PI / 2;
  for (const radius of [0.81, 0.73]) {
    const ring = mesh(
      new THREE.TorusGeometry(radius, 0.016, 8, 80),
      edgeGold,
      medal,
    );
    ring.position.z = 0.085;
  }
  const texture = (width, height, draw) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d"));
    const value = track(new THREE.CanvasTexture(canvas));
    value.colorSpace = THREE.SRGBColorSpace;
    return value;
  };
  const emblem = texture(512, 512, (ctx) => {
    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = "#fbe6ac";
    ctx.strokeStyle = "#fbe6ac";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5,
        r = i % 2 ? 35 : 74;
      const x = 256 + Math.cos(angle) * r,
        y = 170 + Math.sin(angle) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.font = "bold 100px Arial";
    ctx.textAlign = "center";
    ctx.fillText("ГТО", 256, 330);
    ctx.font = "18px Arial";
    ctx.fillText("КАЖДОЕ ДОСТИЖЕНИЕ ВАЖНО", 256, 382);
  });
  const front = mesh(
    new THREE.PlaneGeometry(1.52, 1.52),
    track(
      new THREE.MeshBasicMaterial({
        map: emblem,
        transparent: true,
        depthWrite: false,
      }),
    ),
    medal,
  );
  front.position.z = 0.09;
  for (const [x, rotation] of [
    [-0.35, -0.25],
    [0.35, 0.25],
  ]) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.2, 0.1);
    shape.lineTo(0.2, 0.1);
    shape.lineTo(0.25, -1);
    shape.lineTo(0, -0.83);
    shape.lineTo(-0.25, -1);
    shape.closePath();
    const ribbon = mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.035,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.012,
        bevelThickness: 0.012,
      }),
      navy,
      medal,
    );
    ribbon.position.set(x, -0.55, -0.09);
    ribbon.rotation.z = rotation;
  }
  const booklet = new THREE.Group();
  root.add(booklet);
  booklet.position.set(-0.47, -0.54, -0.25);
  booklet.rotation.set(-0.15, 0.18, -0.12);
  const cover = mesh(new THREE.BoxGeometry(3.25, 2.32, 0.08), navy, booklet);
  const pages = mesh(new THREE.BoxGeometry(3.18, 2.25, 0.06), paper, booklet);
  pages.position.z = 0.07;
  const printTexture = texture(1200, 850, (ctx) => {
    ctx.fillStyle = "#fffdf5";
    ctx.fillRect(0, 0, 1200, 850);
    ctx.fillStyle = "#f6f2e7";
    ctx.fillRect(0, 0, 595, 850);
    ctx.fillStyle = "#d6c495";
    ctx.fillRect(597, 0, 2, 850);
    ctx.textAlign = "center";
    ctx.fillStyle = "#b7a26d";
    ctx.font = "italic 105px Georgia";
    ctx.fillText("ГТО", 300, 420);
    ctx.font = "16px Arial";
    ctx.fillText("ГОТОВ К ТРУДУ И ОБОРОНЕ", 300, 475);
    ctx.fillStyle = "#5e655e";
    ctx.font = "bold 18px Georgia";
    ctx.fillText("РОССИЙСКАЯ ФЕДЕРАЦИЯ", 900, 110);
    ctx.font = "bold 32px Georgia";
    ctx.fillText("УДОСТОВЕРЕНИЕ", 900, 220);
    ctx.fillStyle = "#b4a27c";
    ctx.font = "16px Arial";
    ctx.fillText("ДОСТИЖЕНИЕ, КОТОРЫМ ГОРДЯТСЯ", 900, 270);
    ctx.strokeStyle = "#c5b99a";
    ctx.lineWidth = 1.5;
    for (const y of [390, 460, 530]) {
      ctx.beginPath();
      ctx.moveTo(690, y);
      ctx.lineTo(1110, y);
      ctx.stroke();
    }
    ctx.font = "bold 18px Georgia";
    ctx.fillStyle = "#7c7866";
    ctx.fillText("ЗНАК ОТЛИЧИЯ ГТО", 900, 640);
    ctx.font = "16px Georgia";
    ctx.fillText("М.П.", 790, 760);
    ctx.fillText("20__ г.", 1030, 760);
  });
  const printed = mesh(
    new THREE.PlaneGeometry(3.17, 2.24),
    track(
      new THREE.MeshBasicMaterial({ map: printTexture, toneMapped: false }),
    ),
    booklet,
  );
  printed.position.z = 0.105;

  let raf = 0,
    visible = false,
    dead = false,
    pointerX = 0,
    pointerY = 0;
  let lastFrame = 0;
  const render = (time) => {
    if (dead || !visible || document.hidden) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(render);
    if (time - lastFrame < 32) return; // Decorative scene is capped at 30 FPS.
    lastFrame = time;
    root.rotation.y += (pointerX * 0.13 - root.rotation.y) * 0.06;
    root.rotation.x += (-pointerY * 0.08 - root.rotation.x) * 0.06;
    medal.position.y = 0.36 + Math.sin(time * 0.0007) * 0.055;
    renderer.render(scene, camera);
  };
  const start = () => {
    if (!raf && visible && !dead && !document.hidden)
      raf = requestAnimationFrame(render);
  };
  const resize = new ResizeObserver(() => {
    if (dead) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    start();
  });
  resize.observe(host);
  const visibility = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    start();
  });
  visibility.observe(host);
  const pointer = (event) => {
    const r = host.getBoundingClientRect();
    pointerX = ((event.clientX - r.left) / r.width - 0.5) * 2;
    pointerY = ((event.clientY - r.top) / r.height - 0.5) * 2;
  };
  const leave = () => {
    pointerX = pointerY = 0;
  };
  host.addEventListener("pointermove", pointer);
  host.addEventListener("pointerleave", leave);
  document.addEventListener("visibilitychange", start);
  const dispose = () => {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    resize.disconnect();
    visibility.disconnect();
    host.removeEventListener("pointermove", pointer);
    host.removeEventListener("pointerleave", leave);
    document.removeEventListener("visibilitychange", start);
    for (const resource of resources) resource.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    host.closest(".hero-art").classList.remove("scene-ready");
  };
  renderer.domElement.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      dispose();
    },
    { once: true },
  );
  try {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    host.closest(".hero-art").classList.add("scene-ready");
  } catch {
    dispose();
  }
  return dispose;
}
