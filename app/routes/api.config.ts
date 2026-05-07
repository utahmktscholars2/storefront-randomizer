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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (!isAllowedOrigin(origin)) {
    return Response.json(
      { ok: false, error: "Origin not allowed" },
      { status: 403, headers: corsHeaders },
    );
  }

  const url = new URL(request.url);
  const normalizedShop = normalizeShop(url.searchParams.get("shop"));

  if (!normalizedShop) {
    return Response.json(
      { ok: false, error: "Missing or invalid shop" },
      { status: 400, headers: corsHeaders },
    );
  }

  const settings = await prisma.shopTrackingSettings.findUnique({
    where: { shop: normalizedShop },
  });

  return Response.json(
    {
      ok: true,
      trackClicks: settings?.trackClicks ?? true,
      trackPageDuration: settings?.trackPageDuration ?? true,
    },
    { status: 200, headers: corsHeaders },
  );
}

export async function action({ request }: { request: Request }) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("Origin")),
  });
}
