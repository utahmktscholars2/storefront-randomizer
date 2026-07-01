import { authenticate } from "../shopify.server";
import prisma from "../db.server";

function csvEscape(value) {
  if (value === null || value === undefined) return "";

  const text = value instanceof Date ? value.toISOString() : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function csvResponse(type, csv) {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="storefront-randomizer-${type}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const type = params.type;

  if (type === "visits") {
    const headers = [
      "createdAt",
      "experimentKey",
      "variant",
      "pageUrl",
      "visitorId",
      "sessionId",
    ];
    const rows = await prisma.variantVisit.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    return csvResponse(type, toCsv(headers, rows));
  }

  if (type === "clicks") {
    const headers = [
      "clickedAt",
      "sequence",
      "experimentKey",
      "variant",
      "pageUrl",
      "elementText",
      "elementName",
      "elementHref",
      "selector",
      "visitorId",
      "sessionId",
    ];
    const rows = await prisma.storefrontClick.findMany({
      where: { shop },
      orderBy: [{ clickedAt: "desc" }, { sequence: "desc" }],
      take: 5000,
    });

    return csvResponse(type, toCsv(headers, rows));
  }

  if (type === "durations") {
    const headers = [
      "startedAt",
      "endedAt",
      "durationMs",
      "experimentKey",
      "variant",
      "pageUrl",
      "visitorId",
      "sessionId",
      "pageViewId",
    ];
    const rows = await prisma.pageDuration.findMany({
      where: { shop },
      orderBy: { endedAt: "desc" },
      take: 5000,
    });

    return csvResponse(type, toCsv(headers, rows));
  }

  if (type === "assignments") {
    const headers = [
      "id",
      "createdAt",
      "experimentKey",
      "variant",
      "pageUrl",
      "visitorId",
      "sessionId",
    ];
    const assignments = await prisma.abAssignment.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    const rows = assignments.map((row) => ({
      ...row,
      id: row.id.toString(),
    }));

    return csvResponse(type, toCsv(headers, rows));
  }

  return new Response("Not found", { status: 404 });
};
