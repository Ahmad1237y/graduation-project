/* ============================================================
   SLIDE ENGINE — Navigation, Theme Switcher, Lightbox, KaTeX
   ============================================================ */
(function () {
  "use strict";

  const deck = document.getElementById("deck");
  const slides = () => Array.from(deck.querySelectorAll(".slide"));
  const bar = document.getElementById("progress-bar");
  const counter = document.getElementById("slide-counter");
  const overview = document.getElementById("overview");
  const themeBtn = document.getElementById("theme-toggle");
  const prevBtn = document.getElementById("btn-prev");
  const nextBtn = document.getElementById("btn-next");
  const lightbox = document.getElementById("lightbox");

  let current = 0;
  let total = 0;
  let isOverview = false;

  const THEMES = [
    { id: "aurora", label: "Color: Aurora" },
    { id: "emerald", label: "Color: Emerald" },
    { id: "ocean", label: "Color: Ocean" },
    { id: "carbon", label: "Color: Carbon" },
    { id: "pearl", label: "Color: Pearl Light" },
  ];

  function getInitialSlide() {
    const hashMatch = (window.location.hash || "").match(/^#slide-(\d+)$/);
    if (hashMatch) {
      const idx = parseInt(hashMatch[1], 10);
      if (idx >= 0 && idx < total) return idx;
    }
    const saved = parseInt(
      sessionStorage.getItem("pres-slide") ??
        localStorage.getItem("pres-slide") ??
        "0",
      10,
    );
    return !isNaN(saved) && saved >= 0 && saved < total ? saved : 0;
  }

  function init() {
    total = slides().length;
    if (!total) return;
    const startIdx = getInitialSlide();
    goTo(startIdx, true);
    buildOverview();
    bindKeys();
    bindClicks();
    bindTheme();
    renderMath();
    requestAnimationFrame(() => triggerEnter(startIdx));
  }

  function renderMath() {
    if (typeof window.renderMathInElement === "function") {
      window.renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    } else {
      // Retry shortly if KaTeX script is still loading
      setTimeout(() => {
        if (typeof window.renderMathInElement === "function") {
          window.renderMathInElement(document.body, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "\\(", right: "\\)", display: false },
            ],
            throwOnError: false,
          });
        }
      }, 400);
    }
  }

  function goTo(n, instant) {
    const all = slides();
    if (n < 0 || n >= all.length) return;

    const prev = current;
    current = n;
    try {
      sessionStorage.setItem("pres-slide", String(n));
      localStorage.setItem("pres-slide", String(n));
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", "#slide-" + n);
      }
    } catch (_) {}

    all.forEach((s, i) => {
      s.classList.remove("active", "prev");
      if (i === n) {
        s.classList.add("active");
        if (instant) {
          s.style.transition = "none";
          requestAnimationFrame(() => (s.style.transition = ""));
        }
      } else if (i < n) {
        s.classList.add("prev");
      }
    });

    updateHUD();
    if (prev !== n) {
      triggerLeave(prev);
      triggerEnter(n);
    }
    if (isOverview) closeOverview();
  }

  function next() {
    goTo(current + 1);
  }
  function prev() {
    goTo(current - 1);
  }

  function updateHUD() {
    const pct = total > 1 ? (current / (total - 1)) * 100 : 100;
    if (bar) bar.style.width = pct + "%";
    if (counter) counter.textContent = "Page " + (current + 1);
    if (overview) {
      overview.querySelectorAll(".overview-thumb").forEach((t, i) => {
        t.classList.toggle("current", i === current);
      });
    }
  }

  function triggerEnter(idx) {
    const slide = slides()[idx];
    if (!slide) return;
    slide.querySelectorAll(".stagger").forEach((el) => {
      el.classList.remove("go");
      void el.offsetWidth;
      el.classList.add("go");
    });
    slide.dispatchEvent(new CustomEvent("slide:enter", { bubbles: true }));
  }

  function triggerLeave(idx) {
    const slide = slides()[idx];
    if (!slide) return;
    slide
      .querySelectorAll(".stagger")
      .forEach((el) => el.classList.remove("go"));
    slide.dispatchEvent(new CustomEvent("slide:leave", { bubbles: true }));
  }

  function buildOverview() {
    if (!overview) return;
    overview.innerHTML = "";
    slides().forEach((s, i) => {
      const thumb = document.createElement("div");
      thumb.className = "overview-thumb";
      const titleEl = s.querySelector(".slide-title, .cover-title, h2, h3");
      const title = titleEl ? titleEl.textContent : "Slide " + (i + 1);
      thumb.innerHTML =
        '<span class="overview-num">' +
        String(i + 1).padStart(2, "0") +
        "</span>" +
        title;
      thumb.addEventListener("click", () => goTo(i));
      overview.appendChild(thumb);
    });
  }

  function toggleOverview() {
    isOverview = !isOverview;
    if (overview) overview.classList.toggle("open", isOverview);
  }
  function closeOverview() {
    isOverview = false;
    if (overview) overview.classList.remove("open");
  }

  function bindKeys() {
    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, select")) return;
      if (
        lightbox &&
        lightbox.classList.contains("open") &&
        e.key === "Escape"
      ) {
        lightbox.classList.remove("open");
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          prev();
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(total - 1);
          break;
        case "g":
        case "G":
          e.preventDefault();
          toggleOverview();
          break;
        case "Escape":
          if (isOverview) {
            e.preventDefault();
            closeOverview();
          }
          break;
        case "f":
        case "F":
          e.preventDefault();
          if (!document.fullscreenElement)
            document.documentElement.requestFullscreen().catch(() => {});
          else document.exitFullscreen();
          break;
      }
    });
  }

  function bindClicks() {
    if (prevBtn) prevBtn.addEventListener("click", prev);
    if (nextBtn) nextBtn.addEventListener("click", next);
    if (counter) counter.addEventListener("click", toggleOverview);

    document.querySelectorAll("[data-goto]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const target = parseInt(el.getAttribute("data-goto"), 10);
        el.classList.remove("pulsing");
        void el.offsetWidth;
        el.classList.add("pulsing");
        if (!isNaN(target)) {
          setTimeout(() => goTo(target), 240);
        }
      });
    });

    // Auto-sync border-top color to --card-clr (no click-to-disappear animation)
    document.querySelectorAll('.card, .team-card-wrap, .tl-item, .pros-col, .cons-col, .presenter-chip, .trans-limit-card, .trans-next-banner, .loc-pill, .mini-bank-card, .why-svc-card, .why-svc-hero').forEach(card => {
      if (card.style.borderTopColor) {
        card.style.setProperty('--card-clr', card.style.borderTopColor);
      }
    });

    document.querySelectorAll(".flip-card").forEach((card) => {
      card.addEventListener("click", () => card.classList.toggle("flipped"));
    });

    document.querySelectorAll("[data-toggle-comp]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const beforeG = document.getElementById("q-before");
        const afterG = document.getElementById("q-after");
        const readBefore = document.getElementById("readout-before");
        const readAfter = document.getElementById("readout-after");
        if (!beforeG || !afterG) return;
        const isAfter = afterG.style.display !== "none";
        beforeG.style.display = isAfter ? "" : "none";
        afterG.style.display = isAfter ? "none" : "";
        if (readBefore) readBefore.style.display = isAfter ? "grid" : "none";
        if (readAfter) readAfter.style.display = isAfter ? "none" : "grid";
        btn.textContent = isAfter
          ? "Switch View → After Local Shunt Compensation"
          : "Switch View → Before Compensation (Uncompensated)";
      });
    });

    // Clickable Capacitor Stage buttons on Slide 10
    window.capStagesState = [true, true, false];
    document.querySelectorAll("[data-cap-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = +btn.getAttribute("data-cap-step");
        window.capStagesState[idx] = !window.capStagesState[idx];
        btn.classList.toggle("step-off", !window.capStagesState[idx]);
        const stateSpan = btn.querySelector(".step-state");
        if (stateSpan)
          stateSpan.textContent = window.capStagesState[idx] ? "ON" : "OFF";
        const activeCount = window.capStagesState.filter(Boolean).length;
        const kvarMeter = document.getElementById("apfc-kvar-meter");
        if (kvarMeter)
          kvarMeter.textContent =
            "Active Output: " + activeCount * 100 + " / 300 kVAR";
        window.dispatchEvent(new CustomEvent("capstageschange"));
      });
    });

    // Simulink screenshot Lightbox zoom
    if (lightbox) {
      const lbImg = lightbox.querySelector("img");
      document.querySelectorAll(".sim-frame img").forEach((img) => {
        img.addEventListener("click", () => {
          if (lbImg) lbImg.src = img.src;
          lightbox.classList.add("open");
        });
      });
      lightbox.addEventListener("click", () =>
        lightbox.classList.remove("open"),
      );
    }
  }

  function bindTheme() {
    const root = document.documentElement;
    let stored = localStorage.getItem("pres-theme") || "aurora";
    if (!THEMES.some((t) => t.id === stored)) stored = "aurora";
    root.setAttribute("data-theme", stored);

    function updateLabel(id) {
      const found = THEMES.find((t) => t.id === id) || THEMES[0];
      if (themeBtn) themeBtn.textContent = found.label;
    }
    updateLabel(stored);

    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        const cur = root.getAttribute("data-theme") || "aurora";
        const idx = THEMES.findIndex((t) => t.id === cur);
        const nextTheme = THEMES[(idx + 1) % THEMES.length];
        root.setAttribute("data-theme", nextTheme.id);
        localStorage.setItem("pres-theme", nextTheme.id);
        updateLabel(nextTheme.id);
        window.dispatchEvent(new CustomEvent("themechange"));
      });
    }

    const fsBtn = document.getElementById("fullscreen-btn");
    if (fsBtn) {
      fsBtn.addEventListener("click", () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen();
        }
      });
      document.addEventListener("fullscreenchange", () => {
        fsBtn.textContent = document.fullscreenElement
          ? "Exit Fullscreen"
          : "Fullscreen (F)";
      });
    }
  }

  function animateCoverWaves() {
    const svgs = document.querySelectorAll(".cover-wave svg");
    if (!svgs.length) return;
    let phase = 0;
    function loop() {
      phase += 0.022;
      svgs.forEach((svg) => {
        svg.querySelectorAll("path[data-wave]").forEach((path) => {
          const w = parseFloat(path.dataset.w) || 900;
          const h = parseFloat(path.dataset.h) || 500;
          const a = parseFloat(path.dataset.amp) || 45;
          const k = parseFloat(path.dataset.freq) || 2;
          const off = parseFloat(path.dataset.off) || 0;
          const mid = parseFloat(path.dataset.mid) || h / 2;
          let d = "";
          for (let x = 0; x <= w; x += 6) {
            const y =
              mid + a * Math.sin((x / w) * Math.PI * 2 * k + phase + off);
            d += (x ? "L" : "M") + x + " " + y.toFixed(1) + " ";
          }
          path.setAttribute("d", d);
        });
      });
      requestAnimationFrame(loop);
    }
    loop();
  }

  window.slideEngine = { goTo, next, prev, toggleOverview, init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
      animateCoverWaves();
    });
  } else {
    init();
    animateCoverWaves();
  }
})();
