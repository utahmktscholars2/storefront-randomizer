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
    ? origin
    : "https://admin.shopify.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

  if (!cleaned.endsWith(".myshopify.com")) return null;

  return cleaned;
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
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
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
      shop,
      experimentKey,
      visitorId,
      sessionId,
      variant,
      pageUrl,
    } = body ?? {};

    const normalizedShop = normalizeShop(shop);

    if (!normalizedShop || !experimentKey || !visitorId || !variant) {
      return Response.json(
        { ok: false, error: "Missing or invalid fields" },
        { status: 400, headers: corsHeaders },
      );
    }

    await prisma.variantVisit.create({
      data: {
        shop: normalizedShop,
        experimentKey,
        visitorId,
        sessionId: sessionId || null,
        variant,
        pageUrl: pageUrl || null,
      },
    });

    return Response.json(
      { ok: true },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Visit logging error:", error);

    return Response.json(
      { ok: false, error: "Server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}