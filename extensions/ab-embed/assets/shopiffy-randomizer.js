(function () {
  if (window.__SHOPIFFY_AB_SCRIPT_LOADED__) {
    console.warn("[Shopiffy] script already loaded, skipping duplicate run");
    return;
  }

  window.__SHOPIFFY_AB_SCRIPT_LOADED__ = true;

  const KEY = "__shopiffy_ab_variant__";
  const VISITOR_KEY = "__shopiffy_visitor_id__";
  const SESSION_KEY = "__shopiffy_session_id__";
  const CLICK_SEQUENCE_KEY = "__shopiffy_click_sequence__";
  const VALID = ["a", "b", "c", "d"];

  const API_BASE_URL =
    window.__SHOPIFFY_API_BASE_URL__ ||
    "https://storefront-randomizer-395930598833.us-west3.run.app";
  const ASSIGNMENT_API_URL =
    window.__SHOPIFFY_ASSIGNMENT_API_URL__ ||
    window.__SHOPIFFY_API_URL__ ||
    API_BASE_URL + "/api/assignment";
  const VISIT_API_URL =
    window.__SHOPIFFY_VISIT_API_URL__ || API_BASE_URL + "/api/visit";
  const CONFIG_API_URL =
    window.__SHOPIFFY_CONFIG_API_URL__ || API_BASE_URL + "/api/config";
  const CLICK_API_URL =
    window.__SHOPIFFY_CLICK_API_URL__ || API_BASE_URL + "/api/click";
  const DURATION_API_URL =
    window.__SHOPIFFY_DURATION_API_URL__ || API_BASE_URL + "/api/duration";

  const EXPERIMENT_KEY = window.__SHOPIFFY_EXPERIMENT_KEY__ || "homepage_test";
  const PAGE_VIEW_ID = randomId("pageview");
  const PAGE_STARTED_AT = new Date();
  const PAGE_STARTED_MS = Date.now();
  let lastDurationSentMs = 0;
  let durationIntervalId = null;
  let trackingSettings = {
    loaded: false,
    trackClicks: false,
    trackPageDuration: false,
  };

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

  function truncate(value, max) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");
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

  async function postLog(url, payload, label) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    const text = await res.text();
    console.log("[Shopiffy] " + label + " response", res.status, text);
  }

  async function loadTrackingSettings() {
    const shop = window.Shopify?.shop || window.location.hostname || "";
    const url = new URL(CONFIG_API_URL);

    url.searchParams.set("shop", shop);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Config request failed");
      }

      trackingSettings = {
        loaded: true,
        trackClicks: data.trackClicks !== false,
        trackPageDuration: data.trackPageDuration !== false,
      };

      console.log("[Shopiffy] tracking settings", trackingSettings);
    } catch (err) {
      trackingSettings = {
        loaded: true,
        trackClicks: false,
        trackPageDuration: false,
      };

      console.error("[Shopiffy] tracking settings fetch failed", err);
    }

    return trackingSettings;
  }

  function postBeaconOrFetch(url, payload, label) {
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      try {
        const sent = navigator.sendBeacon(
          url,
          new Blob([body], { type: "application/json" }),
        );

        if (sent) {
          console.log("[Shopiffy] " + label + " beacon queued");
          return;
        }
      } catch {}
    }

    postLog(url, payload, label).catch((err) => {
      console.error("[Shopiffy] " + label + " fetch failed", err);
    });
  }

  function nextClickSequence() {
    const current = parseInt(safeSessionGet(CLICK_SEQUENCE_KEY) || "0", 10);
    const next = Number.isFinite(current) ? current + 1 : 1;

    safeSessionSet(CLICK_SEQUENCE_KEY, String(next));

    return next;
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
      await Promise.allSettled([
        postLog(ASSIGNMENT_API_URL, payload, "assignment log"),
        postLog(VISIT_API_URL, payload, "visit log"),
      ]);
    } catch (err) {
      console.error("[Shopiffy] log fetch failed", err);
    } finally {
      window.__SHOPIFFY_ASSIGNMENT_LOGGING__ = false;
    }
  }

  function getTrackTarget(rawTarget) {
    if (!(rawTarget instanceof Element)) return null;

    return rawTarget.closest(
      [
        "[data-shopiffy-track]",
        ".shopiffy-ab-block",
        ".shopiffy-ab-variant",
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "label",
        "summary",
        "[role='button']",
        "[role='link']",
        "[role='menuitem']",
        "[role='tab']",
        "[data-product-id]",
        "[data-product-handle]",
        "[data-variant-id]",
        "[data-shopify]",
      ].join(","),
    );
  }

  function getElementSelector(el) {
    if (!el || !el.tagName) return "";

    const parts = [];
    let node = el;

    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();

      if (node.id) {
        part += "#" + cssEscape(node.id);
        parts.unshift(part);
        break;
      }

      const trackName = node.getAttribute("data-shopiffy-track");
      const abVariant = node.getAttribute("data-ab-variant");

      if (trackName) {
        part += "[data-shopiffy-track='" + cssEscape(trackName) + "']";
      } else if (abVariant) {
        part += "[data-ab-variant='" + cssEscape(abVariant) + "']";
      } else if (node.classList.length) {
        part +=
          "." +
          Array.from(node.classList)
            .slice(0, 3)
            .map((className) => cssEscape(className))
            .join(".");
      }

      parts.unshift(part);
      node = node.parentElement;
    }

    return truncate(parts.join(" > "), 500);
  }

  function getClickPayload(event, target) {
    const variant = getCurrentVariant() || getStoredVariant() || "a";
    const block = target.closest(".shopiffy-ab-block");
    const abVariant = target.closest(".shopiffy-ab-variant");

    return {
      shop: window.Shopify?.shop || window.location.hostname || "",
      experimentKey: EXPERIMENT_KEY,
      visitorId: getOrCreateVisitorId(),
      sessionId: getOrCreateSessionId(),
      variant: variant.toUpperCase(),
      pageUrl: window.location.href,
      clickedAt: new Date().toISOString(),
      sequence: nextClickSequence(),
      tagName: truncate(target.tagName || "", 40),
      elementText: truncate(
        target.getAttribute("aria-label") ||
          target.getAttribute("title") ||
          target.innerText ||
          target.value ||
          "",
        240,
      ),
      elementId: truncate(target.id || "", 120),
      elementClasses: truncate(target.className || "", 240),
      elementHref: truncate(target.href || target.getAttribute("href") || "", 1000),
      elementRole: truncate(target.getAttribute("role") || "", 80),
      elementName: truncate(
        target.getAttribute("name") ||
          target.getAttribute("data-shopiffy-track") ||
          target.getAttribute("data-product-handle") ||
          target.getAttribute("data-product-id") ||
          target.getAttribute("data-variant-id") ||
          "",
        120,
      ),
      selector: getElementSelector(target),
      abBlock: truncate(block?.getAttribute("data-ab-enabled") || "", 120),
      abVariant: truncate(abVariant?.getAttribute("data-ab-variant") || "", 20),
      x: Math.round(event.clientX || 0),
      y: Math.round(event.clientY || 0),
    };
  }

  function logClick(event) {
    if (!trackingSettings.loaded || !trackingSettings.trackClicks) return;

    const target = getTrackTarget(event.target);

    if (!target) return;

    const sensitiveField = target.closest(
      "input[type='password'], input[type='email'], input[type='tel'], input[type='search'], textarea",
    );

    if (sensitiveField) return;

    const payload = getClickPayload(event, target);

    postLog(CLICK_API_URL, payload, "click log").catch((err) => {
      console.error("[Shopiffy] click log fetch failed", err);
    });
  }

  function getBaseAnalyticsPayload() {
    const variant = getCurrentVariant() || getStoredVariant() || "a";

    return {
      shop: window.Shopify?.shop || window.location.hostname || "",
      experimentKey: EXPERIMENT_KEY,
      visitorId: getOrCreateVisitorId(),
      sessionId: getOrCreateSessionId(),
      variant: variant.toUpperCase(),
      pageUrl: window.location.href,
    };
  }

  function logPageDuration(reason) {
    if (!trackingSettings.loaded || !trackingSettings.trackPageDuration) return;

    const durationMs = Math.max(0, Date.now() - PAGE_STARTED_MS);

    if (durationMs <= lastDurationSentMs + 1000 && reason !== "unload") {
      return;
    }

    lastDurationSentMs = durationMs;

    postBeaconOrFetch(
      DURATION_API_URL,
      {
        ...getBaseAnalyticsPayload(),
        pageViewId: PAGE_VIEW_ID,
        startedAt: PAGE_STARTED_AT.toISOString(),
        endedAt: new Date().toISOString(),
        durationMs,
        reason,
      },
      "duration log",
    );
  }

  function startDurationTracking() {
    if (durationIntervalId || !trackingSettings.trackPageDuration) return;

    window.setTimeout(() => {
      logPageDuration("heartbeat");
    }, 5000);

    durationIntervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        logPageDuration("heartbeat");
      }
    }, 15000);
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

    loadTrackingSettings().then((settings) => {
      if (settings.trackPageDuration) {
        startDurationTracking();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  document.addEventListener("shopify:section:load", applyAB);
  document.addEventListener("shopify:section:select", applyAB);
  document.addEventListener("shopify:block:select", applyAB);
  document.addEventListener("click", logClick, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      logPageDuration("hidden");
    } else {
      logPageDuration("visible");
    }
  });
  window.addEventListener("pagehide", () => {
    if (durationIntervalId) {
      window.clearInterval(durationIntervalId);
    }

    logPageDuration("unload");
  });
  window.addEventListener("beforeunload", () => logPageDuration("unload"));

  window.__SHOPIFFY_AB__ = window.__SHOPIFFY_AB__ || {};
  window.__SHOPIFFY_AB__.apply = applyAB;
  window.__SHOPIFFY_AB__.log = logAssignment;
  window.__SHOPIFFY_AB__.getStoredVariant = getStoredVariant;
})();
