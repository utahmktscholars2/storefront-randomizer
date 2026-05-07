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

    const saved = await prisma.abAssignment.upsert({
      where: {
        shop_experimentKey_visitorId_sessionId_pageUrl: {
          shop: normalizedShop,
          experimentKey,
          visitorId,
          sessionId: sessionId || "",
          pageUrl: pageUrl || "",
        },
      },
      update: {
        variant,
      },
      create: {
        shop: normalizedShop,
        experimentKey,
        visitorId,
        sessionId: sessionId || "",
        variant,
        pageUrl: pageUrl || "",
      },
    });

    return Response.json(
      { ok: true, id: saved.id.toString() },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Assignment error:", error);

    return Response.json(
      { ok: false, error: "Server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
