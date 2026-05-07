import prisma from "../db.server";

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;

  try {
    const url = new URL(origin);

    return (
      url.protocol === "https:" &&
      (url.hostname === "admin.shopify.com" ||
        url.hostname.endsWith(".myshopify.com"))
    );
  } catch {
    return false;
  }
}

function getCorsHeaders(origin: string | null) {
  const allowOrigin = isAllowedOrigin(origin)
    ? origin ?? "https://admin.shopify.com"
    : "https://admin.shopify.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function normalizeShop(shop: unknown) {
  if (typeof shop !== "string") return null;

  const cleaned = shop
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();

  return cleaned.endsWith(".myshopify.com") ? cleaned : null;
}

function cleanString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cleanDurationMs(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  const rounded = Math.round(value);

  if (rounded < 0) return 0;

  return Math.min(rounded, 24 * 60 * 60 * 1000);
}

export async function loader({ request }: { request: Request }) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("Origin")),
  });
}

export async function action({ request }: { request: Request }) {
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!isAllowedOrigin(origin)) {
    return Response.json(
      { ok: false, error: "Origin not allowed" },
      { status: 403, headers: corsHeaders },
    );
  }

  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "Method not allowed" },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const body = await request.json();
    const {
      pageViewId,
      shop,
      experimentKey,
      visitorId,
      sessionId,
      variant,
      pageUrl,
      startedAt,
      endedAt,
      durationMs,
    } = body ?? {};

    const normalizedShop = normalizeShop(shop);
    const normalizedPageViewId = cleanString(pageViewId, 120);
    const normalizedStartedAt = cleanDate(startedAt);
    const normalizedEndedAt = cleanDate(endedAt);
    const normalizedDurationMs = cleanDurationMs(durationMs);

    if (
      !normalizedPageViewId ||
      !normalizedShop ||
      !experimentKey ||
      !visitorId ||
      !variant ||
      !normalizedStartedAt ||
      !normalizedEndedAt ||
      normalizedDurationMs === null
    ) {
      return Response.json(
        { ok: false, error: "Missing or invalid fields" },
        { status: 400, headers: corsHeaders },
      );
    }

    await prisma.pageDuration.upsert({
      where: {
        pageViewId: normalizedPageViewId,
      },
      update: {
        endedAt: normalizedEndedAt,
        durationMs: normalizedDurationMs,
      },
      create: {
        pageViewId: normalizedPageViewId,
        shop: normalizedShop,
        experimentKey: cleanString(experimentKey, 120) ?? "default",
        visitorId: cleanString(visitorId, 120) ?? "",
        sessionId: cleanString(sessionId, 120),
        variant: cleanString(variant, 20) ?? "",
        pageUrl: cleanString(pageUrl, 1000),
        startedAt: normalizedStartedAt,
        endedAt: normalizedEndedAt,
        durationMs: normalizedDurationMs,
      },
    });

    return Response.json(
      { ok: true },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Duration logging error:", error);

    return Response.json(
      { ok: false, error: "Server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
