/**
 * studio.js — Interactive Full-Model Map Controller (Page 35 / slide-34)
 * Adds hover-synced Area 1..7 hotspots + smooth in-place Zoom & Drag-Pan
 * over the high-resolution fig_ch3_full_model.png schematic.
 */
(function () {
  "use strict";

  const FULL_MODEL_ZONES = [
    { goto: 35, left: "3.73%",  top: "23.33%", width: "26.60%", height: "14.42%", clr: "#0284C7", label: "Area 1 — 11 kV Utility Grid & 1 MVA Transformer" },
    { goto: 36, left: "38.18%", top: "20.74%", width: "61.65%", height: "15.55%", clr: "#EA580C", label: "Area 2 — Static RL Load & 20 HP Induction Motor" },
    { goto: 37, left: "33.99%", top: "37.98%", width: "15.81%", height: "30.56%", clr: "#0EA5E9", label: "Area 3 — Delta Fixed Capacitor Bank (3×111 µF)" },
    { goto: 38, left: "52.57%", top: "37.98%", width: "25.11%", height: "41.51%", clr: "#E11D48", label: "Area 4 — Delta TCR Unit (3×91.28 mH + 6 SCRs)" },
    { goto: 39, left: "21.42%", top: "0.23%",  width: "38.46%", height: "19.70%", clr: "#10B981", label: "Area 5 — Power Measurement, 300 Hz LPF & Feedback" },
    { goto: 40, left: "0.15%",  top: "38.72%", width: "33.00%", height: "29.81%", clr: "#D97706", label: "Area 6 — Anti-Windup PI & TRIAC_Control_Circuit" },
    { goto: 42, left: "1.64%",  top: "71.06%", width: "42.17%", height: "28.68%", clr: "#06B6D4", label: "Area 7 — Dual Scopes, Phase-A Signals & Live THD" },
  ];

  function initFullModelMap() {
    const layer = document.getElementById("fm-hotspot-layer");
    const hint = document.getElementById("fm-hover-hint");
    const wrap = document.getElementById("fm-img-wrap");
    const box = document.getElementById("fm-canvas-box");
    const zIn = document.getElementById("fm-zoom-in");
    const zOut = document.getElementById("fm-zoom-out");
    const zReset = document.getElementById("fm-zoom-reset");
    const zPct = document.getElementById("fm-zoom-pct");
    if (!layer || !wrap || !box) return;

    const defaultHint =
      "Click any Area on the diagram to open its explanation · Scroll or use + / − to zoom in";

    const chips = Array.from(document.querySelectorAll(".fm-step-chip[data-area-idx]"));
    const zoneEls = [];

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let dragMoved = false;
    let startX = 0;
    let startY = 0;

    function clampPan() {
      if (scale <= 1) {
        panX = 0;
        panY = 0;
        return;
      }
      const maxPanX = (box.offsetWidth * (scale - 1)) / 2 + 40;
      const maxPanY = (box.offsetHeight * (scale - 1)) / 2 + 40;
      panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
      panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    }

    function applyTransform() {
      clampPan();
      box.style.transform = `translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${scale.toFixed(2)})`;
      wrap.classList.toggle("is-zoomed", scale > 1.01);
      if (zPct) zPct.textContent = Math.round(scale * 100) + "%";
    }

    function setZoom(nextScale) {
      scale = Math.max(1, Math.min(2.6, nextScale));
      if (scale === 1) {
        panX = 0;
        panY = 0;
      }
      applyTransform();
    }

    if (zIn) zIn.addEventListener("click", () => setZoom(scale + 0.35));
    if (zOut) zOut.addEventListener("click", () => setZoom(scale - 0.35));
    if (zReset) zReset.addEventListener("click", () => setZoom(1));

    // Mouse-wheel zoom over the diagram stage
    wrap.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.22 : -0.22;
        setZoom(scale + delta);
      },
      { passive: false }
    );

    // Drag-to-pan when zoomed in
    wrap.addEventListener("mousedown", (e) => {
      if (scale <= 1.01) return;
      dragging = true;
      dragMoved = false;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      wrap.classList.add("is-dragging");
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const nx = e.clientX - startX;
      const ny = e.clientY - startY;
      if (Math.abs(nx - panX) > 3 || Math.abs(ny - panY) > 3) {
        dragMoved = true;
      }
      panX = nx;
      panY = ny;
      applyTransform();
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove("is-dragging");
      setTimeout(() => {
        dragMoved = false;
      }, 40);
    });

    // Build clickable hotspots & sync hover with bottom Area pills
    FULL_MODEL_ZONES.forEach((z, idx) => {
      const btn = document.createElement("button");
      btn.className = "st-hs-zone";
      btn.style.cssText = `left:${z.left};top:${z.top};width:${z.width};height:${z.height};--hs-clr:${z.clr};`;
      btn.setAttribute("aria-label", z.label);

      btn.addEventListener("mouseenter", () => {
        if (hint) hint.textContent = "Click to Open → " + z.label;
        if (chips[idx]) chips[idx].classList.add("synced-hover");
      });
      btn.addEventListener("mouseleave", () => {
        if (hint) hint.textContent = defaultHint;
        if (chips[idx]) chips[idx].classList.remove("synced-hover");
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (dragMoved) return;
        if (window.slideEngine && typeof window.slideEngine.goTo === "function") {
          window.slideEngine.goTo(z.goto);
        }
      });

      layer.appendChild(btn);
      zoneEls.push(btn);
    });

    // Hovering bottom pills highlights the exact Area on the schematic
    chips.forEach((chip, idx) => {
      chip.addEventListener("mouseenter", () => {
        if (zoneEls[idx]) zoneEls[idx].classList.add("synced-hover");
        if (hint && FULL_MODEL_ZONES[idx]) {
          hint.textContent = "Click to Open → " + FULL_MODEL_ZONES[idx].label;
        }
      });
      chip.addEventListener("mouseleave", () => {
        if (zoneEls[idx]) zoneEls[idx].classList.remove("synced-hover");
        if (hint) hint.textContent = defaultHint;
      });
    });

    // Reset zoom cleanly whenever leaving the slide
    const slide = wrap.closest(".slide");
    if (slide) {
      slide.addEventListener("slide:leave", () => setZoom(1));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFullModelMap);
  } else {
    initFullModelMap();
  }
})();
