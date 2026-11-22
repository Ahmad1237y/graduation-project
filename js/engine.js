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
    {
      id: "aurora",
      label: "Aurora",
      mode: "dark",
      swatch: "linear-gradient(135deg,#0F1426,#818CF8)",
    },
    {
      id: "nordic",
      label: "Nordic",
      mode: "dark",
      swatch: "linear-gradient(135deg,#162130,#7DD3FC)",
    },
    {
      id: "sage",
      label: "Sage",
      mode: "dark",
      swatch: "linear-gradient(135deg,#121F1B,#6EE7B7)",
    },
    {
      id: "ocean",
      label: "Ocean",
      mode: "dark",
      swatch: "linear-gradient(135deg,#0D182B,#38BDF8)",
    },
    {
      id: "dusk",
      label: "Dusk",
      mode: "dark",
      swatch: "linear-gradient(135deg,#191627,#A5B4FC)",
    },
    {
      id: "carbon",
      label: "Carbon",
      mode: "dark",
      swatch: "linear-gradient(135deg,#16171C,#F59E0B)",
    },
    {
      id: "pearl",
      label: "Pearl",
      mode: "light",
      swatch: "linear-gradient(135deg,#FFFFFF,#4F46E5)",
    },
    {
      id: "alabaster",
      label: "Alabaster",
      mode: "light",
      swatch: "linear-gradient(135deg,#F7F5F0,#0F766E)",
    },
    {
      id: "mist",
      label: "Mist",
      mode: "light",
      swatch: "linear-gradient(135deg,#F1F5F9,#2563EB)",
    },
    {
      id: "sand",
      label: "Sand",
      mode: "light",
      swatch: "linear-gradient(135deg,#FBF8F3,#1E3A5F)",
    },
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

  /** Prevent orphan opening parentheses before inline KaTeX formulas across the entire deck */
  function glueMathParens(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll(".katex").forEach((kEl) => {
      if (
        kEl.closest(".katex-display") ||
        kEl.parentElement?.classList.contains("nowrap")
      )
        return;
      const prev = kEl.previousSibling;
      const next = kEl.nextSibling;
      const hasOpen =
        prev && prev.nodeType === 3 && /\(\s*$/.test(prev.nodeValue);
      if (!hasOpen) return;
      const openMatch = prev.nodeValue.match(/(\(\s*)$/);
      if (!openMatch) return;
      prev.nodeValue = prev.nodeValue.slice(0, -openMatch[1].length);
      const wrap = document.createElement("span");
      wrap.className = "nowrap";
      kEl.parentNode.insertBefore(wrap, kEl);
      wrap.appendChild(document.createTextNode("("));
      wrap.appendChild(kEl);
      if (next && next.nodeType === 3 && /^\s*\)/.test(next.nodeValue)) {
        const closeMatch = next.nodeValue.match(/^(\s*\))/);
        next.nodeValue = next.nodeValue.slice(closeMatch[1].length);
        wrap.appendChild(document.createTextNode(")"));
      }
    });
  }

  function renderSlideMath(el) {
    if (typeof window.renderMathInElement === "function" && el) {
      window.renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
      glueMathParens(el);
    }
  }
  window.renderSlideMath = renderSlideMath;

  function renderMath() {
    if (typeof window.renderMathInElement === "function") {
      renderSlideMath(document.body);
    } else {
      setTimeout(() => {
        if (typeof window.renderMathInElement === "function") {
          renderSlideMath(document.body);
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
    if (counter) counter.textContent = "Page " + (current + 1) + " / " + total;
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
    document
      .querySelectorAll(
        ".card, .team-card-wrap, .tl-item, .pros-col, .cons-col, .presenter-chip, .trans-limit-card, .trans-next-banner, .loc-pill, .mini-bank-card, .why-svc-card, .why-svc-hero",
      )
      .forEach((card) => {
        if (card.style.borderTopColor) {
          card.style.setProperty("--card-clr", card.style.borderTopColor);
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

    // Simulink screenshot Lightbox zoom (images + [data-lightbox-src] buttons)
    if (lightbox) {
      const lbImg = lightbox.querySelector("img");
      const openLB = (src) => {
        if (!src) return;
        if (lbImg) lbImg.src = src;
        lightbox.classList.add("open");
      };
      document
        .querySelectorAll(".sim-frame img, .sim-area-frame img")
        .forEach((img) => {
          img.addEventListener("click", () => openLB(img.src));
        });
      document.querySelectorAll("[data-lightbox-src]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          openLB(btn.getAttribute("data-lightbox-src"));
        });
      });
      lightbox.addEventListener("click", () =>
        lightbox.classList.remove("open"),
      );
    }

    // Interactive Subsystem & Results Image Switcher Tabs
    document.querySelectorAll(".subsys-tabs").forEach((bar) => {
      const btns = Array.from(bar.querySelectorAll(".subsys-btn"));
      btns.forEach((btn) => {
        btn.addEventListener("click", () => {
          btns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          const imgId = btn.getAttribute("data-subsys-target");
          const capId = btn.getAttribute("data-cap-target");
          const src = btn.getAttribute("data-src");
          const cap = btn.getAttribute("data-cap");
          const hlId = btn.getAttribute("data-hl");
          const widgetPaneId = btn.getAttribute("data-widget-pane");
          const showWidget = btn.getAttribute("data-mode") === "widget";
          const imgEl = imgId ? document.getElementById(imgId) : null;
          const widgetPane = widgetPaneId
            ? document.getElementById(widgetPaneId)
            : null;
          const frameEl = imgEl ? imgEl.closest(".sim-area-frame") : null;

          if (widgetPane && imgEl) {
            if (showWidget) {
              imgEl.style.display = "none";
              widgetPane.style.display = "block";
              if (frameEl) frameEl.classList.add("dark-widget-mode");
              window.dispatchEvent(new Event("resize"));
            } else {
              widgetPane.style.display = "none";
              imgEl.style.display = "block";
              if (frameEl) frameEl.classList.remove("dark-widget-mode");
            }
          }

          if (imgEl && src && !showWidget) {
            imgEl.classList.add("swapping");
            setTimeout(() => {
              imgEl.src = src;
              imgEl.classList.remove("swapping");
            }, 130);
          }
          if (capId && cap) {
            const capEl = document.getElementById(capId);
            if (capEl) capEl.textContent = cap;
          }
          const slide = btn.closest(".slide");
          if (slide) {
            slide
              .querySelectorAll(".card.subsys-highlight")
              .forEach((c) => c.classList.remove("subsys-highlight"));
            if (hlId) {
              const targetCard = document.getElementById(hlId);
              if (targetCard) targetCard.classList.add("subsys-highlight");
            }
          }
        });
      });
    });

    // Interactive Step-Pager Cards on Simulink Area Slides
    document.querySelectorAll(".sim-pager-card").forEach((card) => {
      const tabs = Array.from(card.querySelectorAll(".sim-step-tab"));
      const panes = Array.from(card.querySelectorAll(".sim-step-pane"));
      const dots = Array.from(card.querySelectorAll(".sim-pager-dot"));
      const countEl = card.querySelector(".sim-pager-count");
      const prevBtn = card.querySelector(".sim-prev-step");
      const nextBtn = card.querySelector(".sim-next-step");
      const totalSteps = panes.length;
      if (!totalSteps) return;
      let idx = 0;

      function setStep(n) {
        idx = Math.max(0, Math.min(totalSteps - 1, n));
        tabs.forEach((t, i) => t.classList.toggle("active", i === idx));
        panes.forEach((p, i) => p.classList.toggle("active", i === idx));
        dots.forEach((d, i) => d.classList.toggle("active", i === idx));
        if (countEl) {
          countEl.textContent = "Step " + (idx + 1) + " / " + totalSteps;
        }
        if (prevBtn) prevBtn.disabled = idx === 0;
        if (nextBtn) nextBtn.disabled = idx === totalSteps - 1;
      }

      tabs.forEach((t, i) => t.addEventListener("click", () => setStep(i)));
      dots.forEach((d, i) => d.addEventListener("click", () => setStep(i)));
      if (prevBtn) prevBtn.addEventListener("click", () => setStep(idx - 1));
      if (nextBtn) nextBtn.addEventListener("click", () => setStep(idx + 1));
      setStep(0);
    });

    // Interactive 7-Area Simulink Map Hover Inspector
    const mapBadge = document.getElementById("map-insp-badge");
    const mapTitle = document.getElementById("map-insp-title");
    const mapDesc = document.getElementById("map-insp-desc");
    document.querySelectorAll(".area-hotspot").forEach((hs) => {
      const showInfo = () => {
        const aNum = hs.getAttribute("data-area");
        const title = hs.getAttribute("data-title");
        const desc = hs.getAttribute("data-desc");
        const clr = hs.style.getPropertyValue("--hs-clr") || "var(--p)";
        if (mapBadge) {
          mapBadge.textContent = "AREA 0" + aNum;
          mapBadge.style.borderColor = clr;
          mapBadge.style.color = clr;
        }
        if (mapTitle && title) mapTitle.textContent = title;
        if (mapDesc && desc) mapDesc.textContent = desc;
      };
      hs.addEventListener("mouseenter", showInfo);
      hs.addEventListener("focus", showInfo);
    });
  }

  function bindTheme() {
    const root = document.documentElement;
    const themeMenu = document.getElementById("theme-menu");
    let stored = localStorage.getItem("pres-theme") || "aurora";
    if (!THEMES.some((t) => t.id === stored)) stored = "aurora";

    function applyThemeById(id) {
      const found = THEMES.find((t) => t.id === id) || THEMES[0];
      root.setAttribute("data-theme", found.id);
      root.setAttribute("data-mode", found.mode);
      localStorage.setItem("pres-theme", found.id);
      if (themeBtn) {
        themeBtn.innerHTML =
          '<span class="theme-dot-preview"></span>' + found.label + " ▾";
      }
      if (themeMenu) {
        themeMenu.querySelectorAll(".tm-item").forEach((el) => {
          el.classList.toggle(
            "active",
            el.getAttribute("data-pick-theme") === found.id,
          );
        });
      }
      window.dispatchEvent(new CustomEvent("themechange"));
    }

    // Build 10-theme visual swatch menu (Calm Dark + Soft Light)
    if (themeMenu) {
      const darks = THEMES.filter((t) => t.mode === "dark");
      const lights = THEMES.filter((t) => t.mode === "light");
      const makeBtn = (t) =>
        '<button class="tm-item" data-pick-theme="' +
        t.id +
        '">' +
        '<span class="tm-swatch" style="background:' +
        t.swatch +
        ';"></span>' +
        "<span>" +
        t.label +
        "</span></button>";
      themeMenu.innerHTML =
        '<div class="tm-group-lbl">Calm Dark Palettes</div>' +
        '<div class="tm-grid">' +
        darks.map(makeBtn).join("") +
        "</div>" +
        '<div class="tm-group-lbl" style="margin-top:4px;">Soft Light Palettes</div>' +
        '<div class="tm-grid">' +
        lights.map(makeBtn).join("") +
        "</div>";

      themeMenu.querySelectorAll(".tm-item").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          applyThemeById(btn.getAttribute("data-pick-theme"));
          themeMenu.classList.remove("open");
        });
      });
    }

    applyThemeById(stored);

    if (themeBtn) {
      themeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (themeMenu) {
          themeMenu.classList.toggle("open");
        } else {
          const cur = root.getAttribute("data-theme") || "aurora";
          const idx = THEMES.findIndex((t) => t.id === cur);
          applyThemeById(THEMES[(idx + 1) % THEMES.length].id);
        }
      });
    }

    document.addEventListener("click", (e) => {
      if (themeMenu && themeMenu.classList.contains("open")) {
        if (!themeMenu.contains(e.target) && e.target !== themeBtn) {
          themeMenu.classList.remove("open");
        }
      }
    });

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
        fsBtn.textContent = document.fullscreenElement ? "Exit" : "Full (F)";
      });
    }
  }

  /* ================================================================
   *  CLEAN ELECTRIC ENERGY BEAMS OVER SITE BACKGROUND (Cover & Thank You)
   * ================================================================ */
  function initCoverGridBeams() {
    const canvases = document.querySelectorAll(".cover-grid-canvas");
    if (!canvases.length) return;

    canvases.forEach((canvas) => {
      const ctx = canvas.getContext("2d");
      const slide = canvas.closest(".slide");
      let W = 0,
        H = 0;
      let dpr = 1;
      let beams = [];
      let active = slide ? slide.classList.contains("active") : true;
      let rafId = null;

      function getPalette() {
        const s = getComputedStyle(document.documentElement);
        const isLight =
          document.documentElement.getAttribute("data-mode") === "light";
        return {
          isLight,
          pRgb: (s.getPropertyValue("--p-rgb") || "37, 99, 235").trim(),
          sRgb: (s.getPropertyValue("--s-rgb") || "13, 148, 136").trim(),
          pHex: (s.getPropertyValue("--p") || "#2563EB").trim(),
          sHex: (s.getPropertyValue("--s") || "#0D9488").trim(),
        };
      }
      let pal = getPalette();

      function getSafeZone() {
        const content = slide ? slide.querySelector(".cover-content") : null;
        if (content && content.children.length) {
          let minL = Infinity,
            maxR = -Infinity,
            minT = Infinity,
            maxB = -Infinity;
          Array.from(content.children).forEach((ch) => {
            const r = ch.getBoundingClientRect();
            if (r.width > 10 && r.height > 10) {
              minL = Math.min(minL, r.left);
              maxR = Math.max(maxR, r.right);
              minT = Math.min(minT, r.top);
              maxB = Math.max(maxB, r.bottom);
            }
          });
          if (isFinite(minL) && maxR > minL) {
            // generous padding so beams never visually overlap any text
            const padX = 60;
            const padY = 50;
            return {
              left: Math.max(0, minL - padX),
              right: Math.min(W, maxR + padX),
              top: Math.max(0, minT - padY),
              bottom: Math.min(H, maxB + padY),
            };
          }
        }
        return {
          left: W * 0.08,
          right: W * 0.92,
          top: H * 0.12,
          bottom: H * 0.88,
        };
      }

      function spawnBeam(horizontal, stagger) {
        const safe = getSafeZone();
        const horiz =
          horizontal !== undefined ? horizontal : Math.random() > 0.48;
        const dir = Math.random() > 0.5 ? 1 : -1;
        const speed = 1.0 + Math.random() * 1.1;
        const len = 100 + Math.random() * 110;
        const useS = Math.random() > 0.5;
        const width = 1.4 + Math.random() * 0.7;
        const weight = 0.55 + Math.random() * 0.25;

        if (horiz) {
          // Strictly in top/bottom empty bands — far from text
          const topBandH = Math.max(16, safe.top);
          const botBandStart = safe.bottom;
          const botBandH = Math.max(16, H - botBandStart);
          const useTop = topBandH >= botBandH ? Math.random() > 0.3 : Math.random() > 0.7;
          const y = useTop
            ? 8 + Math.random() * Math.max(8, topBandH - 16)
            : botBandStart + 8 + Math.random() * Math.max(8, botBandH - 16);
          const startX = stagger
            ? Math.random() * W
            : dir > 0
              ? -len - Math.random() * 200
              : W + len + Math.random() * 200;
          return {
            horiz: true,
            dir,
            speed,
            len,
            useS,
            width,
            weight,
            x: startX,
            y,
          };
        } else {
          // Strictly in left/right empty margins — far from text
          const leftBandW = Math.max(16, safe.left);
          const rightBandStart = safe.right;
          const rightBandW = Math.max(16, W - rightBandStart);
          const useLeft = leftBandW >= rightBandW ? Math.random() > 0.3 : Math.random() > 0.7;
          const x = useLeft
            ? 8 + Math.random() * Math.max(8, leftBandW - 16)
            : rightBandStart + 8 + Math.random() * Math.max(8, rightBandW - 16);
          const startY = stagger
            ? Math.random() * H
            : dir > 0
              ? -len - Math.random() * 180
              : H + len + Math.random() * 180;
          return {
            horiz: false,
            dir,
            speed,
            len,
            useS,
            width,
            weight,
            x,
            y: startY,
          };
        }
      }

      function seedBeams() {
        beams = [];
        for (let i = 0; i < 12; i++) {
          beams.push(spawnBeam(i % 2 === 0, true));
        }
      }

      function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seedBeams();
      }
      resize();
      window.addEventListener("resize", resize);
      window.addEventListener("themechange", () => {
        pal = getPalette();
      });

      function draw() {
        if (!active) {
          rafId = null;
          return;
        }
        ctx.clearRect(0, 0, W, H);
        const { isLight, pRgb, sRgb, pHex, sHex } = pal;

        // Luminous Electric Energy Beams gliding cleanly over the site's Aurora background
        beams.forEach((b, idx) => {
          const rgb = b.useS ? sRgb : pRgb;
          const hex = b.useS ? sHex : pHex;
          const midA = (isLight ? 0.36 : 0.48) * b.weight;
          const headA = (isLight ? 0.82 : 0.94) * b.weight;

          if (b.horiz) {
            b.x += b.dir * b.speed;
            const tailX = b.x - b.dir * b.len;
            const grad = ctx.createLinearGradient(tailX, b.y, b.x, b.y);
            grad.addColorStop(0, `rgba(${rgb}, 0)`);
            grad.addColorStop(0.65, `rgba(${rgb}, ${midA.toFixed(3)})`);
            grad.addColorStop(1, `rgba(${rgb}, ${headA.toFixed(3)})`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = b.width;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(tailX, b.y + 0.5);
            ctx.lineTo(b.x, b.y + 0.5);
            ctx.stroke();

            // Soft outer halo + crisp luminous head spark
            ctx.save();
            ctx.fillStyle = `rgba(${rgb}, ${(isLight ? 0.18 : 0.28) * b.weight})`;
            ctx.beginPath();
            ctx.arc(b.x, b.y + 0.5, 6.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowColor = hex;
            ctx.shadowBlur = isLight ? 7 : 12;
            ctx.fillStyle = hex;
            ctx.beginPath();
            ctx.arc(b.x, b.y + 0.5, 2.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (
              (b.dir > 0 && b.x - b.len > W + 40) ||
              (b.dir < 0 && b.x + b.len < -40)
            ) {
              beams[idx] = spawnBeam(undefined, false);
            }
          } else {
            b.y += b.dir * b.speed;
            const tailY = b.y - b.dir * b.len;
            const grad = ctx.createLinearGradient(b.x, tailY, b.x, b.y);
            grad.addColorStop(0, `rgba(${rgb}, 0)`);
            grad.addColorStop(0.65, `rgba(${rgb}, ${midA.toFixed(3)})`);
            grad.addColorStop(1, `rgba(${rgb}, ${headA.toFixed(3)})`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = b.width;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(b.x + 0.5, tailY);
            ctx.lineTo(b.x + 0.5, b.y);
            ctx.stroke();

            ctx.save();
            ctx.fillStyle = `rgba(${rgb}, ${(isLight ? 0.18 : 0.28) * b.weight})`;
            ctx.beginPath();
            ctx.arc(b.x + 0.5, b.y, 6.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowColor = hex;
            ctx.shadowBlur = isLight ? 7 : 12;
            ctx.fillStyle = hex;
            ctx.beginPath();
            ctx.arc(b.x + 0.5, b.y, 2.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            if (
              (b.dir > 0 && b.y - b.len > H + 40) ||
              (b.dir < 0 && b.y + b.len < -40)
            ) {
              beams[idx] = spawnBeam(undefined, false);
            }
          }
        });

        rafId = requestAnimationFrame(draw);
      }

      if (slide) {
        slide.addEventListener("slide:enter", () => {
          active = true;
          pal = getPalette();
          requestAnimationFrame(() => {
            seedBeams();
            if (!rafId) rafId = requestAnimationFrame(draw);
          });
        });
        slide.addEventListener("slide:leave", () => {
          active = false;
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
        });
      }
      if (active) {
        requestAnimationFrame(() => {
          seedBeams();
          if (!rafId) rafId = requestAnimationFrame(draw);
        });
      }
    });
  }

  window.slideEngine = { goTo, next, prev, toggleOverview, init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
      initCoverGridBeams();
    });
  } else {
    init();
    initCoverGridBeams();
  }
})();
