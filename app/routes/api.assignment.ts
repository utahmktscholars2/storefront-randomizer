import prisma from "../db.server";

const ALLOWED_ORIGINS = new Set([
  "https://utahmktscholars.myshopify.com",
  "https://admin.shopify.com",
]);

function getCorsHeaders(origin: string | null) {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://utahmktscholars.myshopify.com";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function loader({ request }: { request: Request }) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("Origin")),
  });
}

export async function action({ request }: { request: Request }) {
  const corsHeaders = getCorsHeaders(request.headers.get("Origin"));

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return Response.json(
      { ok: false, error: "Method not allowed" },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const body = await request.json();
    const { shop, experimentKey, visitorId, sessionId, variant, pageUrl } = body ?? {};

    if (!experimentKey || !visitorId || !variant) {
      return Response.json(
        { ok: false, error: "Missing fields" },
        { status: 400, headers: corsHeaders },
      );
    }

    await prisma.abAssignment.create({
      data: {
        shop: shop || null,
        experimentKey,
        visitorId,
        sessionId: sessionId || null,
        variant,
        pageUrl: pageUrl || null,
      },
    });

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("Assignment error:", error);
    return Response.json(
      { ok: false, error: "Server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}