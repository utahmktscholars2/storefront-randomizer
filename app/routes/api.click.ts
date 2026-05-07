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

function cleanInt(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
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
      clickedAt,
      sequence,
      tagName,
      elementText,
      elementId,
      elementClasses,
      elementHref,
      elementRole,
      elementName,
      selector,
      abBlock,
      abVariant,
      x,
      y,
    } = body ?? {};

    const normalizedShop = normalizeShop(shop);
    const normalizedSequence = cleanInt(sequence);

    if (
      !normalizedShop ||
      !experimentKey ||
      !visitorId ||
      !variant ||
      normalizedSequence === null
    ) {
      return Response.json(
        { ok: false, error: "Missing or invalid fields" },
        { status: 400, headers: corsHeaders },
      );
    }

    const parsedClickedAt =
      typeof clickedAt === "string" ? new Date(clickedAt) : null;

    await prisma.storefrontClick.create({
      data: {
        shop: normalizedShop,
        experimentKey: cleanString(experimentKey, 120) ?? "default",
        visitorId: cleanString(visitorId, 120) ?? "",
        sessionId: cleanString(sessionId, 120),
        variant: cleanString(variant, 20) ?? "",
        pageUrl: cleanString(pageUrl, 1000),
        clickedAt:
          parsedClickedAt && !Number.isNaN(parsedClickedAt.getTime())
            ? parsedClickedAt
            : new Date(),
        sequence: normalizedSequence,
        tagName: cleanString(tagName, 40),
        elementText: cleanString(elementText, 240),
        elementId: cleanString(elementId, 120),
        elementClasses: cleanString(elementClasses, 240),
        elementHref: cleanString(elementHref, 1000),
        elementRole: cleanString(elementRole, 80),
        elementName: cleanString(elementName, 120),
        selector: cleanString(selector, 500),
        abBlock: cleanString(abBlock, 120),
        abVariant: cleanString(abVariant, 20),
        x: cleanInt(x),
        y: cleanInt(y),
      },
    });

    return Response.json(
      { ok: true },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    console.error("Click logging error:", error);

    return Response.json(
      { ok: false, error: "Server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
