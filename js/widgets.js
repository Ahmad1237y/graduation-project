/**
 * widgets.js — Interactive Canvas Widgets for Reactive Power Compensation Presentation
 * 6 widgets: Power Triangle, Capacitor Q-V, TCR Oscilloscope, SVC V-I, STATCOM Phasors, Voltage Sag Test
 *
 * All widgets read CSS custom properties for theming and respond to
 * 'themechange', 'slide:enter', 'slide:leave', and window resize events.
 */
(function () {
  "use strict";

  /* ───────────────────────── Theme Helper ───────────────────────── */

  function getTheme() {
    const s = getComputedStyle(document.documentElement);
    const g = (v) => s.getPropertyValue(v).trim() || null;
    return {
      bg: g("--bg") || "#0f172a",
      surf: g("--surf") || "#1e293b",
      tx: g("--tx") || "#e2e8f0",
      mut: g("--mut") || "#94a3b8",
      p: g("--p") || "#22d3ee", // cyan
      s: g("--s") || "#fbbf24", // amber
      ok: g("--ok") || "#34d399", // green
      err: g("--err") || "#f87171", // red
      cap: g("--cap") || "#3b82f6", // blue
      sc: g("--sc") || "#f97316", // orange
      svc: g("--svc") || "#facc15", // yellow
      stat: g("--stat") || "#a78bfa", // purple
    };
  }

  /* ───────────────────────── Shared Utilities ───────────────────── */

  const DPR = Math.max(window.devicePixelRatio || 1, 1);
  const FONT = "'Space Grotesk', sans-serif";
  const PI = Math.PI;
  const TAU = 2 * PI;
  const DEG = PI / 180;

  /** Resize a canvas to fill its container at the correct DPR. Returns {w,h} in CSS px. */
  function fitCanvas(canvas, aspectRatio) {
    const parent = canvas.parentElement;
    const w = Math.max((parent.clientWidth || 540) - 8, 300);
    const maxH = parseInt(parent.dataset.maxH || "320", 10);
    const rawH = aspectRatio
      ? Math.round(w / aspectRatio)
      : Math.round(w / 1.9);
    const h = Math.min(rawH, maxH);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    return { w, h };
  }

  /** Shorthand: set font with DPR scaling. */
  function setFont(ctx, size, weight) {
    ctx.font =
      (weight || "600") + " " + Math.round(size * 1.15 * DPR) + "px " + FONT;
  }

  /** Draw an arrow from (x1,y1) to (x2,y2). All in canvas px (already DPR-scaled). */
  function drawArrow(ctx, x1, y1, x2, y2, color, lineWidth, headLen) {
    headLen = headLen || 10 * DPR;
    lineWidth = lineWidth || 2.5 * DPR;
    const dx = x2 - x1,
      dy = y2 - y1;
    const angle = Math.atan2(dy, dx);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - PI / 7),
      y2 - headLen * Math.sin(angle - PI / 7),
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + PI / 7),
      y2 - headLen * Math.sin(angle + PI / 7),
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Create a slider control inside a container div. Returns the <input> element. */
  function createSlider(container, { min, max, step, value, label, unit, id }) {
    const wrap = document.createElement("div");
    wrap.className = "widget-slider-wrap";
    wrap.style.cssText =
      "display:flex;align-items:center;gap:8px;padding:6px 4px;font-family:" +
      FONT +
      ";font-size:13px;";

    const lbl = document.createElement("span");
    lbl.style.cssText =
      "min-width:60px;color:var(--tx,#e2e8f0);font-weight:600;white-space:nowrap;";
    lbl.textContent = label || "";

    const inp = document.createElement("input");
    inp.type = "range";
    inp.min = min;
    inp.max = max;
    inp.step = step || 1;
    inp.value = value;
    inp.id = id || "";
    inp.style.cssText =
      "flex:1;accent-color:var(--p,#22d3ee);height:6px;cursor:pointer;";

    const val = document.createElement("span");
    val.className = "widget-slider-val";
    val.style.cssText =
      "min-width:60px;text-align:right;color:var(--p,#22d3ee);font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap;";
    val.textContent = (+value).toFixed(step && step < 1 ? 2 : 0) + (unit || "");

    wrap.append(lbl, inp, val);
    container.appendChild(wrap);

    inp._valSpan = val;
    inp._unit = unit || "";
    inp._step = step;
    return inp;
  }

  /** Update the displayed value next to a slider. */
  function updateSliderLabel(inp, v) {
    if (!inp._valSpan) return;
    const decimals = inp._step && inp._step < 1 ? 2 : inp._step == 1 ? 0 : 1;
    inp._valSpan.textContent = (+v).toFixed(decimals) + inp._unit;
  }

  /** Create a badge element. Returns the span. */
  function createBadge(container, text, bgColor) {
    const badge = document.createElement("span");
    badge.className = "widget-badge";
    badge.style.cssText =
      "display:inline-block;padding:3px 10px;border-radius:6px;font-family:" +
      FONT +
      ";font-size:12px;font-weight:600;margin:4px 4px 4px 0;color:#fff;background:" +
      (bgColor || "var(--p,#22d3ee)") +
      ";";
    badge.textContent = text;
    container.appendChild(badge);
    return badge;
  }

  /** Create a button. Returns the button element. */
  function createButton(container, text, bgColor) {
    const btn = document.createElement("button");
    btn.className = "widget-btn";
    btn.textContent = text;
    btn.style.cssText =
      "padding:6px 16px;border:none;border-radius:6px;font-family:" +
      FONT +
      ";font-size:13px;font-weight:700;cursor:pointer;color:#fff;background:" +
      (bgColor || "var(--p,#22d3ee)") +
      ";transition:filter .15s;";
    btn.addEventListener(
      "mouseenter",
      () => (btn.style.filter = "brightness(1.2)"),
    );
    btn.addEventListener("mouseleave", () => (btn.style.filter = ""));
    container.appendChild(btn);
    return btn;
  }

  /** Create a badge row container. */
  function createBadgeRow(container) {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;flex-wrap:wrap;align-items:center;padding:2px 4px;gap:4px;";
    container.appendChild(row);
    return row;
  }

  /* ────────────────── Slide lifecycle helper ────────────────────── */

  function bindSlideLifecycle(el, onEnter, onLeave) {
    const slide = el.closest(".slide") || el;
    slide.addEventListener("slide:enter", onEnter);
    slide.addEventListener("slide:leave", onLeave);
  }

  /* ================================================================
   *  Widget 1 — Power Triangle   (#widget-power-triangle)
   * ================================================================ */

  function initPowerTriangle() {
    const root = document.getElementById("widget-power-triangle");
    if (!root) return;
    root.style.cssText = (root.style.cssText || "") + ";position:relative;";

    const canvas = document.createElement("canvas");
    root.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const slider = createSlider(root, {
      min: 0,
      max: 75,
      step: 1,
      value: 32,
      label: "Phase Angle φ",
      unit: "°",
    });
    const badgeRow = createBadgeRow(root);
    const pfBadge = createBadge(badgeRow, "PF = 0.848");
    const statusBadge = createBadge(badgeRow, "Penalty Zone (< 0.90)");

    let theme = getTheme();
    let active = false;

    function draw() {
      const { w, h } = fitCanvas(canvas, 1.95);
      const d = DPR;
      const phiDeg = +slider.value;
      const phi = phiDeg * DEG;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // True electrical values (Reference Active Power P = 100 kW)
      const pKW = 100;
      const qKVAR = pKW * Math.tan(phi);
      const sKVA = pKW / Math.cos(phi);
      const pf = Math.cos(phi);

      // Geometry with auto-scaling so triangle never clips top or right
      const ox = 54 * d;
      const oy = h * d - 44 * d;
      const maxW = w * d - ox - 155 * d; // leave 155px on right for Q label
      const maxH = oy - 42 * d;

      const rawP = maxW;
      const rawQ = rawP * Math.tan(phi);
      const scale = rawQ > maxH ? maxH / rawQ : 1;
      const pLen = Math.max(rawP * scale, 70 * d);
      const qLen = rawQ * scale;

      const pEnd = { x: ox + pLen, y: oy };
      const qEnd = { x: ox + pLen, y: oy - qLen };
      const drawAngle = Math.atan2(qLen, pLen);

      // Subtle triangle fill
      ctx.save();
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = theme.p;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.lineTo(qEnd.x, qEnd.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Shaded angle sector for φ
      if (phiDeg > 1) {
        const arcR = Math.min(48 * d, pLen * 0.42);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.arc(ox, oy, arcR, -drawAngle, 0);
        ctx.closePath();
        ctx.fillStyle = theme.p;
        ctx.globalAlpha = 0.2;
        ctx.fill();
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = theme.p;
        ctx.lineWidth = 2 * d;
        ctx.beginPath();
        ctx.arc(ox, oy, arcR, -drawAngle, 0);
        ctx.stroke();
        ctx.restore();

        // φ angle text
        setFont(ctx, 12, "700");
        ctx.fillStyle = theme.tx;
        ctx.textAlign = "left";
        ctx.fillText("φ = " + phiDeg + "°", ox + arcR + 8 * d, oy - 8 * d);
      }

      // Right-angle marker at pEnd
      if (qLen > 16 * d) {
        const mk = 12 * d;
        ctx.strokeStyle = theme.mut;
        ctx.lineWidth = 1.4 * d;
        ctx.beginPath();
        ctx.moveTo(pEnd.x - mk, pEnd.y);
        ctx.lineTo(pEnd.x - mk, pEnd.y - mk);
        ctx.lineTo(pEnd.x, pEnd.y - mk);
        ctx.stroke();
      }

      // Vectors with crisp arrowheads
      drawArrow(ctx, ox, oy, pEnd.x, pEnd.y, theme.ok, 3.2 * d, 11 * d);
      if (qLen > 2 * d) {
        drawArrow(
          ctx,
          pEnd.x,
          pEnd.y,
          qEnd.x,
          qEnd.y,
          theme.err,
          3.2 * d,
          11 * d,
        );
      }
      drawArrow(ctx, ox, oy, qEnd.x, qEnd.y, theme.p, 3.2 * d, 11 * d);

      // P label (centered below horizontal green vector)
      setFont(ctx, 13, "800");
      ctx.fillStyle = theme.ok;
      ctx.textAlign = "center";
      ctx.fillText(
        "P = " + pKW.toFixed(0) + " kW",
        (ox + pEnd.x) / 2,
        oy + 26 * d,
      );

      // Q label (cleanly offset to the RIGHT of the vertical red vector — never overlaps!)
      ctx.fillStyle = theme.err;
      ctx.textAlign = "left";
      const qLabelY = Math.min(
        Math.max((pEnd.y + qEnd.y) / 2 + 5 * d, 56 * d),
        oy - 10 * d,
      );
      ctx.fillText(
        "Q = " + qKVAR.toFixed(0) + " kVAR",
        pEnd.x + 16 * d,
        qLabelY,
      );

      // S label (above hypotenuse)
      ctx.fillStyle = theme.p;
      const smx = (ox + qEnd.x) / 2 - 14 * d * Math.sin(drawAngle);
      const smy = (oy + qEnd.y) / 2 - 14 * d * Math.cos(drawAngle);
      ctx.save();
      ctx.translate(smx, smy);
      ctx.rotate(-drawAngle);
      ctx.textAlign = "center";
      ctx.fillText("S = " + sKVA.toFixed(0) + " kVA", 0, 0);
      ctx.restore();

      // Status color feedback for PF (green >= 0.90, amber 0.75..0.89, red < 0.75)
      const statusCol = pf >= 0.9 ? theme.ok : pf >= 0.75 ? theme.s : theme.err;
      const statusTxt =
        pf >= 0.9
          ? "Optimal PF (≥ 0.90)"
          : pf >= 0.75
            ? "Penalty Zone (< 0.90)"
            : "Poor PF — High Losses";

      // Top-right live status pill on canvas
      const pillText = "PF = cos φ = " + pf.toFixed(3);
      setFont(ctx, 13, "800");
      const tw = ctx.measureText(pillText).width + 24 * d;
      const px = w * d - tw - 14 * d;
      const py = 12 * d;
      const ph = 28 * d;
      ctx.save();
      ctx.fillStyle = statusCol;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.roundRect(px, py, tw, ph, 8 * d);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = statusCol;
      ctx.lineWidth = 1.5 * d;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = statusCol;
      ctx.textAlign = "center";
      ctx.fillText(pillText, px + tw / 2, py + 19 * d);
      ctx.restore();

      // Update bottom badges
      pfBadge.textContent = "PF = " + pf.toFixed(3);
      pfBadge.style.background = statusCol;
      statusBadge.textContent = statusTxt;
      statusBadge.style.background = statusCol;
    }

    slider.addEventListener("input", () => {
      updateSliderLabel(slider, slider.value);
      draw();
    });

    function onResize() {
      if (active) draw();
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("themechange", () => {
      theme = getTheme();
      if (active) draw();
    });

    bindSlideLifecycle(
      root,
      () => {
        active = true;
        draw();
      },
      () => {
        active = false;
      },
    );

    draw();
  }

  /* ================================================================
   *  Widget 2 — Capacitor Q-V  (#widget-cap-qv)
   * ================================================================ */

  function initCapQV() {
    const root = document.getElementById("widget-cap-qv");
    if (!root) return;
    root.style.cssText = (root.style.cssText || "") + ";position:relative;";

    const canvas = document.createElement("canvas");
    root.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const slider = createSlider(root, {
      min: 0.5,
      max: 1.2,
      step: 0.01,
      value: 1.0,
      label: "Terminal Voltage V",
      unit: " pu",
    });

    // Full-width 3-column live KPI strip below the slider (proper subscripts, clean 2-line layout)
    const kpiStrip = document.createElement("div");
    kpiStrip.className = "cap-kpi-strip";
    kpiStrip.innerHTML =
      '<div class="cap-kpi-pill">' +
      '<span class="cap-kpi-label">Capacitor Output (<i>Q</i><sub>C</sub>)</span>' +
      '<span class="cap-kpi-val" id="kpi-qc-val">0.67 pu</span>' +
      "</div>" +
      '<div class="cap-kpi-pill" id="kpi-pf-pill">' +
      '<span class="cap-kpi-label">Compensated Load PF</span>' +
      '<span class="cap-kpi-val" id="kpi-pf-val">0.94 Lagging</span>' +
      "</div>" +
      '<div class="cap-kpi-pill">' +
      '<span class="cap-kpi-label">Active APFC Stages</span>' +
      '<span class="cap-kpi-val" id="kpi-step-val">2 / 3 Steps ON</span>' +
      "</div>";
    root.appendChild(kpiStrip);

    const qValEl = kpiStrip.querySelector("#kpi-qc-val");
    const pfPillEl = kpiStrip.querySelector("#kpi-pf-pill");
    const pfValEl = kpiStrip.querySelector("#kpi-pf-val");
    const stepValEl = kpiStrip.querySelector("#kpi-step-val");

    let theme = getTheme();
    let active = false;
    let activeSteps = 2;

    function draw() {
      const { w, h } = fitCanvas(canvas, 2.15);
      const d = DPR;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (window.capStagesState) {
        activeSteps = window.capStagesState.filter(Boolean).length;
      }
      const scale = activeSteps / 3;
      const V = +slider.value;
      const Q = V * V * scale;
      // Load P=0.8 pu, Q_load=0.75 pu
      const P_load = 0.8,
        Q_net = Math.max(0.75 - Q * 0.72, 0.05);
      const pf = P_load / Math.sqrt(P_load * P_load + Q_net * Q_net);

      // Coordinate system
      const ml = 62 * d,
        mr = 32 * d,
        mt = 32 * d,
        mb = 44 * d;
      const gw = w * d - ml - mr;
      const gh = h * d - mt - mb;

      // Map data → pixel
      const vMin = 0.4,
        vMax = 1.3;
      const qMin = 0,
        qMax = 1.65;
      const px = (v) => ml + ((v - vMin) / (vMax - vMin)) * gw;
      const py = (q) => mt + gh - ((q - qMin) / (qMax - qMin)) * gh;

      // Subtle background grid
      ctx.strokeStyle = theme.surf;
      ctx.lineWidth = 0.8 * d;
      for (let v = 0.5; v <= 1.2; v += 0.1) {
        const x = px(v);
        ctx.beginPath();
        ctx.moveTo(x, mt);
        ctx.lineTo(x, mt + gh);
        ctx.stroke();
      }
      for (let q = 0; q <= 1.6; q += 0.2) {
        const y = py(q);
        ctx.beginPath();
        ctx.moveTo(ml, y);
        ctx.lineTo(ml + gw, y);
        ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = theme.mut;
      ctx.lineWidth = 1.5 * d;
      ctx.beginPath();
      ctx.moveTo(ml, mt);
      ctx.lineTo(ml, mt + gh);
      ctx.lineTo(ml + gw, mt + gh);
      ctx.stroke();

      // Axis labels
      setFont(ctx, 10.5, "600");
      ctx.fillStyle = theme.mut;
      ctx.textAlign = "center";
      for (let v = 0.5; v <= 1.2; v += 0.1) {
        ctx.fillText(v.toFixed(1), px(v), mt + gh + 16 * d);
      }
      ctx.fillText("Terminal Voltage V (pu)", ml + gw / 2, mt + gh + 35 * d);

      ctx.textAlign = "right";
      for (let q = 0; q <= 1.6; q += 0.4) {
        ctx.fillText(q.toFixed(1), ml - 8 * d, py(q) + 4 * d);
      }
      ctx.save();
      ctx.translate(18 * d, mt + gh / 2);
      ctx.rotate(-PI / 2);
      ctx.textAlign = "center";
      ctx.fillText("Reactive Output (pu)", 0, 0);
      ctx.restore();

      // Reference full-bank (3/3) dashed curve
      if (activeSteps < 3) {
        ctx.save();
        ctx.setLineDash([4 * d, 4 * d]);
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.strokeStyle = theme.cap;
        ctx.lineWidth = 1.4 * d;
        for (let v = vMin; v <= vMax; v += 0.01) {
          const x = px(v),
            y = py(v * v);
          if (v === vMin) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Subtle visual reference marker at V = 0.70 pu showing the 49% drop
      const vRef = 0.7;
      const qRef = vRef * vRef * (activeSteps > 0 ? scale : 1);
      const refX = px(vRef);
      const refY = py(qRef);
      ctx.save();
      ctx.setLineDash([3.5 * d, 3.5 * d]);
      ctx.strokeStyle = theme.err;
      ctx.lineWidth = 1.3 * d;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(refX, mt + gh);
      ctx.lineTo(refX, refY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(refX, refY, 4.5 * d, 0, TAU);
      ctx.fillStyle = theme.err;
      ctx.fill();

      // Callout pill for 0.70 pu -> 49% Rated Q_C
      setFont(ctx, 10, "700");
      const refTag = "0.70 pu → 49% Q";
      const rtw = ctx.measureText(refTag).width + 14 * d;
      const rtx = Math.max(ml + 6 * d, refX - rtw / 2);
      const rty = Math.max(mt + 28 * d, refY - 28 * d);
      ctx.fillStyle = theme.err;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.roundRect(rtx, rty, rtw, 20 * d, 6 * d);
      ctx.fill();
      ctx.globalAlpha = 0.65;
      ctx.strokeStyle = theme.err;
      ctx.lineWidth = 1 * d;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.fillText(refTag, rtx + rtw / 2, rty + 14 * d);
      ctx.restore();

      // Parabola curve (active steps)
      ctx.beginPath();
      ctx.strokeStyle = theme.cap;
      ctx.lineWidth = 2.8 * d;
      for (let v = vMin; v <= vMax; v += 0.005) {
        const x = px(v),
          y = py(v * v * scale);
        if (v === vMin) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fill under curve
      ctx.save();
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = theme.cap;
      ctx.beginPath();
      for (let v = vMin; v <= V; v += 0.005) {
        const x = px(v),
          y = py(v * v * scale);
        if (v === vMin) ctx.moveTo(x, py(0));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(px(V), py(0));
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Operating Dot on curve
      const dotX = px(V),
        dotY = py(Q);
      ctx.setLineDash([4 * d, 4 * d]);
      ctx.strokeStyle = theme.cap;
      ctx.lineWidth = 1.1 * d;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(dotX, mt + gh);
      ctx.lineTo(dotX, dotY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ml, dotY);
      ctx.lineTo(dotX, dotY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(dotX, dotY, 7 * d, 0, TAU);
      ctx.fillStyle = theme.cap;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3.5 * d, 0, TAU);
      ctx.fillStyle = theme.bg;
      ctx.fill();

      // Top-left Curve Label with proper subscript C and superscript V²
      ctx.save();
      const lblX = ml + 10 * d;
      const lblY = mt + 16 * d;
      setFont(ctx, 12, "800");
      ctx.fillStyle = theme.cap;
      ctx.textAlign = "left";
      ctx.fillText("Q", lblX, lblY);
      const qw = ctx.measureText("Q").width;
      setFont(ctx, 9, "800");
      ctx.fillText("C", lblX + qw + 1 * d, lblY + 3.5 * d);
      const cw = ctx.measureText("C").width;
      setFont(ctx, 11.5, "700");
      ctx.fillStyle = theme.tx;
      ctx.fillText(
        "(V) = (" + activeSteps + "/3) · V²  — Square-Law Curve",
        lblX + qw + cw + 3 * d,
        lblY,
      );
      ctx.restore();

      // Update 3-Column KPI Strip & APFC kVAR Header Badge
      if (qValEl) {
        qValEl.textContent =
          Q.toFixed(2) + " pu (" + Math.round(Q * 300) + " kVAR)";
        qValEl.style.color = theme.cap;
      }
      if (pfValEl && pfPillEl) {
        const isGood = pf >= 0.9;
        pfValEl.textContent =
          pf.toFixed(2) + (isGood ? " Optimal" : " Lagging");
        pfValEl.style.color = isGood ? theme.ok : theme.s;
        pfPillEl.style.borderColor = isGood ? theme.ok : theme.s;
      }
      if (stepValEl) {
        stepValEl.textContent = activeSteps + " / 3 Steps ON";
      }
      const kvarMeter = document.getElementById("apfc-kvar-meter");
      if (kvarMeter) {
        kvarMeter.textContent =
          "Active Output: " + activeSteps * 100 + " / 300 kVAR";
      }
    }

    slider.addEventListener("input", () => {
      updateSliderLabel(slider, slider.value);
      draw();
    });
    window.addEventListener("capstageschange", () => draw());

    window.addEventListener("resize", () => {
      if (active) draw();
    });
    window.addEventListener("themechange", () => {
      theme = getTheme();
      if (active) draw();
    });

    bindSlideLifecycle(
      root,
      () => {
        active = true;
        draw();
      },
      () => {
        active = false;
      },
    );

    draw();
  }

  /* ================================================================
   *  Widget 3 — TCR Oscilloscope  (#widget-tcr-scope)
   * ================================================================ */

  function initTCRScope() {
    const root = document.getElementById("widget-tcr-scope");
    if (!root) return;
    root.style.cssText = (root.style.cssText || "") + ";position:relative;";

    const canvas = document.createElement("canvas");
    root.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const slider = createSlider(root, {
      min: 90,
      max: 180,
      step: 1,
      value: 120,
      label: "Firing Angle (α)",
      unit: "°",
    });

    // Full-width 2-column live KPI strip below the slider (proper mathematical subscripts)
    const kpiStrip = document.createElement("div");
    kpiStrip.className = "cap-kpi-strip";
    kpiStrip.style.gridTemplateColumns = "repeat(2, 1fr)";
    kpiStrip.innerHTML =
      '<div class="cap-kpi-pill">' +
      '<span class="cap-kpi-label">Conduction Angle (σ = 2(π − α))</span>' +
      '<span class="cap-kpi-val" id="tcr-kpi-sigma">120°</span>' +
      "</div>" +
      '<div class="cap-kpi-pill">' +
      '<span class="cap-kpi-label">Inductive Susceptance (<i>B</i><sub>TCR</sub>)</span>' +
      '<span class="cap-kpi-val" id="tcr-kpi-b">0.391 pu</span>' +
      "</div>";
    root.appendChild(kpiStrip);

    const sigmaValEl = kpiStrip.querySelector("#tcr-kpi-sigma");
    const bValEl = kpiStrip.querySelector("#tcr-kpi-b");

    let theme = getTheme();
    let active = false;

    function draw() {
      const { w, h } = fitCanvas(canvas, 2.15);
      const d = DPR;
      const alpha = +slider.value * DEG;

      // Dark oscilloscope background
      ctx.fillStyle = "#0a0e17";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const ml = 46 * d,
        mr = 26 * d,
        mt = 24 * d,
        mb = 30 * d;
      const gw = w * d - ml - mr;
      const gh = h * d - mt - mb;
      const cy = mt + gh / 2;

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 0.8 * d;
      const cols = 12,
        rows = 8;
      for (let i = 0; i <= cols; i++) {
        const x = ml + (i / cols) * gw;
        ctx.beginPath();
        ctx.moveTo(x, mt);
        ctx.lineTo(x, mt + gh);
        ctx.stroke();
      }
      for (let i = 0; i <= rows; i++) {
        const y = mt + (i / rows) * gh;
        ctx.beginPath();
        ctx.moveTo(ml, y);
        ctx.lineTo(ml + gw, y);
        ctx.stroke();
      }

      // Center axis
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1 * d;
      ctx.beginPath();
      ctx.moveTo(ml, cy);
      ctx.lineTo(ml + gw, cy);
      ctx.stroke();

      // Map theta to x, amplitude to y
      const px = (theta) => ml + (theta / TAU) * gw;
      const py = (amp) => cy - amp * (gh * 0.42);

      // Voltage trace (cyan/indigo)
      ctx.beginPath();
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 2.1 * d;
      ctx.globalAlpha = 0.82;
      const steps = 500;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * TAU;
        const v = Math.sin(theta);
        const x = px(theta),
          y = py(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // TCR current trace (amber)
      ctx.beginPath();
      ctx.strokeStyle = "#FBBF24";
      ctx.lineWidth = 2.6 * d;
      const cosAlpha = Math.cos(alpha);
      let started = false;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * TAU;
        let iVal = 0;
        if (theta >= alpha && theta <= PI) {
          iVal = cosAlpha - Math.cos(theta);
        } else if (theta >= PI + alpha && theta <= TAU) {
          iVal = -(cosAlpha - Math.cos(theta - PI));
        }

        const x = px(theta),
          y = py(iVal * 0.82);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Gate trigger lines (green vertical pulses)
      ctx.strokeStyle = "#34D399";
      ctx.lineWidth = 1.8 * d;
      ctx.setLineDash([3.5 * d, 3.5 * d]);
      let tx = px(alpha);
      ctx.beginPath();
      ctx.moveTo(tx, mt);
      ctx.lineTo(tx, mt + gh);
      ctx.stroke();
      tx = px(PI + alpha);
      if (tx <= ml + gw) {
        ctx.beginPath();
        ctx.moveTo(tx, mt);
        ctx.lineTo(tx, mt + gh);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Trigger labels
      setFont(ctx, 10, "700");
      ctx.fillStyle = "#34D399";
      ctx.textAlign = "center";
      ctx.fillText("α", px(alpha), mt - 5 * d);
      if (px(PI + alpha) <= ml + gw) {
        ctx.fillText("π + α", px(PI + alpha), mt - 5 * d);
      }

      // Legend with proper subscript i_TCR(θ) (no underscore)
      const legX = ml + gw - 105 * d;
      setFont(ctx, 11, "700");
      ctx.textAlign = "left";
      ctx.fillStyle = "#38BDF8";
      ctx.fillText("— v(θ)", legX, mt + 15 * d);

      ctx.fillStyle = "#FBBF24";
      ctx.fillText("— i", legX, mt + 31 * d);
      const iw = ctx.measureText("— i").width;
      setFont(ctx, 8.2, "800");
      ctx.fillText("TCR", legX + iw + 0.5 * d, mt + 34 * d);
      const tw = ctx.measureText("TCR").width;
      setFont(ctx, 11, "700");
      ctx.fillText("(θ)", legX + iw + tw + 1.5 * d, mt + 31 * d);

      // Update 2-column KPI Strip
      const sigma = 2 * (PI - alpha);
      const sigmaDeg = sigma / DEG;
      const B = 2 - (2 * alpha) / PI + Math.sin(2 * alpha) / PI;
      if (sigmaValEl) {
        sigmaValEl.textContent = sigmaDeg.toFixed(0) + "°";
        sigmaValEl.style.color = theme.svc;
      }
      if (bValEl) {
        bValEl.textContent = B.toFixed(3) + " pu";
        bValEl.style.color = theme.p;
      }
    }

    slider.addEventListener("input", () => {
      updateSliderLabel(slider, slider.value);
      draw();
    });

    window.addEventListener("resize", () => {
      if (active) draw();
    });
    window.addEventListener("themechange", () => {
      theme = getTheme();
      if (active) draw();
    });

    bindSlideLifecycle(
      root,
      () => {
        active = true;
        draw();
      },
      () => {
        active = false;
      },
    );

    draw();
  }

  /* ================================================================
   *  Widget 4 — SVC V-I Characteristic  (#widget-svc-vi)
   * ================================================================ */

  function initSVCVI() {
    const root = document.getElementById("widget-svc-vi");
    if (!root) return;
    root.style.cssText = (root.style.cssText || "") + ";position:relative;";

    const canvas = document.createElement("canvas");
    root.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const btnRow = createBadgeRow(root);
    btnRow.style.justifyContent = "center";
    btnRow.style.padding = "6px 0 2px";
    const btn = createButton(btnRow, "Simulate Heavy Inductive Load Drop");

    // Full-width 3-column live KPI strip below the action button
    const kpiStrip = document.createElement("div");
    kpiStrip.className = "cap-kpi-strip";
    kpiStrip.innerHTML =
      '<div class="cap-kpi-pill">' +
      '<span class="cap-kpi-label">Bus Voltage (<i>V</i>)</span>' +
      '<span class="cap-kpi-val" id="svc-kpi-v">1.00 pu</span>' +
      "</div>" +
      '<div class="cap-kpi-pill">' +
      '<span class="cap-kpi-label">SVC Current (<i>I</i><sub>SVC</sub>)</span>' +
      '<span class="cap-kpi-val" id="svc-kpi-i">0.00 pu</span>' +
      "</div>" +
      '<div class="cap-kpi-pill" id="svc-kpi-zone-pill">' +
      '<span class="cap-kpi-label">Operating Zone</span>' +
      '<span class="cap-kpi-val" id="svc-kpi-zone">Linear Control</span>' +
      "</div>";
    root.appendChild(kpiStrip);

    const vValEl = kpiStrip.querySelector("#svc-kpi-v");
    const iValEl = kpiStrip.querySelector("#svc-kpi-i");
    const zonePillEl = kpiStrip.querySelector("#svc-kpi-zone-pill");
    const zoneValEl = kpiStrip.querySelector("#svc-kpi-zone");

    let theme = getTheme();
    let active = false;

    // Operating point: I in [-1.45, 1.45], where negative = capacitive, positive = inductive
    let opI = 0,
      opV = 1.0;
    let animTarget = null;
    let animFrame = null;

    // Continuous piecewise-linear SVC V-I characteristic parameters
    // V(I) is strictly continuous at both knees Icap = -1.0 and Iind = +1.0!
    const Vref = 1.0;
    const slope = 0.04; // 4% droop slope in linear control zone [-1.0, +1.0]
    const Icap = -1.0; // capacitive limit knee: V_capKnee = 1.0 - 0.04 = 0.96 pu
    const Iind = 1.0; // inductive limit knee:  V_indKnee = 1.0 + 0.04 = 1.04 pu
    const slopeCap = 0.72; // capacitive limit slope (V drops along fixed B_Cmax)
    const slopeInd = 0.42; // inductive limit slope (V rises along fixed B_Lmax)

    function svcV(I) {
      const vCapKnee = Vref + slope * Icap; // 0.96 pu
      const vIndKnee = Vref + slope * Iind; // 1.04 pu
      if (I < Icap) {
        return vCapKnee + slopeCap * (I - Icap);
      } else if (I > Iind) {
        return vIndKnee + slopeInd * (I - Iind);
      } else {
        return Vref + slope * I;
      }
    }

    function draw() {
      const { w, h } = fitCanvas(canvas, 2.08);
      const d = DPR;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const ml = 56 * d,
        mr = 32 * d,
        mt = 26 * d,
        mb = 42 * d;
      const gw = w * d - ml - mr;
      const gh = h * d - mt - mb;
      const centerX = ml + gw / 2;

      // Axes ranges
      const iMin = -1.5,
        iMax = 1.5;
      const vMin = 0.55,
        vMax = 1.3;
      const px = (i) => ml + ((i - iMin) / (iMax - iMin)) * gw;
      const py = (v) => mt + gh - ((v - vMin) / (vMax - vMin)) * gh;

      // Grid
      ctx.strokeStyle = theme.surf;
      ctx.lineWidth = 0.8 * d;
      for (let i = -1.5; i <= 1.5; i += 0.5) {
        const x = px(i);
        ctx.beginPath();
        ctx.moveTo(x, mt);
        ctx.lineTo(x, mt + gh);
        ctx.stroke();
      }
      for (let v = 0.6; v <= 1.25; v += 0.1) {
        const y = py(v);
        ctx.beginPath();
        ctx.moveTo(ml, y);
        ctx.lineTo(ml + gw, y);
        ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = theme.mut;
      ctx.lineWidth = 1.5 * d;
      ctx.beginPath();
      ctx.moveTo(ml, mt + gh);
      ctx.lineTo(ml + gw, mt + gh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX, mt);
      ctx.lineTo(centerX, mt + gh);
      ctx.stroke();

      // V_ref dashed line with proper subscript
      ctx.setLineDash([5 * d, 4 * d]);
      ctx.strokeStyle = theme.mut;
      ctx.lineWidth = 1.1 * d;
      const vrefY = py(Vref);
      ctx.beginPath();
      ctx.moveTo(ml, vrefY);
      ctx.lineTo(ml + gw, vrefY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.fillStyle = theme.mut;
      ctx.textAlign = "left";
      setFont(ctx, 10.5, "800");
      ctx.fillText("V", ml + 6 * d, vrefY - 6 * d);
      const vw = ctx.measureText("V").width;
      setFont(ctx, 8, "700");
      ctx.fillText("ref", ml + 6 * d + vw + 0.5 * d, vrefY - 3 * d);
      ctx.restore();

      // Exact knee coordinates for seamless continuous piecewise-linear segments
      const xStart = px(-1.45),
        yStart = py(svcV(-1.45));
      const xCap = px(Icap),
        yCap = py(svcV(Icap));
      const xInd = px(Iind),
        yInd = py(svcV(Iind));
      const xEnd = px(1.45),
        yEnd = py(svcV(1.45));

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // 1. Capacitive Limit Segment (Left)
      ctx.beginPath();
      ctx.strokeStyle = theme.cap;
      ctx.lineWidth = 3.2 * d;
      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xCap, yCap);
      ctx.stroke();

      // 2. Linear Voltage Control Droop Segment (Center — meets exact knees)
      ctx.beginPath();
      ctx.strokeStyle = theme.ok;
      ctx.lineWidth = 3.6 * d;
      ctx.moveTo(xCap, yCap);
      ctx.lineTo(xInd, yInd);
      ctx.stroke();

      // 3. Inductive Limit Segment (Right — meets exact knee)
      ctx.beginPath();
      ctx.strokeStyle = theme.sc;
      ctx.lineWidth = 3.2 * d;
      ctx.moveTo(xInd, yInd);
      ctx.lineTo(xEnd, yEnd);
      ctx.stroke();

      // Knee transition dots at I_Cmax and I_Lmax
      [
        { x: xCap, y: yCap, c: theme.cap },
        { x: xInd, y: yInd, c: theme.sc },
      ].forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4 * d, 0, TAU);
        ctx.fillStyle = pt.c;
        ctx.fill();
      });

      // Region labels
      setFont(ctx, 10.5, "700");
      ctx.textAlign = "center";
      ctx.fillStyle = theme.cap;
      ctx.fillText("Capacitive Limit", px(-1.22), mt + 16 * d);
      ctx.fillStyle = theme.ok;
      ctx.fillText("Linear Droop Control", centerX, mt + 16 * d);
      ctx.fillStyle = theme.sc;
      ctx.fillText("Inductive Limit", px(1.22), mt + 16 * d);

      // X-axis label with proper subscript I_SVC (pu)
      ctx.save();
      ctx.fillStyle = theme.mut;
      ctx.textAlign = "left";
      setFont(ctx, 10.5, "700");
      const baseStr = "I";
      const subStr = "SVC";
      const sufStr = " (pu)";
      const bw = ctx.measureText(baseStr).width;
      setFont(ctx, 8, "700");
      const sw = ctx.measureText(subStr).width;
      setFont(ctx, 10.5, "600");
      const fw = ctx.measureText(sufStr).width;
      const sx = centerX - (bw + sw + fw) / 2;
      const sy = mt + gh + 32 * d;
      setFont(ctx, 10.5, "800");
      ctx.fillText(baseStr, sx, sy);
      setFont(ctx, 8, "800");
      ctx.fillText(subStr, sx + bw + 0.5 * d, sy + 3 * d);
      setFont(ctx, 10.5, "600");
      ctx.fillText(sufStr, sx + bw + sw + 1 * d, sy);
      ctx.restore();

      setFont(ctx, 10, "600");
      ctx.fillStyle = theme.cap;
      ctx.textAlign = "left";
      ctx.fillText("← Capacitive (−I)", ml, mt + gh + 18 * d);
      ctx.fillStyle = theme.sc;
      ctx.textAlign = "right";
      ctx.fillText("Inductive (+I) →", ml + gw, mt + gh + 18 * d);

      ctx.save();
      ctx.translate(18 * d, mt + gh / 2);
      ctx.rotate(-PI / 2);
      ctx.textAlign = "center";
      setFont(ctx, 10.5, "700");
      ctx.fillStyle = theme.mut;
      ctx.fillText("Bus Voltage V (pu)", 0, 0);
      ctx.restore();

      // Operating point
      const opPx = px(opI);
      const opPy = py(opV);
      const opColor = opI < Icap ? theme.cap : opI > Iind ? theme.sc : theme.ok;

      // Glow
      const grad = ctx.createRadialGradient(opPx, opPy, 0, opPx, opPy, 18 * d);
      grad.addColorStop(0, opColor);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.38;
      ctx.fillRect(opPx - 20 * d, opPy - 20 * d, 40 * d, 40 * d);
      ctx.globalAlpha = 1;

      // Dot
      ctx.beginPath();
      ctx.arc(opPx, opPy, 7.5 * d, 0, TAU);
      ctx.fillStyle = opColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(opPx, opPy, 3.5 * d, 0, TAU);
      ctx.fillStyle = theme.bg;
      ctx.fill();

      // Update 3-Column Live KPI Strip
      const region =
        opI <= Icap + 0.01
          ? "Capacitive Limit"
          : opI >= Iind - 0.01
            ? "Inductive Limit"
            : "Linear Control";
      if (vValEl) vValEl.textContent = opV.toFixed(2) + " pu";
      if (iValEl) {
        iValEl.textContent = (opI > 0 ? "+" : "") + opI.toFixed(2) + " pu";
        iValEl.style.color = opColor;
      }
      if (zoneValEl && zonePillEl) {
        zoneValEl.textContent = region;
        zoneValEl.style.color = opColor;
        zonePillEl.style.borderColor = opColor;
      }
    }

    function animateOp() {
      if (!animTarget) return;
      const speed = 0.015;
      let changed = false;

      if (Math.abs(opI - animTarget.i) > 0.005) {
        opI += (animTarget.i - opI) * speed * 3;
        changed = true;
      } else {
        opI = animTarget.i;
      }
      opV = svcV(opI);

      draw();
      if (changed) {
        animFrame = requestAnimationFrame(animateOp);
      } else {
        // Recovery: animate back to center
        if (animTarget.phase === "drop") {
          setTimeout(() => {
            animTarget = { i: 0, phase: "recover" };
            animFrame = requestAnimationFrame(animateOp);
          }, 800);
        } else {
          animTarget = null;
        }
      }
    }

    btn.addEventListener("click", () => {
      if (animFrame) cancelAnimationFrame(animFrame);
      opI = 0;
      opV = 1.0;
      animTarget = { i: -1.4, phase: "drop" };
      animFrame = requestAnimationFrame(animateOp);
    });

    window.addEventListener("resize", () => {
      if (active) draw();
    });
    window.addEventListener("themechange", () => {
      theme = getTheme();
      if (active) draw();
    });

    bindSlideLifecycle(
      root,
      () => {
        active = true;
        draw();
      },
      () => {
        active = false;
        if (animFrame) cancelAnimationFrame(animFrame);
      },
    );

    draw();
  }

  /* ================================================================
   *  Widget 5 — STATCOM Phasors  (#widget-statcom-phasors)
   * ================================================================ */

  function initSTATCOMPhasors() {
    const root = document.getElementById("widget-statcom-phasors");
    if (!root) return;
    root.style.cssText = (root.style.cssText || "") + ";position:relative;";

    const canvas = document.createElement("canvas");
    root.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const slider = createSlider(root, {
      min: 0.8,
      max: 1.2,
      step: 0.01,
      value: 1.12,
      label: "Converter V",
      unit: " pu",
    });
    const sliderLbl = root.querySelector(".widget-slider-wrap span");
    if (sliderLbl) {
      sliderLbl.innerHTML = "Converter (<i>V</i><sub>conv</sub>)";
    }

    // Full-width 3-column live KPI strip below the slider
    const kpiStrip = document.createElement("div");
    kpiStrip.className = "cap-kpi-strip";
    kpiStrip.innerHTML =
      '<div class="cap-kpi-pill">' +
      '<span class="cap-kpi-label">Converter (<i>V</i><sub>conv</sub>)</span>' +
      '<span class="cap-kpi-val" id="stat-kpi-vconv">1.12 pu</span>' +
      "</div>" +
      '<div class="cap-kpi-pill">' +
      '<span class="cap-kpi-label">Reactive Output (<i>Q</i><sub>STAT</sub>)</span>' +
      '<span class="cap-kpi-val" id="stat-kpi-q">+0.60 pu</span>' +
      "</div>" +
      '<div class="cap-kpi-pill" id="stat-kpi-mode-pill">' +
      '<span class="cap-kpi-label">Operating Mode</span>' +
      '<span class="cap-kpi-val" id="stat-kpi-mode">Capacitive (+Q)</span>' +
      "</div>";
    root.appendChild(kpiStrip);

    const vconvValEl = kpiStrip.querySelector("#stat-kpi-vconv");
    const qValEl = kpiStrip.querySelector("#stat-kpi-q");
    const modePillEl = kpiStrip.querySelector("#stat-kpi-mode-pill");
    const modeValEl = kpiStrip.querySelector("#stat-kpi-mode");

    let theme = getTheme();
    let active = false;

    /** Helper to draw variable with proper subscript + suffix on canvas (never underscores). */
    function drawSubVar(c, base, sub, suffix, x, y, color, baseSize, align) {
      c.save();
      c.fillStyle = color;
      c.textAlign = "left";
      setFont(c, baseSize, "800");
      const bw = c.measureText(base).width;
      setFont(c, baseSize * 0.74, "800");
      const sw = c.measureText(sub).width;
      setFont(c, baseSize, "700");
      const fw = suffix ? c.measureText(suffix).width : 0;
      const totalW = bw + sw + fw + 1 * DPR;

      let startX = x;
      if (align === "center") startX = x - totalW / 2;
      else if (align === "right") startX = x - totalW;

      setFont(c, baseSize, "800");
      c.fillText(base, startX, y);
      setFont(c, baseSize * 0.74, "800");
      c.fillText(sub, startX + bw + 0.5 * DPR, y + 3.2 * DPR);
      if (suffix) {
        setFont(c, baseSize, "700");
        c.fillText(suffix, startX + bw + sw + 1.2 * DPR, y);
      }
      c.restore();
    }

    function draw() {
      const { w, h } = fitCanvas(canvas, 2.15);
      const d = DPR;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const Vgrid = 1.0;
      const Vconv = +slider.value;
      const dV = Vconv - Vgrid;
      const Xl = 0.2; // leakage reactance pu
      const Iq = dV / Xl;
      const Q = Vgrid * Iq;
      const isCap = dV > 0.005;
      const isInd = dV < -0.005;
      const isZero = !isCap && !isInd;
      const modeCol = isCap ? theme.cap : isInd ? theme.sc : theme.ok;

      // 1. Left 52%: Phasor Diagram with zero label collisions
      const phasorW = w * d * 0.52;
      const phasorCx = phasorW * 0.5;
      const phasorCy = h * d * 0.66;
      const scale = Math.min((phasorCy - 36 * d) / 1.22, phasorW * 0.36);

      // Reference circle (dashed)
      ctx.save();
      ctx.setLineDash([3.5 * d, 3.5 * d]);
      ctx.strokeStyle = theme.mut;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1.2 * d;
      ctx.beginPath();
      ctx.arc(phasorCx, phasorCy, scale * Vgrid, 0, TAU);
      ctx.stroke();
      ctx.restore();

      // Slight horizontal separation between V_grid and V_conv shafts so both vectors are distinct
      const vgX = phasorCx - 4 * d;
      const vcX = phasorCx + 4 * d;
      const vgEnd = { x: vgX, y: phasorCy - scale * Vgrid };
      const vcEnd = { x: vcX, y: phasorCy - scale * Vconv };

      // V_grid phasor (pointing up, indigo/cyan)
      drawArrow(ctx, vgX, phasorCy, vgEnd.x, vgEnd.y, theme.p, 3 * d, 10 * d);
      // Place V_grid label cleanly on the LEFT side of the V_grid shaft (below tip so it never collides with V_conv)
      const vgLblY = isCap ? vgEnd.y + 18 * d : vgEnd.y - 6 * d;
      drawSubVar(
        ctx,
        "V",
        "grid",
        " (1.0 pu)",
        vgX - 10 * d,
        vgLblY,
        theme.p,
        10.5,
        "right",
      );

      // V_conv phasor (pointing up, purple)
      drawArrow(
        ctx,
        vcX,
        phasorCy,
        vcEnd.x,
        vcEnd.y,
        theme.stat,
        3 * d,
        10 * d,
      );
      // Place V_conv label cleanly above/left of its tip when V_conv >= V_grid, or left-mid when V_conv < V_grid
      const vcLblY = isCap
        ? Math.max(16 * d, vcEnd.y - 6 * d)
        : vcEnd.y + 18 * d;
      drawSubVar(
        ctx,
        "V",
        "conv",
        " (" + Vconv.toFixed(2) + ")",
        vcX - 10 * d,
        vcLblY,
        theme.stat,
        10.5,
        "right",
      );

      // ΔV bracket & offset arrow cleanly on the RIGHT side
      if (!isZero) {
        const brkX = phasorCx + 22 * d;
        ctx.save();
        ctx.setLineDash([2.5 * d, 2.5 * d]);
        ctx.strokeStyle = modeCol;
        ctx.lineWidth = 1.2 * d;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(vgX, vgEnd.y);
        ctx.lineTo(brkX + 4 * d, vgEnd.y);
        ctx.moveTo(vcX, vcEnd.y);
        ctx.lineTo(brkX + 4 * d, vcEnd.y);
        ctx.stroke();
        ctx.restore();

        drawArrow(ctx, brkX, vgEnd.y, brkX, vcEnd.y, modeCol, 2.2 * d, 7.5 * d);
        setFont(ctx, 10.5, "800");
        ctx.fillStyle = modeCol;
        ctx.textAlign = "left";
        ctx.fillText(
          "ΔV = " + (dV >= 0 ? "+" : "") + dV.toFixed(2),
          brkX + 8 * d,
          (vgEnd.y + vcEnd.y) / 2 + 4 * d,
        );
      }

      // I_q phasor (90° to V_grid: Left = Leading Capacitive, Right = Lagging Inductive)
      if (!isZero) {
        const iScale = Math.min(Math.abs(Iq) * scale * 0.52, phasorW * 0.38);
        const iDir = isCap ? -1 : 1;
        const iEnd = { x: phasorCx + iDir * iScale, y: phasorCy };
        drawArrow(
          ctx,
          phasorCx,
          phasorCy,
          iEnd.x,
          iEnd.y,
          modeCol,
          2.8 * d,
          9.5 * d,
        );
        drawSubVar(
          ctx,
          "I",
          "q",
          isCap ? " (+90° Lead)" : " (−90° Lag)",
          iEnd.x,
          phasorCy + 20 * d,
          modeCol,
          10.5,
          "center",
        );
      }

      // Origin dot
      ctx.beginPath();
      ctx.arc(phasorCx, phasorCy, 4 * d, 0, TAU);
      ctx.fillStyle = theme.tx;
      ctx.fill();

      // 2. Right 46%: Sleek Dark-Themed SPWM Carrier Comparison & Pulse Train Scope + Telemetry
      const pwmX = phasorW + 8 * d;
      const pwmW = w * d - pwmX - 12 * d;
      const pwmY = 14 * d;
      const pwmH = h * d * 0.56;

      // Dark scope panel
      ctx.save();
      ctx.fillStyle = "#0B101E";
      ctx.beginPath();
      ctx.roundRect(pwmX, pwmY, pwmW, pwmH, 10 * d);
      ctx.fill();
      ctx.strokeStyle = "rgba(192,132,252,0.40)";
      ctx.lineWidth = 1.4 * d;
      ctx.stroke();

      // Header inside dark SPWM scope
      setFont(ctx, 9.5, "800");
      ctx.fillStyle = "#C084FC";
      ctx.textAlign = "left";
      ctx.fillText("SPWM CARRIER & GATE PULSES", pwmX + 10 * d, pwmY + 15 * d);

      // Upper sub-plot: Triangular Carrier vs Reference Sine Wave (Modulation m_a)
      const padX = pwmX + 10 * d;
      const plotW = pwmW - 20 * d;
      const topMidY = pwmY + pwmH * 0.38;
      const topAmp = pwmH * 0.16;
      const botMidY = pwmY + pwmH * 0.78;
      const botAmp = pwmH * 0.13;

      // Center zero lines
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 0.9 * d;
      ctx.beginPath();
      ctx.moveTo(padX, topMidY);
      ctx.lineTo(padX + plotW, topMidY);
      ctx.moveTo(padX, botMidY);
      ctx.lineTo(padX + plotW, botMidY);
      ctx.stroke();

      // Modulation index m_a proportional to V_conv (0.8..1.2 -> m_a 0.52..0.96)
      const ma = 0.52 + ((Vconv - 0.8) / 0.4) * 0.44;
      const nCarriers = 7;
      const samples = 280;

      // Triangular carrier wave
      ctx.beginPath();
      ctx.strokeStyle = "rgba(148,163,184,0.55)";
      ctx.lineWidth = 1.2 * d;
      for (let s = 0; s <= samples; s++) {
        const u = s / samples;
        const tri =
          1 -
          4 *
            Math.abs(Math.round(u * nCarriers - 0.25) - (u * nCarriers - 0.25));
        const x = padX + u * plotW;
        const y = topMidY - tri * topAmp;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fundamental reference sine wave v_ref(t)
      ctx.beginPath();
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 2 * d;
      for (let s = 0; s <= samples; s++) {
        const u = s / samples;
        const ref = ma * Math.sin(u * TAU);
        const x = padX + u * plotW;
        const y = topMidY - ref * topAmp;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Lower sub-plot: Resulting Bipolar SPWM Pulse Train (v_ref >= v_tri)
      ctx.beginPath();
      ctx.strokeStyle = "#C084FC";
      ctx.lineWidth = 1.9 * d;
      let prevHigh = null;
      for (let s = 0; s <= samples; s++) {
        const u = s / samples;
        const tri =
          1 -
          4 *
            Math.abs(Math.round(u * nCarriers - 0.25) - (u * nCarriers - 0.25));
        const ref = ma * Math.sin(u * TAU);
        const isHigh = ref >= tri;
        const x = padX + u * plotW;
        const y = botMidY - (isHigh ? 1 : -1) * botAmp;
        if (s === 0) {
          ctx.moveTo(x, y);
        } else {
          if (isHigh !== prevHigh) {
            ctx.lineTo(x, botMidY - (prevHigh ? 1 : -1) * botAmp);
          }
          ctx.lineTo(x, y);
        }
        prevHigh = isHigh;
      }
      ctx.stroke();
      ctx.restore();

      // Bottom-right Telemetry Summary (with proper subscripts — no underscores)
      const infoY = pwmY + pwmH + 22 * d;
      drawSubVar(
        ctx,
        "V",
        "conv",
        " = " + Vconv.toFixed(2) + " pu",
        pwmX + 4 * d,
        infoY,
        theme.stat,
        11,
        "left",
      );
      drawSubVar(
        ctx,
        "V",
        "grid",
        " = " + Vgrid.toFixed(2) + " pu",
        pwmX + pwmW * 0.54,
        infoY,
        theme.p,
        11,
        "left",
      );

      setFont(ctx, 11, "700");
      ctx.fillStyle = modeCol;
      ctx.textAlign = "left";
      ctx.fillText(
        "ΔV = " + (dV >= 0 ? "+" : "") + dV.toFixed(2) + " pu",
        pwmX + 4 * d,
        infoY + 22 * d,
      );
      drawSubVar(
        ctx,
        "I",
        "q",
        " = " + (Iq >= 0 ? "+" : "") + Iq.toFixed(2) + " pu",
        pwmX + pwmW * 0.54,
        infoY + 22 * d,
        modeCol,
        11,
        "left",
      );

      // Update 3-Column Live KPI Strip
      if (vconvValEl) {
        vconvValEl.textContent = Vconv.toFixed(2) + " pu";
        vconvValEl.style.color = theme.stat;
      }
      if (qValEl) {
        qValEl.textContent = (Q >= 0 ? "+" : "") + Q.toFixed(2) + " pu";
        qValEl.style.color = modeCol;
      }
      if (modeValEl && modePillEl) {
        modeValEl.textContent = isZero
          ? "Unity PF (Q = 0)"
          : isCap
            ? "Capacitive (+Q)"
            : "Inductive (−Q)";
        modeValEl.style.color = modeCol;
        modePillEl.style.borderColor = modeCol;
      }
    }

    slider.addEventListener("input", () => {
      updateSliderLabel(slider, slider.value);
      draw();
    });

    window.addEventListener("resize", () => {
      if (active) draw();
    });
    window.addEventListener("themechange", () => {
      theme = getTheme();
      if (active) draw();
    });

    bindSlideLifecycle(
      root,
      () => {
        active = true;
        draw();
      },
      () => {
        active = false;
      },
    );

    draw();
  }

  /* ================================================================
   *  Widget 6 — Voltage Sag Test  (#widget-voltage-sag)
   * ================================================================ */

  function initVoltageSagTest() {
    const root = document.getElementById("widget-voltage-sag");
    if (!root) return;
    root.style.cssText = (root.style.cssText || "") + ";position:relative;";

    const canvas = document.createElement("canvas");
    root.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const slider = createSlider(root, {
      min: 0.5,
      max: 1.0,
      step: 0.01,
      value: 0.70,
      label: "V_grid",
      unit: " pu",
    });
    const sliderLbl = root.querySelector(".widget-slider-wrap span");
    if (sliderLbl) {
      sliderLbl.innerHTML = "Grid Voltage (<i>V</i><sub>grid</sub>)";
    }

    // Action bar with explicit "Run Response Race" trigger button
    const raceRow = document.createElement("div");
    raceRow.className = "race-action-row";
    raceRow.innerHTML =
      '<span class="race-legend-note">Visual timing race scaled proportionally (true physical speed shown on right)</span>' +
      '<button type="button" class="race-trigger-btn" id="run-race-btn">▶ Run Response Race</button>';
    root.appendChild(raceRow);
    const runBtn = raceRow.querySelector("#run-race-btn");

    let theme = getTheme();
    let active = false;
    let raceStartTime = null;
    let raceAnimId = null;

    // Proportional visual animation durations (ms) so relative speed gap is clear
    const raceDurations = {
      cap: 3000,
      sc: 1650,
      svc: 600,
      stat: 220,
    };
    let raceProgress = { cap: 1, sc: 1, svc: 1, stat: 1 };

    // Q output models (pu of rated capacitive Q at V_grid)
    function qCap(V) {
      return V * V;
    }
    function qSC(V) {
      return Math.min(1.0, 0.95 + 0.3 * (1 - V));
    }
    function qSVC(V) {
      return V * V; // at capacitive limit: fixed susceptance B_Cmax
    }
    function qSTAT(V) {
      return V; // constant-current VSI: I_max sustained
    }

    const devices = [
      { key: "cap",  name: "Shunt Cap.",  speedLabel: "Sec – Min",  q: qCap,  themeKey: "cap"  },
      { key: "sc",   name: "Sync. Cond.", speedLabel: "100–500 ms", q: qSC,   themeKey: "sc"   },
      { key: "svc",  name: "SVC (TCR)",   speedLabel: "15–40 ms",   q: qSVC,  themeKey: "svc"  },
      { key: "stat", name: "STATCOM",     speedLabel: "< 10 ms",    q: qSTAT, themeKey: "stat" },
    ];

    function draw() {
      const { w, h } = fitCanvas(canvas, 1.56);
      const d = DPR;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const V = +slider.value;
      const ml = 24 * d,
        mr = 20 * d,
        mt = 22 * d;
      const totalW = w * d - ml - mr;

      // ── 1. Top Half: Q Output Bar Chart (with exact pu values on top) ──
      // Header: "Reactive Output at V_grid = 0.70 pu" with proper subscript
      ctx.save();
      ctx.textAlign = "left";
      setFont(ctx, 12.5, "800");
      ctx.fillStyle = theme.tx;
      const headPrefix = "Capacitive Output at V";
      const hw1 = ctx.measureText(headPrefix).width;
      ctx.fillText(headPrefix, ml, mt);
      setFont(ctx, 9.2, "800");
      ctx.fillStyle = theme.p;
      ctx.fillText("grid", ml + hw1 + 0.5 * d, mt + 3.5 * d);
      const hw2 = ctx.measureText("grid").width;
      setFont(ctx, 12.5, "800");
      ctx.fillStyle = theme.tx;
      ctx.fillText(" = " + V.toFixed(2) + " pu", ml + hw1 + hw2 + 1.5 * d, mt);
      ctx.restore();

      const chartTop = mt + 28 * d; // generous headroom so 1.00 pu never overlaps header
      const baseY = h * d * 0.45;
      const maxBarH = Math.max(baseY - chartTop, 56 * d);

      const barGap = 18 * d;
      const barCount = 4;
      const barW = (totalW - barGap * (barCount - 1)) / barCount;

      // Subtle dashed baseline
      ctx.save();
      ctx.strokeStyle = theme.mut;
      ctx.lineWidth = 1.2 * d;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(ml, baseY);
      ctx.lineTo(ml + totalW, baseY);
      ctx.stroke();
      ctx.restore();

      devices.forEach((dev, i) => {
        const x = ml + i * (barW + barGap);
        const qVal = dev.q(V);
        const barH = Math.max(qVal * maxBarH, 4 * d);
        const y = baseY - barH;
        const color = theme[dev.themeKey];

        // Bar fill
        ctx.save();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.88;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, [6 * d, 6 * d, 0, 0]);
        ctx.fill();
        ctx.restore();

        // Exact pu value directly on top of the bar (high contrast in both Light & Dark modes)
        setFont(ctx, 12, "800");
        ctx.fillStyle = theme.tx;
        ctx.textAlign = "center";
        ctx.fillText(qVal.toFixed(2) + " pu", x + barW / 2, y - 7 * d);

        // Percentage badge inside the bar if tall enough
        if (barH >= 24 * d) {
          setFont(ctx, 10.5, "800");
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(Math.round(qVal * 100) + "%", x + barW / 2, y + 16 * d);
        }

        // Device name cleanly below baseline
        setFont(ctx, 10.5, "800");
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.fillText(dev.name, x + barW / 2, baseY + 16 * d);
      });

      // Divider between Top Chart and Bottom Race
      const divY = baseY + 28 * d;
      ctx.save();
      ctx.strokeStyle = theme.mut;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1 * d;
      ctx.beginPath();
      ctx.moveTo(ml, divY);
      ctx.lineTo(ml + totalW, divY);
      ctx.stroke();
      ctx.restore();

      // ── 2. Bottom Half: Response Time Race (Name + Horizontal Animated Track + Timing) ──
      const raceHeaderY = divY + 18 * d;
      setFont(ctx, 12.5, "800");
      ctx.fillStyle = theme.tx;
      ctx.textAlign = "left";
      ctx.fillText("Response Time Race", ml, raceHeaderY);

      const lanesTop = raceHeaderY + 10 * d;
      const lanesH = h * d - lanesTop - 8 * d;
      const laneGap = 7 * d;
      const laneH = Math.max((lanesH - laneGap * 3) / 4, 14 * d);

      const labelColW = 86 * d;
      const timeColW = 76 * d;
      const trackX = ml + labelColW;
      const trackW = Math.max(totalW - labelColW - timeColW, 80 * d);

      devices.forEach((dev, i) => {
        const y = lanesTop + i * (laneH + laneGap);
        const color = theme[dev.themeKey];
        const prog = raceProgress[dev.key];
        const midY = y + laneH / 2 + 4 * d;

        // Technology Name on the Left (next to track, never hidden)
        setFont(ctx, 10.5, "800");
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.fillText(dev.name, ml, midY);

        // Visible Track Background & Border (works in Pearl Light and Dark themes)
        ctx.save();
        ctx.fillStyle = "rgba(148, 163, 184, 0.16)";
        ctx.strokeStyle = "rgba(148, 163, 184, 0.36)";
        ctx.lineWidth = 1 * d;
        ctx.beginPath();
        ctx.roundRect(trackX, y, trackW, laneH, 6 * d);
        ctx.fill();
        ctx.stroke();

        // Animated Horizontal Progress Bar inside Track
        const fillW = Math.max(0, Math.min(prog, 1)) * trackW;
        if (fillW > 2 * d) {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.88;
          ctx.beginPath();
          ctx.roundRect(trackX, y, fillW, laneH, 6 * d);
          ctx.fill();
        }
        ctx.restore();

        // Right-aligned Timing Badge
        setFont(ctx, 10, prog >= 1 ? "800" : "600");
        ctx.fillStyle = prog >= 1 ? color : theme.mut;
        ctx.textAlign = "right";
        ctx.fillText(dev.speedLabel, ml + totalW, midY);
      });
    }

    function startRace() {
      if (raceAnimId) cancelAnimationFrame(raceAnimId);
      raceProgress = { cap: 0, sc: 0, svc: 0, stat: 0 };
      raceStartTime = performance.now();

      function tick(now) {
        const elapsed = now - raceStartTime;
        let allDone = true;
        for (const dev of devices) {
          const p = Math.min(elapsed / raceDurations[dev.key], 1);
          raceProgress[dev.key] = 1 - Math.pow(1 - p, 2.2);
          if (p < 1) allDone = false;
        }
        draw();
        if (!allDone && active) {
          raceAnimId = requestAnimationFrame(tick);
        } else {
          raceAnimId = null;
        }
      }
      raceAnimId = requestAnimationFrame(tick);
    }

    slider.addEventListener("input", () => {
      updateSliderLabel(slider, slider.value);
      draw();
    });

    if (runBtn) {
      runBtn.addEventListener("click", () => startRace());
    }

    window.addEventListener("resize", () => {
      if (active) draw();
    });
    window.addEventListener("themechange", () => {
      theme = getTheme();
      if (active) draw();
    });

    bindSlideLifecycle(
      root,
      () => {
        active = true;
        startRace();
      },
      () => {
        active = false;
        if (raceAnimId) {
          cancelAnimationFrame(raceAnimId);
          raceAnimId = null;
        }
      },
    );

    draw();
  }

  /* ================================================================
   *  Widget 7 — Synchronous Condenser V-Curve & Phasor (#widget-sc-vcurve)
   * ================================================================ */

  function initSCVCurve() {
    const root = document.getElementById("widget-sc-vcurve");
    if (!root) return;
    root.style.cssText = (root.style.cssText || "") + ";position:relative;";

    const canvas = document.createElement("canvas");
    root.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    const slider = createSlider(root, {
      min: 0.4,
      max: 1.8,
      step: 0.02,
      value: 1.36,
      label: "Field Current",
      unit: " pu",
    });
    // Use proper HTML subscript for I_f in the slider label
    const sliderLbl = root.querySelector(".widget-slider-wrap span");
    if (sliderLbl) {
      sliderLbl.innerHTML = "Field Current (<i>I</i><sub>f</sub>)";
    }

    // Full-width 3-column live KPI strip below the slider (proper mathematical subscripts)
    const kpiStrip = document.createElement("div");
    kpiStrip.className = "cap-kpi-strip";
    kpiStrip.innerHTML =
      '<div class="cap-kpi-pill" id="sc-kpi-mode-pill">' +
      '<span class="cap-kpi-label">Excitation Mode</span>' +
      '<span class="cap-kpi-val" id="sc-kpi-mode">Over-Excited (+Q)</span>' +
      "</div>" +
      '<div class="cap-kpi-pill">' +
      '<span class="cap-kpi-label">Reactive Output (<i>Q</i><sub>SC</sub>)</span>' +
      '<span class="cap-kpi-val" id="sc-kpi-q">+0.45 pu</span>' +
      "</div>" +
      '<div class="cap-kpi-pill">' +
      '<span class="cap-kpi-label">Stator Current (<i>I</i><sub>a</sub>)</span>' +
      '<span class="cap-kpi-val" id="sc-kpi-ia">0.47 pu</span>' +
      "</div>";
    root.appendChild(kpiStrip);

    const modePillEl = kpiStrip.querySelector("#sc-kpi-mode-pill");
    const modeValEl = kpiStrip.querySelector("#sc-kpi-mode");
    const qValEl = kpiStrip.querySelector("#sc-kpi-q");
    const iaValEl = kpiStrip.querySelector("#sc-kpi-ia");

    let theme = getTheme();
    let active = false;

    /** Helper to draw variable with proper subscript + suffix on canvas (never underscores). */
    function drawVarSub(c, base, sub, suffix, x, y, color, baseSize, align) {
      c.save();
      c.fillStyle = color;
      c.textAlign = "left";
      setFont(c, baseSize, "800");
      const bw = c.measureText(base).width;
      setFont(c, baseSize * 0.74, "800");
      const sw = c.measureText(sub).width;
      setFont(c, baseSize, "700");
      const fw = suffix ? c.measureText(suffix).width : 0;
      const totalW = bw + sw + fw + 1 * DPR;

      let startX = x;
      if (align === "center") startX = x - totalW / 2;
      else if (align === "right") startX = x - totalW;

      setFont(c, baseSize, "800");
      c.fillText(base, startX, y);
      setFont(c, baseSize * 0.74, "800");
      c.fillText(sub, startX + bw + 0.5 * DPR, y + 3.5 * DPR);
      if (suffix) {
        setFont(c, baseSize, "700");
        c.fillText(suffix, startX + bw + sw + 1.5 * DPR, y);
      }
      c.restore();
    }

    function draw() {
      const { w, h } = fitCanvas(canvas, 2.15);
      const d = DPR;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const If = +slider.value;
      const V = 1.0,
        Xs = 0.8,
        Ip = 0.12; // small active loss current
      const Ef = If; // 1.0 pu If => Ef = 1.0 pu
      const Iq = (Ef - V) / Xs; // positive = supplying Q (over-excited)
      const Ia = Math.sqrt(Ip * Ip + Iq * Iq);
      const Q = V * Iq;
      const isOver = If > 1.01;
      const isUnder = If < 0.99;
      const iaCol = isOver ? theme.sc : isUnder ? theme.p : theme.ok;

      // Left half: V-Curve (I_a vs I_f)
      const lw = w * d * 0.5;
      const ml = 46 * d,
        mr = 14 * d,
        mt = 24 * d,
        mb = 36 * d;
      const gw = lw - ml - mr;
      const gh = h * d - mt - mb;

      const ifMin = 0.3,
        ifMax = 1.9;
      const iaMin = 0,
        iaMax = 1.18;
      const px = (v) => ml + ((v - ifMin) / (ifMax - ifMin)) * gw;
      const py = (ia) => mt + gh - ((ia - iaMin) / (iaMax - iaMin)) * gh;

      // Subtle grid lines on V-curve plot
      ctx.strokeStyle = theme.surf;
      ctx.lineWidth = 0.8 * d;
      for (let f = 0.5; f <= 1.7; f += 0.3) {
        const gx = px(f);
        ctx.beginPath();
        ctx.moveTo(gx, mt);
        ctx.lineTo(gx, mt + gh);
        ctx.stroke();
      }
      for (let a = 0.2; a <= 1.0; a += 0.2) {
        const gy = py(a);
        ctx.beginPath();
        ctx.moveTo(ml, gy);
        ctx.lineTo(ml + gw, gy);
        ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = theme.mut;
      ctx.lineWidth = 1.4 * d;
      ctx.beginPath();
      ctx.moveTo(ml, mt);
      ctx.lineTo(ml, mt + gh);
      ctx.lineTo(ml + gw, mt + gh);
      ctx.stroke();

      // Y-axis label (I_a)
      drawVarSub(
        ctx,
        "I",
        "a",
        " (pu)",
        ml - 6 * d,
        mt + 10 * d,
        theme.mut,
        9.5,
        "right",
      );

      // Unity PF vertical dashed line at If = 1.0
      const ux = px(1.0);
      ctx.setLineDash([4 * d, 4 * d]);
      ctx.strokeStyle = theme.ok;
      ctx.lineWidth = 1.3 * d;
      ctx.beginPath();
      ctx.moveTo(ux, mt);
      ctx.lineTo(ux, mt + gh);
      ctx.stroke();
      ctx.setLineDash([]);
      setFont(ctx, 9.5, "700");
      ctx.fillStyle = theme.ok;
      ctx.textAlign = "center";
      ctx.fillText("Unity PF", ux, mt + 11 * d);

      // Draw V-curve
      ctx.beginPath();
      ctx.strokeStyle = theme.sc;
      ctx.lineWidth = 2.8 * d;
      for (let f = 0.4; f <= 1.8; f += 0.02) {
        const iq = (f - V) / Xs;
        const ia = Math.sqrt(Ip * Ip + iq * iq);
        const x = px(f),
          y = py(ia);
        if (f <= 0.41) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Region labels
      setFont(ctx, 9.5, "700");
      ctx.fillStyle = theme.p;
      ctx.textAlign = "left";
      ctx.fillText("Under-Excited (−Q)", ml + 5 * d, mt + 25 * d);
      ctx.fillStyle = theme.sc;
      ctx.textAlign = "right";
      ctx.fillText("Over-Excited (+Q)", ml + gw - 4 * d, mt + 25 * d);

      // Operating point on V-curve with crosshairs
      const dotX = px(If),
        dotY = py(Ia);
      ctx.save();
      ctx.setLineDash([3 * d, 3 * d]);
      ctx.strokeStyle = iaCol;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(dotX, mt + gh);
      ctx.lineTo(dotX, dotY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ml, dotY);
      ctx.lineTo(dotX, dotY);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(dotX, dotY, 6.5 * d, 0, TAU);
      ctx.fillStyle = iaCol;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3 * d, 0, TAU);
      ctx.fillStyle = theme.bg;
      ctx.fill();

      // X-axis label with proper subscript I_f
      drawVarSub(
        ctx,
        "Field Current I",
        "f",
        " (pu)",
        ml + gw / 2,
        mt + gh + 24 * d,
        theme.mut,
        10.5,
        "center",
      );

      // Right half: Live Phasor Diagram inside a clean framed inset (prevent any right-edge clipping)
      const boxX = lw + 8 * d;
      const boxY = 12 * d;
      const boxW = w * d - boxX - 10 * d;
      const boxH = h * d - 24 * d;
      ctx.save();
      ctx.fillStyle = theme.surf;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 10 * d);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = theme.mut;
      ctx.lineWidth = 1 * d;
      ctx.stroke();
      ctx.restore();

      setFont(ctx, 9.5, "800");
      ctx.fillStyle = theme.mut;
      ctx.textAlign = "center";
      ctx.fillText("PHASOR DIAGRAM", boxX + boxW / 2, boxY + 16 * d);

      // Position origin & scale so E_f up to 1.80 pu + label never clips the right border
      const rcx = boxX + 26 * d;
      const rcy = boxY + boxH * 0.58;
      const maxVecPixels = boxW - 118 * d; // leaves 92px on right for label text
      const pScale = Math.min(maxVecPixels / 1.8, boxH * 0.34);

      // Origin dot
      ctx.beginPath();
      ctx.arc(rcx, rcy, 3 * d, 0, TAU);
      ctx.fillStyle = theme.tx;
      ctx.fill();

      // Reference V phasor (horizontal right)
      const vEnd = { x: rcx + pScale * V, y: rcy };
      drawArrow(ctx, rcx, rcy, vEnd.x, vEnd.y, theme.tx, 2.5 * d, 8.5 * d);
      setFont(ctx, 11, "800");
      ctx.fillStyle = theme.tx;
      ctx.textAlign = "left";
      ctx.fillText("V (1.0 pu)", vEnd.x + 6 * d, vEnd.y + 4 * d);

      // I_a phasor (leading = up, lagging = down)
      const iaX = rcx + pScale * Ip * 1.45;
      const iaY = rcy - pScale * Iq * 0.82;
      drawArrow(ctx, rcx, rcy, iaX, iaY, iaCol, 2.6 * d, 8.5 * d);
      const iaTag = isOver
        ? " (Leads V)"
        : isUnder
          ? " (Lags V)"
          : " (In-Phase)";
      const iaLabelY = isOver
        ? Math.max(boxY + 30 * d, iaY - 4 * d)
        : Math.min(boxY + boxH - 10 * d, iaY + 12 * d);
      drawVarSub(
        ctx,
        "I",
        "a",
        iaTag,
        iaX + 6 * d,
        iaLabelY,
        iaCol,
        10.5,
        "left",
      );

      // E_f phasor (slightly angled above V due to power angle δ)
      const efX = rcx + pScale * Ef * 0.96;
      const efY = rcy - pScale * 0.24;
      drawArrow(ctx, rcx, rcy, efX, efY, theme.s, 2.4 * d, 8.5 * d);
      drawVarSub(
        ctx,
        "E",
        "f",
        " = " + Ef.toFixed(2) + " pu",
        efX + 6 * d,
        efY - 3 * d,
        theme.s,
        10.5,
        "left",
      );

      // Update 3-Column Live KPI Strip
      if (modeValEl && modePillEl) {
        modeValEl.textContent = isOver
          ? "Over-Excited (+Q)"
          : isUnder
            ? "Under-Excited (−Q)"
            : "Unity PF (Q ≈ 0)";
        modeValEl.style.color = iaCol;
        modePillEl.style.borderColor = iaCol;
      }
      if (qValEl) {
        qValEl.textContent = (Q >= 0 ? "+" : "") + Q.toFixed(2) + " pu";
        qValEl.style.color = iaCol;
      }
      if (iaValEl) {
        iaValEl.textContent = Ia.toFixed(2) + " pu";
      }
    }

    slider.addEventListener("input", () => {
      updateSliderLabel(slider, slider.value);
      draw();
      window.dispatchEvent(
        new CustomEvent("scfieldchange", { detail: { ifVal: +slider.value } }),
      );
    });

    window.addEventListener("resize", () => {
      if (active) draw();
    });
    window.addEventListener("themechange", () => {
      theme = getTheme();
      if (active) draw();
    });

    bindSlideLifecycle(
      root,
      () => {
        active = true;
        draw();
      },
      () => {
        active = false;
      },
    );

    draw();
  }

  /* ================================================================
   *  Public init — mounts all widgets
   * ================================================================ */

  function initWidgets() {
    initPowerTriangle();
    initCapQV();
    initTCRScope();
    initSVCVI();
    initSTATCOMPhasors();
    initVoltageSagTest();
    initSCVCurve();
  }

  window.initWidgets = initWidgets;

  // Auto-init whether DOM is still loading or already interactive
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWidgets);
  } else {
    initWidgets();
  }
})();
