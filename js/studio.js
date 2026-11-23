/**
 * studio.js — Interactive Full-Model Map Controller (Page 32 / slide-31)
 * Adds hover-synced Area 1..7 hotspots + smooth in-place Zoom & Drag-Pan
 * over the high-resolution fig_ch3_full_model.png schematic.
 */
(function () {
  "use strict";

  const FULL_MODEL_ZONES = [
    { goto: 32, left: "3.73%",  top: "23.33%", width: "26.60%", height: "14.42%", clr: "#0284C7", label: "Area 1 — 11 kV Utility Grid & 1 MVA Transformer" },
    { goto: 33, left: "38.18%", top: "20.74%", width: "61.65%", height: "15.55%", clr: "#EA580C", label: "Area 2 — Static RL Load & 20 HP Induction Motor" },
    { goto: 34, left: "33.99%", top: "37.98%", width: "15.81%", height: "30.56%", clr: "#0EA5E9", label: "Area 3 — Delta Fixed Capacitor Bank (3×111 µF)" },
    { goto: 35, left: "52.57%", top: "37.98%", width: "25.11%", height: "41.51%", clr: "#E11D48", label: "Area 4 — Delta TCR Unit (3×91.28 mH + 6 SCRs)" },
    { goto: 36, left: "21.42%", top: "0.23%",  width: "38.46%", height: "19.70%", clr: "#10B981", label: "Area 5 — Power Measurement, 300 Hz LPF & Feedback" },
    { goto: 37, left: "0.15%",  top: "38.72%", width: "33.00%", height: "29.81%", clr: "#D97706", label: "Area 6 — Anti-Windup PI & TRIAC_Control_Circuit" },
    { goto: 39, left: "1.64%",  top: "71.06%", width: "42.17%", height: "28.68%", clr: "#06B6D4", label: "Area 7 — Dual Scopes, Phase-A Signals & Live THD" },
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
      "Point at any Area & scroll to zoom there · Drag to move · Click any Area to open";

    const chips = Array.from(document.querySelectorAll(".fm-step-chip[data-area-idx]"));
    const zoneEls = [];

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let dragMoved = false;
    let startX = 0;
    let startY = 0;
    let startPanX = 0;
    let startPanY = 0;

    function clampPan() {
      if (scale <= 1.001) {
        panX = 0;
        panY = 0;
        return;
      }
      const scaledW = box.offsetWidth * scale;
      const scaledH = box.offsetHeight * scale;
      const maxPanX = Math.max(
        (box.offsetWidth * (scale - 1)) / 2,
        (scaledW - wrap.clientWidth) / 2
      ) + 90;
      const maxPanY = Math.max(
        (box.offsetHeight * (scale - 1)) / 2,
        (scaledH - wrap.clientHeight) / 2
      ) + 90;
      panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
      panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    }

    function applyTransform(instant) {
      clampPan();
      box.style.transition = instant ? "none" : "";
      box.style.transform = `translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      wrap.classList.toggle("is-zoomed", scale > 1.01);
      if (zPct) zPct.textContent = Math.round(scale * 100) + "%";
    }

    /**
     * Zoom smoothly around a specific focal point (clientX, clientY).
     * When triggered from mouse wheel, keeps the exact diagram point under the cursor fixed!
     */
    function setZoom(nextScale, focalClientX, focalClientY, instant) {
      const prevScale = scale;
      const clamped = Math.max(1, Math.min(3.5, nextScale));
      if (clamped <= 1.001) {
        scale = 1;
        panX = 0;
        panY = 0;
        applyTransform(false);
        return;
      }

      const ratio = clamped / prevScale;
      if (typeof focalClientX === "number" && typeof focalClientY === "number") {
        const rect = wrap.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const mx = focalClientX - cx;
        const my = focalClientY - cy;
        panX = mx - (mx - panX) * ratio;
        panY = my - (my - panY) * ratio;
      } else {
        panX *= ratio;
        panY *= ratio;
      }

      scale = clamped;
      applyTransform(Boolean(instant));
    }

    if (zIn) zIn.addEventListener("click", () => setZoom(scale + 0.4));
    if (zOut) zOut.addEventListener("click", () => setZoom(scale - 0.4));
    if (zReset) zReset.addEventListener("click", () => setZoom(1));

    // Cursor-anchored mouse-wheel zoom over ANY area (Area 5, Area 7, Area 2, etc.)
    wrap.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
        setZoom(scale * factor, e.clientX, e.clientY, true);
      },
      { passive: false }
    );

    // Double-click anywhere on stage to quickly reset zoom or zoom into that exact spot
    wrap.addEventListener("dblclick", (e) => {
      e.preventDefault();
      if (scale > 1.05) {
        setZoom(1);
      } else {
        setZoom(2.1, e.clientX, e.clientY, false);
      }
    });

    // Drag-to-pan from anywhere on the diagram (including on top of Area hotspots!)
    wrap.addEventListener("mousedown", (e) => {
      if (e.button !== 0 || scale <= 1.01) return;
      e.preventDefault();
      dragging = true;
      dragMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panX;
      startPanY = panY;
      wrap.classList.add("is-dragging");
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragMoved = true;
      }
      panX = startPanX + dx;
      panY = startPanY + dy;
      applyTransform(true);
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      wrap.classList.remove("is-dragging");
      setTimeout(() => {
        dragMoved = false;
      }, 60);
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
