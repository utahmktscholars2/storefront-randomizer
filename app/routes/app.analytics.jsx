import { useLoaderData, useLocation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thStyle = {
  textAlign: "left",
  borderBottom: "1px solid #dfe3e8",
  padding: "8px 6px",
  whiteSpace: "nowrap",
};

const tdStyle = {
  borderBottom: "1px solid #edf0f2",
  padding: "8px 6px",
  verticalAlign: "top",
};

function iso(value) {
  return value ? new Date(value).toISOString() : "";
}

function seconds(ms) {
  return Math.round((ms / 1000) * 100) / 100;
}

function compactUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [
    assignmentCount,
    visitCount,
    clickCount,
    durationCount,
    recentAssignments,
    recentVisits,
    recentClicks,
    recentDurations,
    variantVisits,
    variantAssignments,
    durationAggregate,
  ] = await Promise.all([
    prisma.abAssignment.count({ where: { shop } }),
    prisma.variantVisit.count({ where: { shop } }),
    prisma.storefrontClick.count({ where: { shop } }),
    prisma.pageDuration.count({ where: { shop } }),
    prisma.abAssignment.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.variantVisit.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.storefrontClick.findMany({
      where: { shop },
      orderBy: [{ clickedAt: "desc" }, { sequence: "desc" }],
      take: 25,
    }),
    prisma.pageDuration.findMany({
      where: { shop },
      orderBy: { endedAt: "desc" },
      take: 25,
    }),
    prisma.variantVisit.groupBy({
      by: ["variant"],
      where: { shop },
      _count: { _all: true },
      orderBy: { variant: "asc" },
    }),
    prisma.abAssignment.groupBy({
      by: ["variant"],
      where: { shop },
      _count: { _all: true },
      orderBy: { variant: "asc" },
    }),
    prisma.pageDuration.aggregate({
      where: { shop },
      _avg: { durationMs: true },
      _max: { durationMs: true },
    }),
  ]);

  return {
    shop,
    summary: {
      assignmentCount,
      visitCount,
      clickCount,
      durationCount,
      averageDurationSeconds: durationAggregate._avg.durationMs
        ? seconds(durationAggregate._avg.durationMs)
        : 0,
      maxDurationSeconds: durationAggregate._max.durationMs
        ? seconds(durationAggregate._max.durationMs)
        : 0,
    },
    variantVisits: variantVisits.map((row) => ({
      variant: row.variant,
      count: row._count._all,
    })),
    variantAssignments: variantAssignments.map((row) => ({
      variant: row.variant,
      count: row._count._all,
    })),
    recentAssignments: recentAssignments.map((row) => ({
      id: row.id.toString(),
      experimentKey: row.experimentKey,
      visitorId: row.visitorId,
      sessionId: row.sessionId,
      variant: row.variant,
      pageUrl: compactUrl(row.pageUrl),
      createdAt: iso(row.createdAt),
    })),
    recentVisits: recentVisits.map((row) => ({
      id: row.id,
      experimentKey: row.experimentKey,
      visitorId: row.visitorId,
      sessionId: row.sessionId,
      variant: row.variant,
      pageUrl: compactUrl(row.pageUrl),
      createdAt: iso(row.createdAt),
    })),
    recentClicks: recentClicks.map((row) => ({
      id: row.id,
      clickedAt: iso(row.clickedAt),
      sequence: row.sequence,
      variant: row.variant,
      pageUrl: compactUrl(row.pageUrl),
      elementText: row.elementText,
      elementName: row.elementName,
      elementHref: compactUrl(row.elementHref),
      selector: row.selector,
    })),
    recentDurations: recentDurations.map((row) => ({
      id: row.id,
      startedAt: iso(row.startedAt),
      endedAt: iso(row.endedAt),
      seconds: seconds(row.durationMs),
      variant: row.variant,
      pageUrl: compactUrl(row.pageUrl),
      visitorId: row.visitorId,
      sessionId: row.sessionId,
    })),
  };
};

function SummaryItem({ label, value }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small">
        <s-text>{label}</s-text>
        <s-heading>{value}</s-heading>
      </s-stack>
    </s-box>
  );
}

function EmptyRow({ columns }) {
  return (
    <tr>
      <td style={tdStyle} colSpan={columns}>
        No data yet
      </td>
    </tr>
  );
}

function ExportLink({ href, children }) {
  const location = useLocation();
  const downloadHref = `${href}${location.search || ""}`;

  return (
    <a
      href={downloadHref}
      download
      style={{ color: "#005bd3", textDecoration: "none" }}
    >
      {children}
    </a>
  );
}

export default function Analytics() {
  const {
    shop,
    summary,
    variantVisits,
    variantAssignments,
    recentAssignments,
    recentVisits,
    recentClicks,
    recentDurations,
  } = useLoaderData();

  return (
    <s-page heading="Analytics">
      <s-section heading="Overview">
        <s-stack direction="block" gap="base">
          <s-paragraph>{shop}</s-paragraph>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            }}
          >
            <SummaryItem label="Assignments" value={summary.assignmentCount} />
            <SummaryItem label="Visits" value={summary.visitCount} />
            <SummaryItem label="Clicks" value={summary.clickCount} />
            <SummaryItem label="Page durations" value={summary.durationCount} />
            <SummaryItem
              label="Avg seconds"
              value={summary.averageDurationSeconds}
            />
            <SummaryItem
              label="Max seconds"
              value={summary.maxDurationSeconds}
            />
          </div>
        </s-stack>
      </s-section>

      <s-section heading="Variant totals">
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <s-heading>Visits</s-heading>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Variant</th>
                  <th style={thStyle}>Count</th>
                </tr>
              </thead>
              <tbody>
                {variantVisits.length ? (
                  variantVisits.map((row) => (
                    <tr key={row.variant}>
                      <td style={tdStyle}>{row.variant}</td>
                      <td style={tdStyle}>{row.count}</td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow columns={2} />
                )}
              </tbody>
            </table>
          </div>
          <div>
            <s-heading>Assignments</s-heading>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Variant</th>
                  <th style={thStyle}>Count</th>
                </tr>
              </thead>
              <tbody>
                {variantAssignments.length ? (
                  variantAssignments.map((row) => (
                    <tr key={row.variant}>
                      <td style={tdStyle}>{row.variant}</td>
                      <td style={tdStyle}>{row.count}</td>
                    </tr>
                  ))
                ) : (
                  <EmptyRow columns={2} />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </s-section>

      <s-section heading="Recent clicks">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Seq</th>
              <th style={thStyle}>Variant</th>
              <th style={thStyle}>Page</th>
              <th style={thStyle}>Element</th>
              <th style={thStyle}>Href</th>
            </tr>
          </thead>
          <tbody>
            {recentClicks.length ? (
              recentClicks.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.clickedAt}</td>
                  <td style={tdStyle}>{row.sequence}</td>
                  <td style={tdStyle}>{row.variant}</td>
                  <td style={tdStyle}>{row.pageUrl}</td>
                  <td style={tdStyle}>
                    {row.elementText || row.elementName || row.selector}
                  </td>
                  <td style={tdStyle}>{row.elementHref}</td>
                </tr>
              ))
            ) : (
              <EmptyRow columns={6} />
            )}
          </tbody>
        </table>
      </s-section>

      <s-section heading="Recent page durations">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Ended</th>
              <th style={thStyle}>Seconds</th>
              <th style={thStyle}>Variant</th>
              <th style={thStyle}>Page</th>
              <th style={thStyle}>Visitor</th>
            </tr>
          </thead>
          <tbody>
            {recentDurations.length ? (
              recentDurations.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.endedAt}</td>
                  <td style={tdStyle}>{row.seconds}</td>
                  <td style={tdStyle}>{row.variant}</td>
                  <td style={tdStyle}>{row.pageUrl}</td>
                  <td style={tdStyle}>{row.visitorId}</td>
                </tr>
              ))
            ) : (
              <EmptyRow columns={5} />
            )}
          </tbody>
        </table>
      </s-section>

      <s-section heading="Recent visits">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Experiment</th>
              <th style={thStyle}>Variant</th>
              <th style={thStyle}>Page</th>
              <th style={thStyle}>Visitor</th>
            </tr>
          </thead>
          <tbody>
            {recentVisits.length ? (
              recentVisits.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.createdAt}</td>
                  <td style={tdStyle}>{row.experimentKey}</td>
                  <td style={tdStyle}>{row.variant}</td>
                  <td style={tdStyle}>{row.pageUrl}</td>
                  <td style={tdStyle}>{row.visitorId}</td>
                </tr>
              ))
            ) : (
              <EmptyRow columns={5} />
            )}
          </tbody>
        </table>
      </s-section>

      <s-section heading="Recent assignments">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Experiment</th>
              <th style={thStyle}>Variant</th>
              <th style={thStyle}>Page</th>
              <th style={thStyle}>Visitor</th>
            </tr>
          </thead>
          <tbody>
            {recentAssignments.length ? (
              recentAssignments.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.createdAt}</td>
                  <td style={tdStyle}>{row.experimentKey}</td>
                  <td style={tdStyle}>{row.variant}</td>
                  <td style={tdStyle}>{row.pageUrl}</td>
                  <td style={tdStyle}>{row.visitorId}</td>
                </tr>
              ))
            ) : (
              <EmptyRow columns={5} />
            )}
          </tbody>
        </table>
      </s-section>

      <s-section slot="aside" heading="Exports">
        <s-stack direction="block" gap="base">
          <ExportLink href="/app/export/visits">Download visits CSV</ExportLink>
          <ExportLink href="/app/export/clicks">Download clicks CSV</ExportLink>
          <ExportLink href="/app/export/durations">
            Download durations CSV
          </ExportLink>
          <ExportLink href="/app/export/assignments">
            Download assignments CSV
          </ExportLink>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
