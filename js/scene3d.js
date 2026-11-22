/**
 * scene3d.js — Studio-Grade Three.js WebGL 3D FC-TCR Substation Digital Twin
 * Upgrades:
 *  - Procedural PMREM Studio Softbox IBL Environment (realistic copper, steel, porcelain PBR)
 *  - Custom GLSL Shader Animated Luminous 3D Power-Flow Conduits (Active P, Local Q, Grid Overload Q)
 *  - High-detail CAD assemblies: Corrugated 1 MVA Xfmr, Ribbed Porcelain Insulators, Overhead Portal
 *    Gantry, EKON Delta Cap Bank with Δ busbars, Air-Core Helical Copper TCR Coils on Standoffs,
 *    Heatsinked Thyristor Valve Towers, Spinning 20 HP Motor + RL Bank, Live SCADA HMI Cabinet + Beacon
 *  - Crisp HTML-projected clickable 3D callout pins (zero overlapping pixelated sprites!)
 *  - Infinite studio horizon fog + soft shadows + 10-theme light/dark glass harmony (100% offline)
 */
(function () {
  "use strict";

  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    const g = (v, fb) => (s.getPropertyValue(v) || "").trim() || fb;
    const isLight =
      document.documentElement.getAttribute("data-mode") === "light";
    return {
      isLight,
      bg: g("--bg", "#090B12"),
      surf: g("--surf", "#131726"),
      p: g("--p", "#2563EB"),
      s: g("--s", "#0D9488"),
      ok: g("--ok", "#10B981"),
      err: g("--err", "#E11D48"),
      cap: g("--cap", "#0284C7"),
      svc: g("--svc", "#D97706"),
      sc: g("--sc", "#EA580C"),
    };
  }

  /** Build a 100% offline procedural Studio Softbox IBL environment map via PMREMGenerator */
  function buildStudioEnvMap(THREE, renderer, isLight) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(isLight ? 0xe8eef6 : 0x0b1020);

    // Overhead main softbox
    const soft1 = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshBasicMaterial({
        color: isLight ? 0xffffff : 0xdbeafe,
        side: THREE.DoubleSide,
      }),
    );
    soft1.position.set(0, 10, 0);
    soft1.rotation.x = Math.PI / 2;
    envScene.add(soft1);

    // Cool cyan studio rim panel (left)
    const soft2 = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 8),
      new THREE.MeshBasicMaterial({
        color: isLight ? 0xbae6fd : 0x38bdf8,
        side: THREE.DoubleSide,
      }),
    );
    soft2.position.set(-12, 4, 2);
    soft2.rotation.y = Math.PI / 2;
    envScene.add(soft2);

    // Warm golden key reflection strip (right)
    const soft3 = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 8),
      new THREE.MeshBasicMaterial({
        color: isLight ? 0xfef3c7 : 0xfbbf24,
        side: THREE.DoubleSide,
      }),
    );
    soft3.position.set(12, 4, 3);
    soft3.rotation.y = -Math.PI / 2;
    envScene.add(soft3);

    // Subtle floor bounce
    const bounce = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshBasicMaterial({
        color: isLight ? 0xcbd5e1 : 0x1e293b,
        side: THREE.DoubleSide,
      }),
    );
    bounce.position.set(0, -6, 0);
    bounce.rotation.x = -Math.PI / 2;
    envScene.add(bounce);

    const rt = pmrem.fromScene(envScene, 0.04);
    pmrem.dispose();
    return rt;
  }

  /** Procedural Concrete Substation Pad Texture with Exact CAD-Aligned Equipment Bay Markings */
  function buildPadTexture(THREE, isLight) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 640;
    const g = c.getContext("2d");

    // Concrete base
    g.fillStyle = isLight ? "#E2E8F0" : "#182032";
    g.fillRect(0, 0, 1024, 640);

    // Subtle concrete aggregate grain
    for (let i = 0; i < 3200; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 640;
      g.fillStyle = isLight
        ? `rgba(15, 23, 42, ${(Math.random() * 0.032).toFixed(3)})`
        : `rgba(255, 255, 255, ${(Math.random() * 0.024).toFixed(3)})`;
      g.fillRect(x, y, 2, 2);
    }

    // Expansion joint concrete slab lines
    g.strokeStyle = isLight
      ? "rgba(15, 23, 42, 0.075)"
      : "rgba(148, 163, 184, 0.09)";
    g.lineWidth = 2;
    for (let x = 128; x < 1024; x += 128) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 640);
      g.stroke();
    }
    for (let y = 128; y < 640; y += 128) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(1024, y);
      g.stroke();
    }

    // Crisp industrial safety perimeter border
    g.strokeStyle = isLight
      ? "rgba(217, 119, 6, 0.55)"
      : "rgba(251, 191, 36, 0.45)";
    g.lineWidth = 5;
    g.setLineDash([18, 10]);
    g.strokeRect(26, 26, 972, 588);
    g.setLineDash([]);

    // Exact CAD-aligned equipment bay outlines matching 3D plinth positions
    const bays = [
      { x: 62, y: 115, w: 200, h: 180, col: "#0284C7", lbl: "1 MVA XFMR BAY" },
      {
        x: 748,
        y: 94,
        w: 212,
        h: 192,
        col: "#EA580C",
        lbl: "20 HP MOTOR + RL",
      },
      { x: 260, y: 392, w: 206, h: 126, col: "#0EA5E9", lbl: "DELTA FC BANK" },
      {
        x: 469,
        y: 364,
        w: 280,
        h: 182,
        col: "#D97706",
        lbl: "DELTA TCR & VALVES",
      },
      { x: 793, y: 403, w: 124, h: 104, col: "#10B981", lbl: "PI SCADA" },
    ];
    bays.forEach((b) => {
      g.fillStyle = isLight ? "rgba(255,255,255,0.48)" : "rgba(15,23,42,0.48)";
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = b.col;
      g.globalAlpha = 0.55;
      g.lineWidth = 3;
      g.strokeRect(b.x, b.y, b.w, b.h);
      g.globalAlpha = 0.78;
      g.fillStyle = isLight ? "#334155" : "#94A3B8";
      g.font = "800 15px 'JetBrains Mono', monospace";
      g.textAlign = "center";
      g.fillText(b.lbl, b.x + b.w / 2, b.y + b.h + 21);
      g.globalAlpha = 1;
    });

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  /** Custom GLSL Shader for Seamless Animated Glowing 3D Power Flow Conduits */
  function createEnergyFlowShader(THREE, hexColor, speed, pulseCount) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(hexColor) },
        uSpeed: { value: speed || 2.4 },
        uCount: { value: pulseCount || 10.0 },
        uOpacity: { value: 0.92 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uSpeed;
        uniform float uCount;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float wave = fract(vUv.x * uCount - uTime * uSpeed);
          // Seamless directional energy comet pulse (crisp luminous head, silky fading wake)
          float head = smoothstep(0.62, 0.94, wave) * (1.0 - smoothstep(0.94, 1.0, wave));
          float tail = smoothstep(0.08, 0.92, wave) * 0.42;
          float core = 0.86 + 0.14 * cos(vUv.y * 6.28318);
          float alpha = clamp((head * 1.2 + tail + 0.12) * core, 0.10, 1.0) * uOpacity;
          vec3 col = mix(uColor, vec3(1.0), head * 0.58);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /** Build ribbed ceramic high-voltage insulator mesh (stacked porcelain sheds) */
  function createPorcelainBushing(THREE, height, radius, mat) {
    const grp = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.55, radius * 0.68, height, 14),
      mat,
    );
    core.position.y = height / 2;
    grp.add(core);
    const sheds = Math.max(3, Math.round(height * 5));
    for (let i = 0; i < sheds; i++) {
      const shed = new THREE.Mesh(
        new THREE.CylinderGeometry(
          radius * 0.72,
          radius * 1.15,
          height / (sheds * 2.1),
          16,
        ),
        mat,
      );
      shed.position.y = (i + 0.6) * (height / sheds);
      grp.add(shed);
    }
    return grp;
  }

  function initSVCSubstation3D() {
    const root = document.getElementById("widget-svc-3d");
    if (!root || typeof window.THREE === "undefined") return;
    const THREE = window.THREE;

    root.innerHTML =
      '<div class="twin3d-shell">' +
      '  <div class="twin3d-stage" id="twin3d-canvas-wrap">' +
      '    <div class="twin3d-hud-top">' +
      '      <div class="twin3d-cam-bar">' +
      '        <button class="w-pill active" data-cam="overview">Overview</button>' +
      '        <button class="w-pill" data-cam="xfmr">1 MVA Xfmr</button>' +
      '        <button class="w-pill" data-cam="cap">Δ Cap Bank</button>' +
      '        <button class="w-pill" data-cam="tcr">Δ TCR &amp; Valves</button>' +
      '        <button class="w-pill" data-cam="motor">20 HP Motor</button>' +
      '        <button class="w-pill" data-cam="scada">PI Cabinet</button>' +
      "      </div>" +
      '      <div style="display:flex;gap:6px;align-items:center;pointer-events:auto;">' +
      '        <button class="twin3d-tool-btn active" id="t3d-labels-btn" title="Toggle 3D callout pins">Labels</button>' +
      '        <button class="twin3d-tool-btn active" id="t3d-orbit-btn" title="Pause / Resume gentle turntable">Auto-Orbit</button>' +
      '        <span class="twin3d-drag-hint">Drag 360° · Scroll Zoom</span>' +
      "      </div>" +
      "    </div>" +
      '    <div class="twin3d-pins-layer" id="t3d-pins-layer"></div>' +
      '    <div class="twin3d-legend">' +
      '      <span><i style="background:#10B981;"></i>Active Power P (Grid → Load)</span>' +
      '      <span><i style="background:#0EA5E9;"></i>Local Q_SVC Loop (FC-TCR ↔ Motor)</span>' +
      '      <span><i style="background:#F43F5E;"></i>Uncompensated Grid Q Burden</span>' +
      "    </div>" +
      '    <div class="twin3d-telemetry">' +
      '      <div class="t3d-stat"><span>Grid PF</span><strong id="t3d-pf" style="color:var(--ok);">1.0000 Unity</strong></div>' +
      '      <div class="t3d-stat"><span>Feeder I_L</span><strong id="t3d-il">9.02 A</strong></div>' +
      '      <div class="t3d-stat"><span>Grid Q</span><strong id="t3d-q">−4.3 VAR</strong></div>' +
      '      <div class="t3d-stat"><span>TCR α</span><strong id="t3d-a" style="color:var(--svc);">130.09°</strong></div>' +
      "    </div>" +
      "  </div>" +
      '  <div class="twin3d-controls">' +
      '    <div class="twin3d-mode-btns">' +
      '      <button class="sb-preset-btn active" data-m3d="case1">Auto PI · Motor ON (PF=1.00)</button>' +
      '      <button class="sb-preset-btn" data-m3d="case2">Auto PI · Motor OFF (α=103.8°)</button>' +
      '      <button class="sb-preset-btn danger" data-m3d="uncomp">SVC OFF · Uncomp (PF=0.44!)</button>' +
      '      <button class="sb-preset-btn" data-m3d="cancel">Manual α=90° (Full Cancel)</button>' +
      "    </div>" +
      '    <div class="twin3d-alpha-bar">' +
      '      <span class="mono" style="font-size:0.78rem;font-weight:800;color:var(--mut);white-space:nowrap;">Live Firing α:</span>' +
      '      <input type="range" id="t3d-alpha-slider" min="90" max="180" step="0.5" value="130.1" style="flex:1;accent-color:var(--svc);cursor:pointer;">' +
      '      <span class="mono" id="t3d-alpha-read" style="font-size:0.8rem;font-weight:800;color:var(--svc);min-width:56px;text-align:right;">130.1°</span>' +
      "    </div>" +
      "  </div>" +
      "</div>";

    const wrap = root.querySelector("#twin3d-canvas-wrap");
    const pinsLayer = root.querySelector("#t3d-pins-layer");
    const labelsBtn = root.querySelector("#t3d-labels-btn");
    const orbitBtn = root.querySelector("#t3d-orbit-btn");
    const elPF = root.querySelector("#t3d-pf");
    const elIL = root.querySelector("#t3d-il");
    const elQ = root.querySelector("#t3d-q");
    const elA = root.querySelector("#t3d-a");
    const alphaSlider = root.querySelector("#t3d-alpha-slider");
    const alphaRead = root.querySelector("#t3d-alpha-read");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 140);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;";
    wrap.insertBefore(renderer.domElement, wrap.firstChild);

    // ─── STUDIO PBR LIGHTING + PROCEDURAL IBL ───
    const hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x334155, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
    keyLight.position.set(12, 18, 13);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 48;
    keyLight.shadow.camera.left = -15;
    keyLight.shadow.camera.right = 15;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -12;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.55);
    fillLight.position.set(-14, 9, -8);
    scene.add(fillLight);

    const tcrPointLight = new THREE.PointLight(0xfbbf24, 1.5, 9);
    tcrPointLight.position.set(1.6, 2.0, 2.8);
    scene.add(tcrPointLight);

    // Infinite Studio Ground + Soft Shadow Catcher + Textured Concrete Substation Plinth
    const infinityPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140),
      new THREE.MeshStandardMaterial({
        color: 0xeaf0f8,
        roughness: 0.92,
        metalness: 0.04,
      }),
    );
    infinityPlane.rotation.x = -Math.PI / 2;
    infinityPlane.position.y = -0.34;
    infinityPlane.receiveShadow = true;
    scene.add(infinityPlane);

    const floorGrid = new THREE.GridHelper(64, 48, 0x94a3b8, 0xcbd5e1);
    floorGrid.position.set(0, -0.32, 0.4);
    floorGrid.material.transparent = true;
    floorGrid.material.opacity = 0.28;
    scene.add(floorGrid);

    const padSideMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.75,
      metalness: 0.2,
    });
    const padTopMat = new THREE.MeshStandardMaterial({
      roughness: 0.78,
      metalness: 0.08,
    });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(19.6, 0.34, 11.4), [
      padSideMat,
      padSideMat,
      padTopMat,
      padSideMat,
      padSideMat,
      padSideMat,
    ]);
    pad.position.set(0, -0.17, 0.45);
    pad.receiveShadow = true;
    pad.castShadow = true;
    scene.add(pad);

    // ─── REFINED METALLIC PBR MATERIALS (Take full advantage of PMREM IBL!) ───
    const steelFrame = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.34,
      metalness: 0.82,
    });
    const galvSteel = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.28,
      metalness: 0.86,
    });
    const darkAnodized = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.38,
      metalness: 0.75,
    });
    const brushedCopper = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.22,
      metalness: 0.94,
    });
    const shinyPorcelain = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.14,
      metalness: 0.08,
    });
    const insulatorBrown = new THREE.MeshStandardMaterial({
      color: 0x7c2d12,
      roughness: 0.18,
      metalness: 0.12,
    });
    const xfmrTankMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.38,
      metalness: 0.68,
      emissive: 0xef4444,
      emissiveIntensity: 0.0,
    });
    const capCanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.22,
      metalness: 0.65,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.18,
    });
    const motorPaintMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.28,
      metalness: 0.62,
    });
    const coilFluxMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.2,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.72,
    });
    const valveShieldMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: 0.34,
      clearcoat: 1.0,
    });
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });

    // ─── 1. 1 MVA 11 kV / 400 V OIL-COOLED TRANSFORMER (x = -6.7, z = -1.6) ───
    const xfmrGroup = new THREE.Group();
    xfmrGroup.position.set(-6.7, 0, -1.6);
    const xBase = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.2, 2.5),
      darkAnodized,
    );
    xBase.position.y = 0.1;
    xfmrGroup.add(xBase);
    const xTank = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.25, 1.85),
      xfmrTankMat,
    );
    xTank.position.y = 1.32;
    xTank.castShadow = true;
    xTank.receiveShadow = true;
    xfmrGroup.add(xTank);
    // Top bolted lid
    const xLid = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.12, 2.0),
      steelFrame,
    );
    xLid.position.y = 2.48;
    xfmrGroup.add(xLid);
    // Corrugated cooling radiator fin banks on front & back
    for (let f = -0.95; f <= 0.96; f += 0.24) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 1.85, 2.48),
        steelFrame,
      );
      fin.position.set(f, 1.32, 0);
      fin.castShadow = true;
      xfmrGroup.add(fin);
    }
    // Oil Conservator Cylinder + Support Brackets
    const conserv = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 1.9, 20),
      galvSteel,
    );
    conserv.rotation.z = Math.PI / 2;
    conserv.position.set(0, 3.02, -0.52);
    conserv.castShadow = true;
    xfmrGroup.add(conserv);
    [-0.6, 0.6].forEach((sx) => {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.55, 0.08),
        steelFrame,
      );
      leg.position.set(sx, 2.74, -0.52);
      xfmrGroup.add(leg);
    });
    // Buchholz oil feed gooseneck pipe + silver rating nameplate
    const oilPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.72, 10),
      galvSteel,
    );
    oilPipe.position.set(0.28, 2.66, -0.22);
    oilPipe.rotation.x = 0.58;
    xfmrGroup.add(oilPipe);
    const xPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.42, 0.04),
      galvSteel,
    );
    xPlate.position.set(0, 1.55, 0.94);
    xfmrGroup.add(xPlate);
    // 3 Ribbed Brown Porcelain 11 kV HV Bushings (back-top) + 3 White LV Bushings (front-top)
    [-0.72, 0, 0.72].forEach((bx) => {
      const hvBush = createPorcelainBushing(THREE, 1.05, 0.13, insulatorBrown);
      hvBush.position.set(bx, 2.52, 0.42);
      xfmrGroup.add(hvBush);
      const lvTerm = createPorcelainBushing(THREE, 0.45, 0.09, shinyPorcelain);
      lvTerm.position.set(1.22, 2.48, bx * 0.58);
      lvTerm.rotation.z = -Math.PI / 2;
      xfmrGroup.add(lvTerm);
    });
    // Pulsing thermal overload halo around transformer (visible only when SVC OFF!)
    const xfmrWarnRing = new THREE.Mesh(
      new THREE.RingGeometry(1.75, 2.08, 40),
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      }),
    );
    xfmrWarnRing.rotation.x = -Math.PI / 2;
    xfmrWarnRing.position.set(0, 0.03, 0);
    xfmrGroup.add(xfmrWarnRing);
    scene.add(xfmrGroup);

    // ─── 2. 400 V OVERHEAD 3-PHASE PORTAL GANTRY & COPPER BUSBARS ───
    const phaseColors = [0xef4444, 0xf59e0b, 0x3b82f6]; // L1/L2/L3 phase identification rings
    [-0.45, 0, 0.45].forEach((zOff, pIdx) => {
      const bus = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 12.2, 14),
        brushedCopper,
      );
      bus.rotation.z = Math.PI / 2;
      bus.position.set(0.15, 2.95, -1.6 + zOff);
      bus.castShadow = true;
      scene.add(bus);
      // Colored phase band collar at PCC midpoint
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.072, 0.18, 12),
        new THREE.MeshStandardMaterial({
          color: phaseColors[pIdx],
          roughness: 0.4,
        }),
      );
      band.rotation.z = Math.PI / 2;
      band.position.set(-2.6, 2.95, -1.6 + zOff);
      scene.add(band);
    });
    // Steel H-frame Gantry Portals with Ribbed Pin Insulators
    [-3.6, 0.4, 4.1].forEach((gx) => {
      [-2.35, -0.85].forEach((gz) => {
        const col = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 3.05, 0.14),
          galvSteel,
        );
        col.position.set(gx, 1.52, gz);
        col.castShadow = true;
        scene.add(col);
      });
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 1.7),
        galvSteel,
      );
      beam.position.set(gx, 2.66, -1.6);
      scene.add(beam);
      [-0.45, 0, 0.45].forEach((zOff) => {
        const ins = createPorcelainBushing(THREE, 0.28, 0.065, shinyPorcelain);
        ins.position.set(gx, 2.68, -1.6 + zOff);
        scene.add(ins);
      });
    });
    // Overhead Shunt Tap Feeder extending cleanly from PCC Bus to SVC Shunt Distribution Header
    [-0.45, 0, 0.45].forEach((xOff) => {
      const tap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 3.85, 10),
        brushedCopper,
      );
      tap.rotation.x = Math.PI / 2;
      tap.position.set(-0.2 + xOff, 2.86, 0.35);
      scene.add(tap);
      const drop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, 0.42, 10),
        brushedCopper,
      );
      drop.position.set(-0.2 + xOff, 2.66, 2.25);
      scene.add(drop);
    });
    // Horizontal 3-Phase Copper SVC Shunt Collector Bus linking Delta FC Bank & Delta TCR Valves
    [-0.22, 0, 0.22].forEach((zOff) => {
      const hdr = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.038, 7.2, 12),
        brushedCopper,
      );
      hdr.rotation.z = Math.PI / 2;
      hdr.position.set(-0.25, 2.48, 2.25 + zOff);
      hdr.castShadow = true;
      scene.add(hdr);
    });
    // Support mini-portals for SVC Shunt Collector Bus + vertical copper jumpers down to FC & TCR
    [-4.05, -0.2, 3.55].forEach((sx) => {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 2.42, 0.11),
        galvSteel,
      );
      post.position.set(sx, 1.21, 2.25);
      post.castShadow = true;
      scene.add(post);
      const xBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.09, 0.62),
        galvSteel,
      );
      xBar.position.set(sx, 2.34, 2.25);
      scene.add(xBar);
    });
    // Copper jumpers from SVC Collector Bus into all 3 FC cans & all 3 TCR valve towers
    [-3.85, -2.85, -1.85, 0.37, 1.85, 3.33].forEach((jx) => {
      const jump = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.56, 8),
        brushedCopper,
      );
      jump.position.set(jx, 2.22, 2.25);
      scene.add(jump);
    });

    // ─── 3. INDUSTRIAL PLANT LOAD CENTER: 20 HP MOTOR + RL BANK (x = +6.5, z = -1.6) ───
    const motorGroup = new THREE.Group();
    motorGroup.position.set(6.5, 0, -1.6);
    const mPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.28, 2.2),
      darkAnodized,
    );
    mPlinth.position.y = 0.14;
    motorGroup.add(mPlinth);
    const mFrame = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 0.92, 2.15, 28),
      motorPaintMat,
    );
    mFrame.rotation.z = Math.PI / 2;
    mFrame.position.set(0, 1.24, 0);
    mFrame.castShadow = true;
    motorGroup.add(mFrame);
    // Precision cooling fins around stator
    for (let r = -0.85; r <= 0.86; r += 0.19) {
      const fin = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.032, 8, 28),
        motorPaintMat,
      );
      fin.rotation.y = Math.PI / 2;
      fin.position.set(r, 1.24, 0);
      motorGroup.add(fin);
    }
    // End-bells + Top Terminal Junction Box
    [-1.12, 1.12].forEach((ex) => {
      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.86, 0.72, 0.24, 24),
        steelFrame,
      );
      bell.rotation.z = Math.PI / 2;
      bell.position.set(ex, 1.24, 0);
      motorGroup.add(bell);
    });
    const jBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.36, 0.54),
      steelFrame,
    );
    jBox.position.set(0.1, 2.28, 0);
    motorGroup.add(jBox);
    // Spinning Rotor Shaft + Machined Coupling Hub + 6-Blade Fan
    const rotorPivot = new THREE.Group();
    rotorPivot.position.set(-1.42, 1.24, 0);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.92, 16),
      galvSteel,
    );
    shaft.rotation.z = Math.PI / 2;
    rotorPivot.add(shaft);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.24, 16),
      brushedCopper,
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.x = -0.25;
    rotorPivot.add(hub);
    for (let b = 0; b < 6; b++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.98, 0.12),
        brushedCopper,
      );
      blade.rotation.x = (b * Math.PI) / 3;
      blade.position.x = -0.25;
      rotorPivot.add(blade);
    }
    motorGroup.add(rotorPivot);
    // Companion Static RL Load Enclosure behind motor
    const rlCab = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 1.35, 0.85),
      steelFrame,
    );
    rlCab.position.set(0.35, 0.94, -1.35);
    rlCab.castShadow = true;
    motorGroup.add(rlCab);
    scene.add(motorGroup);

    // ─── 4. DELTA FIXED CAPACITOR BANK (3 × 111 µF EKON, x = -2.85, z = +2.85) ───
    const capGroup = new THREE.Group();
    capGroup.position.set(-2.85, 0, 2.85);
    const capSkid = new THREE.Mesh(
      new THREE.BoxGeometry(3.25, 0.24, 1.55),
      darkAnodized,
    );
    capSkid.position.y = 0.12;
    capGroup.add(capSkid);
    // Live LED status strip along front edge of capacitor skid
    const capLedMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.0,
    });
    const capLed = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.055, 0.05),
      capLedMat,
    );
    capLed.position.set(0, 0.14, 0.78);
    capGroup.add(capLed);

    [-1.0, 0, 1.0].forEach((cx) => {
      const can = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 1.62, 24),
        capCanMat,
      );
      can.position.set(cx, 1.05, 0);
      can.castShadow = true;
      capGroup.add(can);
      const capRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.03, 10, 24),
        galvSteel,
      );
      capRim.rotation.x = Math.PI / 2;
      capRim.position.set(cx, 1.85, 0);
      capGroup.add(capRim);
      // Dual ribbed porcelain bushings per capacitor unit (Δ terminals)
      [-0.14, 0.14].forEach((bx) => {
        const b = createPorcelainBushing(THREE, 0.42, 0.06, shinyPorcelain);
        b.position.set(cx + bx, 1.86, 0);
        capGroup.add(b);
      });
    });
    // Visible Copper Delta Interconnecting Busbars across the 3 Capacitor Cans
    const deltaBar1 = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.06, 0.08),
      brushedCopper,
    );
    deltaBar1.position.set(0, 2.28, -0.05);
    capGroup.add(deltaBar1);
    const deltaBar2 = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.06, 0.08),
      brushedCopper,
    );
    deltaBar2.position.set(0, 2.38, 0.08);
    capGroup.add(deltaBar2);
    scene.add(capGroup);

    // ─── 5. DELTA TCR COILS (3 × 91.28 mH) + 6 ANTI-PARALLEL THYRISTORS (x = +1.85, z = +2.85) ───
    const tcrGroup = new THREE.Group();
    tcrGroup.position.set(1.85, 0, 2.85);
    const tcrSkid = new THREE.Mesh(
      new THREE.BoxGeometry(4.65, 0.24, 2.55),
      darkAnodized,
    );
    tcrSkid.position.y = 0.12;
    tcrGroup.add(tcrSkid);

    function buildHelixGeo(radius, height, turns, tubeR) {
      const pts = [];
      const steps = turns * 20;
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const a = u * turns * Math.PI * 2;
        pts.push(
          new THREE.Vector3(
            Math.cos(a) * radius,
            u * height,
            Math.sin(a) * radius,
          ),
        );
      }
      return new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts),
        steps,
        tubeR,
        8,
        false,
      );
    }
    const outerHelix = buildHelixGeo(0.45, 1.38, 8, 0.044);

    const valveWafers = [];
    [-1.48, 0, 1.48].forEach((tx) => {
      // 3 Porcelain Standoff Insulators lifting each air-core TCR reactor
      for (let k = 0; k < 3; k++) {
        const ang = (k * Math.PI * 2) / 3;
        const stand = createPorcelainBushing(THREE, 0.36, 0.06, shinyPorcelain);
        stand.position.set(
          tx + Math.cos(ang) * 0.32,
          0.24,
          0.56 + Math.sin(ang) * 0.32,
        );
        tcrGroup.add(stand);
      }
      // Bottom & Top Aluminum Spider Clamps
      [0.6, 1.98].forEach((sy) => {
        const clamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.49, 0.49, 0.06, 20),
          galvSteel,
        );
        clamp.position.set(tx, sy, 0.56);
        tcrGroup.add(clamp);
      });
      // Helical Wound Brushed-Copper Air-Core Coil
      const coil = new THREE.Mesh(outerHelix, brushedCopper);
      coil.position.set(tx, 0.6, 0.56);
      coil.castShadow = true;
      tcrGroup.add(coil);

      // Luminous Inner Magnetic Flux Core (scales glow with k(α))
      const fluxCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.26, 1.28, 16),
        coilFluxMat,
      );
      fluxCore.position.set(tx, 1.26, 0.56);
      tcrGroup.add(fluxCore);

      // Anti-Parallel Thyristor Valve Stack behind coil (Aluminum heatsinks + glass housing)
      const vTower = new THREE.Group();
      vTower.position.set(tx, 0.24, -0.62);
      const vHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 1.85, 0.64),
        valveShieldMat,
      );
      vHousing.position.y = 0.94;
      vTower.add(vHousing);
      // Stacked anodized heatsink plates
      for (let p = 0; p < 5; p++) {
        const hs = new THREE.Mesh(
          new THREE.BoxGeometry(0.66, 0.07, 0.46),
          galvSteel,
        );
        hs.position.y = 0.32 + p * 0.32;
        vTower.add(hs);
      }
      // Glowing Thyristor Silicon Puck Core (pulses with firing angle α!)
      const wafer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 1.15, 14),
        new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.75,
          roughness: 0.25,
        }),
      );
      wafer.position.y = 0.96;
      vTower.add(wafer);
      valveWafers.push(wafer);
      tcrGroup.add(vTower);
    });
    scene.add(tcrGroup);

    // ─── 6. SMART SCADA / PI CONTROL CABINET WITH LIVE 3D HMI SCREEN (x = +6.55, z = +2.85) ───
    const cabGroup = new THREE.Group();
    cabGroup.position.set(6.55, 0, 2.85);
    const cabBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 2.45, 1.15),
      darkAnodized,
    );
    cabBody.position.y = 1.24;
    cabBody.castShadow = true;
    cabGroup.add(cabBody);
    const cabDoorTrim = new THREE.Mesh(
      new THREE.BoxGeometry(1.48, 2.24, 0.04),
      steelFrame,
    );
    cabDoorTrim.position.set(0, 1.24, 0.57);
    cabGroup.add(cabDoorTrim);

    // Live Canvas Texture rendered directly on the 3D SCADA HMI Screen!
    const hmiCanvas = document.createElement("canvas");
    hmiCanvas.width = 256;
    hmiCanvas.height = 176;
    const hmiCtx = hmiCanvas.getContext("2d");
    const hmiTex = new THREE.CanvasTexture(hmiCanvas);
    if (THREE.sRGBEncoding) hmiTex.encoding = THREE.sRGBEncoding;
    const hmiScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.22, 0.84),
      new THREE.MeshBasicMaterial({ map: hmiTex }),
    );
    hmiScreen.position.set(0, 1.66, 0.6);
    cabGroup.add(hmiScreen);

    // Glowing Tower Status Beacon on top of PI Cabinet (Green / Amber / Red)
    const beaconPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.35, 10),
      galvSteel,
    );
    beaconPole.position.set(0.48, 2.62, 0);
    cabGroup.add(beaconPole);
    const beaconLight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.24, 16),
      beaconMat,
    );
    beaconLight.position.set(0.48, 2.88, 0);
    cabGroup.add(beaconLight);
    scene.add(cabGroup);

    function drawHMIScreen(pf, alpha, qGrid, modeLbl) {
      const g = hmiCtx;
      g.fillStyle = "#090E1A";
      g.fillRect(0, 0, 256, 176);
      const col = pf >= 0.92 ? "#10B981" : pf >= 0.7 ? "#F59E0B" : "#F43F5E";
      g.strokeStyle = col;
      g.lineWidth = 4;
      g.strokeRect(4, 4, 248, 168);

      g.fillStyle = "#94A3B8";
      g.font = "700 14px 'JetBrains Mono', monospace";
      g.fillText("FC-TCR PI SCADA", 16, 26);

      g.fillStyle = col;
      g.font = "800 32px 'Space Grotesk', sans-serif";
      g.fillText("PF " + pf.toFixed(4), 16, 66);

      g.fillStyle = "#E2E8F0";
      g.font = "700 17px 'JetBrains Mono', monospace";
      g.fillText("α = " + alpha.toFixed(1) + "°", 16, 96);
      g.fillText(
        "Q = " +
          (qGrid >= 0 ? "+" : "−") +
          (Math.abs(qGrid) >= 1000
            ? (Math.abs(qGrid) / 1000).toFixed(1) + "k"
            : Math.abs(qGrid).toFixed(0)),
        128,
        96,
      );

      // Mini live waveform icon at bottom of HMI screen
      g.strokeStyle = "#38BDF8";
      g.lineWidth = 2.5;
      g.beginPath();
      for (let x = 16; x <= 240; x += 6) {
        const y = 136 + Math.sin(((x - 16) / 224) * Math.PI * 4) * 18;
        if (x === 16) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      g.strokeStyle = col;
      g.beginPath();
      const lag = pf >= 0.99 ? 0 : qGrid > 0 ? 1.1 : -1.1;
      for (let x = 16; x <= 240; x += 6) {
        const y = 136 + Math.sin(((x - 16) / 224) * Math.PI * 4 - lag) * 14;
        if (x === 16) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      hmiTex.needsUpdate = true;
    }

    // ─── 7. CUSTOM GLSL ANIMATED LUMINOUS 3D POWER FLOW CONDUITS ───
    // Conduit 1: Active Power P (Emerald) — 1 MVA Xfmr → 20 HP Motor
    const activeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.3, 2.95, -1.6),
      new THREE.Vector3(-1.5, 2.95, -1.6),
      new THREE.Vector3(2.2, 2.95, -1.6),
      new THREE.Vector3(6.2, 2.45, -1.6),
    ]);
    const activeFlowMat = createEnergyFlowShader(THREE, 0x10b981, 0.95, 7.0);
    const activeFlowTube = new THREE.Mesh(
      new THREE.TubeGeometry(activeCurve, 64, 0.14, 12, false),
      activeFlowMat,
    );
    scene.add(activeFlowTube);

    // Conduit 2: Local Reactive Power Q Loop (Luminous Cyan) — follows real copper Shunt Bus & PCC!
    const localQCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-2.85, 2.52, 2.28),
        new THREE.Vector3(-0.2, 2.68, 2.15),
        new THREE.Vector3(-0.2, 2.96, -1.25),
        new THREE.Vector3(3.1, 3.0, -1.25),
        new THREE.Vector3(6.25, 2.55, -1.3),
        new THREE.Vector3(3.1, 2.86, -1.0),
        new THREE.Vector3(0.25, 2.75, 1.95),
        new THREE.Vector3(1.85, 2.52, 2.28),
      ],
      true,
    );
    const localQMat = createEnergyFlowShader(THREE, 0x0ea5e9, 0.82, 10.0);
    const localQTube = new THREE.Mesh(
      new THREE.TubeGeometry(localQCurve, 108, 0.125, 12, true),
      localQMat,
    );
    scene.add(localQTube);

    // Conduit 3: Uncompensated Utility Grid Q Overload (Pulsing Crimson) — visible when SVC OFF!
    const overloadCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-5.5, 3.32, -1.6),
      new THREE.Vector3(-1.5, 3.32, -1.6),
      new THREE.Vector3(2.4, 3.32, -1.6),
      new THREE.Vector3(6.3, 2.78, -1.6),
    ]);
    const overloadMat = createEnergyFlowShader(THREE, 0xf43f5e, 1.35, 8.0);
    const overloadTube = new THREE.Mesh(
      new THREE.TubeGeometry(overloadCurve, 64, 0.165, 12, false),
      overloadMat,
    );
    scene.add(overloadTube);

    // ─── 8. CRISP HTML-PROJECTED CLICKABLE 3D CALLOUT PINS (ZERO-OVERLAP ANCHORS) ───
    const CALLOUTS = [
      {
        cam: "xfmr",
        pos: new THREE.Vector3(-6.9, 4.15, -1.6),
        title: "1 MVA Transformer",
        sub: "11 kV Δ / 400 V Yg",
        clr: "#0284C7",
      },
      {
        cam: "cap",
        pos: new THREE.Vector3(-3.0, 2.95, 3.1),
        title: "Delta FC Bank",
        sub: "3×111 µF (−16.74 kVAR)",
        clr: "#0EA5E9",
      },
      {
        cam: "tcr",
        pos: new THREE.Vector3(1.85, 2.95, 3.1),
        title: "Delta TCR & Valves",
        sub: "3×91.28 mH + 6 SCRs",
        clr: "#D97706",
      },
      {
        cam: "motor",
        pos: new THREE.Vector3(6.8, 3.55, -2.0),
        title: "20 HP Motor + RL",
        sub: "6.25 kW · +13.31 kVAR",
        clr: "#EA580C",
      },
      {
        cam: "scada",
        pos: new THREE.Vector3(6.7, 3.15, 3.0),
        title: "PI SCADA Cabinet",
        sub: "Q_ref = 0 · Auto α",
        clr: "#10B981",
      },
    ];
    let showLabels = true;
    const pinEls = CALLOUTS.map((c) => {
      const el = document.createElement("button");
      el.className = "t3d-pin";
      el.style.setProperty("--pin-clr", c.clr);
      el.innerHTML = `<span class="t3d-pin-dot"></span><span class="t3d-pin-txt"><strong>${c.title}</strong><em>${c.sub}</em></span>`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        flyToPreset(c.cam);
      });
      pinsLayer.appendChild(el);
      return { el, pos: c.pos };
    });

    // ─── CAMERA ORBIT & SMOOTH FLY-TO PRESETS ───
    const CAM_PRESETS = {
      overview: {
        theta: -0.14,
        phi: 1.06,
        dist: 19.6,
        tx: 0.0,
        ty: 1.15,
        tz: 0.45,
      },
      xfmr: {
        theta: -0.52,
        phi: 1.12,
        dist: 8.6,
        tx: -6.5,
        ty: 1.55,
        tz: -1.5,
      },
      cap: { theta: -0.26, phi: 1.16, dist: 8.2, tx: -2.8, ty: 1.25, tz: 2.85 },
      tcr: { theta: 0.2, phi: 1.16, dist: 8.8, tx: 1.85, ty: 1.3, tz: 2.85 },
      motor: { theta: 0.54, phi: 1.12, dist: 8.6, tx: 6.3, ty: 1.35, tz: -1.5 },
      scada: {
        theta: 0.24,
        phi: 1.22,
        dist: 6.6,
        tx: 6.55,
        ty: 1.45,
        tz: 2.85,
      },
    };
    const camState = { ...CAM_PRESETS.overview };
    const camTarget = { ...CAM_PRESETS.overview };
    let activePreset = "overview";
    let baseTheta = CAM_PRESETS.overview.theta;
    let userDragged = false;
    let autoOrbit = true;
    let dragging = false,
      lastX = 0,
      lastY = 0;

    function flyToPreset(key) {
      const p = CAM_PRESETS[key];
      if (!p) return;
      activePreset = key;
      baseTheta = p.theta;
      userDragged = false;
      Object.assign(camTarget, p);
      root
        .querySelectorAll("[data-cam]")
        .forEach((b) =>
          b.classList.toggle("active", b.getAttribute("data-cam") === key),
        );
    }

    renderer.domElement.addEventListener("pointerdown", (e) => {
      dragging = true;
      userDragged = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener("pointerup", () => (dragging = false));
    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      camTarget.theta -= (e.clientX - lastX) * 0.0065;
      camTarget.phi = Math.max(
        0.45,
        Math.min(1.4, camTarget.phi - (e.clientY - lastY) * 0.0055),
      );
      lastX = e.clientX;
      lastY = e.clientY;
    });
    renderer.domElement.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        camTarget.dist = Math.max(
          5.8,
          Math.min(26, camTarget.dist + e.deltaY * 0.011),
        );
      },
      { passive: false },
    );

    // ─── LIVE ELECTRICAL OPERATING STATE ───
    const simState = {
      mode: "case1",
      motorOn: true,
      capOn: true,
      alpha: 130.09,
      overloaded: false,
    };

    function kFactor(deg) {
      const a = (deg * Math.PI) / 180;
      return Math.max(
        0,
        Math.min(1, (2 * (Math.PI - a) + Math.sin(2 * a)) / Math.PI),
      );
    }

    function updateTelemetryUI() {
      const k = kFactor(simState.alpha);
      const qLoad = simState.motorOn ? 13310 : 5000;
      const pLoad = simState.motorOn ? 6252.2 : 4460.5;
      const qC = simState.capOn ? 16740 : 0;
      const qTCR = 16740 * k;
      let qGrid = qLoad - qC + qTCR;
      if (simState.mode === "case1") qGrid = -4.3;
      if (simState.mode === "case2") qGrid = -3.34;
      if (simState.mode === "uncomp") qGrid = 12605.2;
      if (simState.mode === "cancel") qGrid = 4963.3;

      const S = Math.sqrt(pLoad * pLoad + qGrid * qGrid);
      const PF = Math.min(1.0, pLoad / Math.max(S, 1));
      const IL = S / (Math.sqrt(3) * 400);

      elPF.textContent =
        PF.toFixed(4) +
        (Math.abs(qGrid) < 60 ? " Unity" : qGrid > 0 ? " Lag" : " Lead");
      elPF.style.color =
        PF >= 0.92 ? "var(--ok)" : PF >= 0.7 ? "var(--svc)" : "var(--err)";
      elIL.textContent = IL.toFixed(2) + " A";
      elQ.textContent =
        (qGrid >= 0 ? "+" : "−") +
        (Math.abs(qGrid) >= 1000
          ? (Math.abs(qGrid) / 1000).toFixed(2) + " kVAR"
          : Math.abs(qGrid).toFixed(1) + " VAR");
      elA.textContent = simState.alpha.toFixed(2) + "°";
      alphaSlider.value = simState.alpha;
      alphaRead.textContent = simState.alpha.toFixed(1) + "°";

      // Live PBR hardware updates
      capCanMat.color.setHex(simState.capOn ? 0x0284c7 : 0x475569);
      capCanMat.emissiveIntensity = simState.capOn ? 0.22 : 0.0;
      capLedMat.color.setHex(simState.capOn ? 0x0ea5e9 : 0x334155);
      capLedMat.emissiveIntensity = simState.capOn ? 1.1 : 0.0;

      coilFluxMat.emissiveIntensity = 0.06 + k * 1.65;
      coilFluxMat.opacity = 0.22 + k * 0.68;
      tcrPointLight.intensity = 0.2 + k * 2.2;

      simState.overloaded = Math.abs(qGrid) > 3500;
      xfmrTankMat.emissiveIntensity = simState.overloaded ? 0.35 : 0.0;
      xfmrWarnRing.visible = simState.overloaded;
      if (!simState.overloaded) {
        xfmrWarnRing.material.opacity = 0.0;
        xfmrWarnRing.scale.set(1, 1, 1);
      }

      const statusHex = PF >= 0.92 ? 0x10b981 : PF >= 0.7 ? 0xf59e0b : 0xf43f5e;
      beaconMat.color.setHex(statusHex);
      beaconMat.emissive.setHex(statusHex);

      // Update GLSL Energy Conduits visibility & speed
      localQTube.visible = simState.capOn || k > 0.02;
      overloadTube.visible = Math.abs(qGrid) > 650;
      activeFlowMat.uniforms.uSpeed.value = simState.motorOn ? 0.95 : 0.62;
      drawHMIScreen(PF, simState.alpha, qGrid, simState.mode);
    }

    root
      .querySelectorAll("[data-cam]")
      .forEach((btn) =>
        btn.addEventListener("click", () =>
          flyToPreset(btn.getAttribute("data-cam")),
        ),
      );
    labelsBtn.addEventListener("click", () => {
      showLabels = !showLabels;
      labelsBtn.classList.toggle("active", showLabels);
      pinsLayer.classList.toggle("is-hidden", !showLabels);
    });
    orbitBtn.addEventListener("click", () => {
      autoOrbit = !autoOrbit;
      if (autoOrbit) userDragged = false;
      orbitBtn.classList.toggle("active", autoOrbit);
    });
    root.querySelectorAll("[data-m3d]").forEach((btn) => {
      btn.addEventListener("click", () => {
        root
          .querySelectorAll("[data-m3d]")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const m = btn.getAttribute("data-m3d");
        simState.mode = m;
        if (m === "case1") {
          simState.motorOn = true;
          simState.capOn = true;
          simState.alpha = 130.09;
        }
        if (m === "case2") {
          simState.motorOn = false;
          simState.capOn = true;
          simState.alpha = 103.8;
        }
        if (m === "uncomp") {
          simState.motorOn = true;
          simState.capOn = false;
          simState.alpha = 180.0;
        }
        if (m === "cancel") {
          simState.motorOn = false;
          simState.capOn = true;
          simState.alpha = 90.0;
        }
        updateTelemetryUI();
      });
    });
    alphaSlider.addEventListener("input", () => {
      simState.mode = "custom";
      simState.alpha = +alphaSlider.value;
      root
        .querySelectorAll("[data-m3d]")
        .forEach((b) => b.classList.remove("active"));
      updateTelemetryUI();
    });

    let curEnvRT = null;
    let curPadTex = null;
    function applyTheme() {
      const th = readTheme();
      const studioBg = new THREE.Color(th.isLight ? 0xeef3f9 : 0x0b101d);
      scene.background = studioBg;
      scene.fog = new THREE.FogExp2(
        studioBg.getHex(),
        th.isLight ? 0.02 : 0.023,
      );

      infinityPlane.material.color.set(th.isLight ? 0xe7eef6 : 0x0c1220);
      floorGrid.material.opacity = th.isLight ? 0.25 : 0.16;
      hemiLight.intensity = th.isLight ? 0.92 : 0.65;

      // Rich high-contrast energy conduits for both light & dark themes
      activeFlowMat.uniforms.uColor.value.setHex(
        th.isLight ? 0x059669 : 0x10b981,
      );
      localQMat.uniforms.uColor.value.setHex(th.isLight ? 0x0284c7 : 0x38bdf8);
      overloadMat.uniforms.uColor.value.setHex(
        th.isLight ? 0xe11d48 : 0xf43f5e,
      );

      if (curEnvRT) curEnvRT.dispose();
      curEnvRT = buildStudioEnvMap(THREE, renderer, th.isLight);
      scene.environment = curEnvRT.texture;

      if (curPadTex) curPadTex.dispose();
      curPadTex = buildPadTexture(THREE, th.isLight);
      padTopMat.map = curPadTex;
      padTopMat.needsUpdate = true;
    }
    applyTheme();
    updateTelemetryUI();

    function resize() {
      const w = wrap.clientWidth || 980;
      const h = wrap.clientHeight || 440;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("themechange", applyTheme);

    let active = false;
    let rafId = null;
    let t = 0;
    const projV = new THREE.Vector3();

    function updatePins() {
      if (!showLabels) return;
      const w = wrap.clientWidth || 980;
      const h = wrap.clientHeight || 440;
      pinEls.forEach((p) => {
        projV.copy(p.pos).project(camera);
        if (projV.z > 1 || projV.z < -1) {
          p.el.style.display = "none";
          return;
        }
        const sx = (projV.x * 0.5 + 0.5) * w;
        const sy = (-projV.y * 0.5 + 0.5) * h;
        p.el.style.display = "inline-flex";
        p.el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
      });
    }

    function animate() {
      if (!active) return;
      t += 0.016;

      if (!dragging && autoOrbit && !userDragged) {
        // Silky studio showcase sway (±16° in overview, ±11° in close-up so front HMI & hardware stay in view!)
        const amp = activePreset === "overview" ? 0.28 : 0.19;
        const freq = activePreset === "overview" ? 0.22 : 0.3;
        camTarget.theta = baseTheta + Math.sin(t * freq) * amp;
      }
      ["theta", "phi", "dist", "tx", "ty", "tz"].forEach((k) => {
        camState[k] += (camTarget[k] - camState[k]) * 0.08;
      });

      camera.position.set(
        camState.tx +
          camState.dist * Math.sin(camState.phi) * Math.sin(camState.theta),
        camState.ty + camState.dist * Math.cos(camState.phi),
        camState.tz +
          camState.dist * Math.sin(camState.phi) * Math.cos(camState.theta),
      );
      camera.lookAt(camState.tx, camState.ty, camState.tz);

      // Update GLSL Energy Flow Shader Clocks
      activeFlowMat.uniforms.uTime.value = t;
      localQMat.uniforms.uTime.value = t;
      overloadMat.uniforms.uTime.value = t;

      // Spin 20 HP Induction Motor Rotor
      if (simState.motorOn) rotorPivot.rotation.x += 0.22;

      // Synchronized Thyristor Valve Firing Pulse Glow
      const k = kFactor(simState.alpha);
      valveWafers.forEach((vw, idx) => {
        const ph = 0.5 + 0.5 * Math.sin(t * 9.5 + idx * 2.09);
        vw.material.emissiveIntensity =
          k > 0.01 ? 0.28 + k * (0.65 + 0.65 * ph) : 0.03;
      });

      // Thermal Warning Ring pulse when SVC OFF
      if (simState.overloaded) {
        const p = 0.5 + 0.5 * Math.sin(t * 6.0);
        xfmrWarnRing.material.opacity = 0.28 + 0.45 * p;
        const sc = 0.96 + 0.09 * p;
        xfmrWarnRing.scale.set(sc, sc, 1);
      }

      renderer.render(scene, camera);
      updatePins();
      rafId = requestAnimationFrame(animate);
    }

    const slide = root.closest(".slide");
    if (slide) {
      slide.addEventListener("slide:enter", () => {
        active = true;
        resize();
        if (!rafId) animate();
      });
      slide.addEventListener("slide:leave", () => {
        active = false;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      });
    }
  }

  function boot3D() {
    initSVCSubstation3D();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot3D);
  } else {
    boot3D();
  }
})();
