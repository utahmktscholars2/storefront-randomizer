(function () {
  if (window.__SHOPIFFY_AB_SCRIPT_LOADED__) {
    console.warn("[Shopiffy] script already loaded, skipping duplicate run");
    return;
  }

  window.__SHOPIFFY_AB_SCRIPT_LOADED__ = true;

  const KEY = "__shopiffy_ab_variant__";
  const VISITOR_KEY = "__shopiffy_visitor_id__";
  const SESSION_KEY = "__shopiffy_session_id__";
  const VALID = ["a", "b", "c", "d"];

  const API_URL =
    window.__SHOPIFFY_API_URL__ ||
    "https://storefront-randomizer-395930598833.us-west3.run.app/api/assignment";

  const EXPERIMENT_KEY = window.__SHOPIFFY_EXPERIMENT_KEY__ || "homepage_test";

  function normalizeList(list) {
    return (list || "")
      .toLowerCase()
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function safeLocalGet(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function safeLocalSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  function safeSessionGet(key) {
    try {
      return sessionStorage.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function safeSessionSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {}
  }

  function randomId(prefix) {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch {}

    return prefix + "-" + Math.random().toString(36).slice(2) + "-" + Date.now();
  }

  function getOrCreateVisitorId() {
    let id = safeLocalGet(VISITOR_KEY);

    if (!id) {
      id = randomId("visitor");
      safeLocalSet(VISITOR_KEY, id);
    }

    return id;
  }

  function getOrCreateSessionId() {
    let id = safeSessionGet(SESSION_KEY);

    if (!id) {
      id = randomId("session");
      safeSessionSet(SESSION_KEY, id);
    }

    return id;
  }

  function getFirstBlockEnabled() {
    const el = document.querySelector(".shopiffy-ab-block");
    return normalizeList(el?.getAttribute("data-ab-enabled") || "a,b");
  }

  function getStoredVariant() {
    return safeLocalGet(KEY).toLowerCase();
  }

  function storeVariant(v) {
    safeLocalSet(KEY, v);
  }

  function getUrlRequestedVariant() {
    try {
      const url = new URL(window.location.href);

      const ab =
        url.searchParams.get("ab") ||
        url.searchParams.get("AB") ||
        url.searchParams.get("Ab") ||
        url.searchParams.get("aB") ||
        "";

      const normalized = ab.toLowerCase();

      return VALID.includes(normalized) ? normalized : "";
    } catch {
      return "";
    }
  }

  function getCurrentVariant() {
    const attr = (
      document.documentElement.getAttribute("data-ab-variant") || ""
    ).toLowerCase();

    return VALID.includes(attr) ? attr : "";
  }

  function setVariant(v) {
    const vv = VALID.includes((v || "").toLowerCase())
      ? v.toLowerCase()
      : "a";

    document.documentElement.setAttribute("data-ab-variant", vv.toUpperCase());

    window.__SHOPIFFY_AB__ = window.__SHOPIFFY_AB__ || {};
    window.__SHOPIFFY_AB__.variant = vv.toUpperCase();

    console.log("[Shopiffy] variant =", vv.toUpperCase());

    return vv;
  }

  async function logAssignment(variant) {
    const vv = (variant || "").toLowerCase();

    if (!VALID.includes(vv)) return;

    if (window.__SHOPIFFY_ASSIGNMENT_LOGGING__) {
      console.warn("[Shopiffy] assignment already logging, skipping duplicate");
      return;
    }

    window.__SHOPIFFY_ASSIGNMENT_LOGGING__ = true;

    const payload = {
      shop: window.Shopify?.shop || window.location.hostname || "",
      experimentKey: EXPERIMENT_KEY,
      visitorId: getOrCreateVisitorId(),
      sessionId: getOrCreateSessionId(),
      variant: vv.toUpperCase(),
      pageUrl: window.location.href,
      loggedAt: new Date().toISOString(),
    };

    console.log("[Shopiffy] logging assignment", payload);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });

      const text = await res.text();
      console.log("[Shopiffy] log response", res.status, text);
    } catch (err) {
      console.error("[Shopiffy] log fetch failed", err);
    } finally {
      window.__SHOPIFFY_ASSIGNMENT_LOGGING__ = false;
    }
  }

  function applyAB() {
    const current = getCurrentVariant() || "a";
    const requested = getUrlRequestedVariant();
    const requestedValid = !!requested;

    document.querySelectorAll(".shopiffy-ab-block").forEach((block) => {
      const enabled = normalizeList(
        block.getAttribute("data-ab-enabled") || "a,b",
      );

      const warningEl = block.querySelector(".shopiffy-ab-warning");

      if (requestedValid && !enabled.includes(requested)) {
        block.style.display = "block";

        block.querySelectorAll(".shopiffy-ab-variant").forEach((v) => {
          v.style.display = "none";
        });

        if (warningEl) {
          warningEl.style.display = "block";

          warningEl
            .querySelectorAll("[data-ab-warn-requested]")
            .forEach((n) => {
              n.textContent = requested.toUpperCase();
            });

          warningEl
            .querySelectorAll("[data-ab-warn-enabled]")
            .forEach((n) => {
              n.textContent = enabled.join(",");
            });
        }

        block.setAttribute("data-ab-applied", "1");
        block.setAttribute("data-ab-warning", "1");
        block.removeAttribute("data-ab-chosen");
        return;
      }

      if (warningEl) {
        warningEl.style.display = "none";
      }

      const chosen = enabled.includes(current) ? current : enabled[0] || null;

      if (!chosen) {
        block.style.display = "none";
        return;
      }

      block.style.display = "block";

      block.querySelectorAll(".shopiffy-ab-variant").forEach((v) => {
        const vv = (v.getAttribute("data-ab-variant") || "").toLowerCase();
        v.style.display = vv === chosen ? "block" : "none";
      });

      block.setAttribute("data-ab-applied", "1");
      block.setAttribute("data-ab-chosen", chosen);
      block.removeAttribute("data-ab-warning");
    });
  }

  function assignVariant() {
    const enabled = getFirstBlockEnabled();

    if (!enabled.length) return "";

    const forced = getUrlRequestedVariant();
    const stored = getStoredVariant();
    const existing = getCurrentVariant();

    if (existing && enabled.includes(existing)) {
      return setVariant(existing);
    }

    if (forced && enabled.includes(forced)) {
      storeVariant(forced);
      return setVariant(forced);
    }

    if (stored && enabled.includes(stored)) {
      return setVariant(stored);
    }

    const chosen = enabled[Math.floor(Math.random() * enabled.length)] || "a";

    storeVariant(chosen);

    return setVariant(chosen);
  }

  function initialize() {
    const chosen = assignVariant();

    applyAB();

    if (chosen) {
      logAssignment(chosen);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  document.addEventListener("shopify:section:load", applyAB);
  document.addEventListener("shopify:section:select", applyAB);
  document.addEventListener("shopify:block:select", applyAB);

  window.__SHOPIFFY_AB__ = window.__SHOPIFFY_AB__ || {};
  window.__SHOPIFFY_AB__.apply = applyAB;
  window.__SHOPIFFY_AB__.log = logAssignment;
  window.__SHOPIFFY_AB__.getStoredVariant = getStoredVariant;
})();