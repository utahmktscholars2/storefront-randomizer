import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

async function getOrCreateSettings(shop) {
  return prisma.shopTrackingSettings.upsert({
    where: { shop },
    update: {},
    create: {
      shop,
      trackClicks: true,
      trackPageDuration: true,
    },
  });
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await getOrCreateSettings(session.shop);

  return {
    shop: session.shop,
    settings: {
      trackClicks: settings.trackClicks,
      trackPageDuration: settings.trackPageDuration,
    },
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const settings = await prisma.shopTrackingSettings.upsert({
    where: { shop: session.shop },
    update: {
      trackClicks: formData.get("trackClicks") === "on",
      trackPageDuration: formData.get("trackPageDuration") === "on",
    },
    create: {
      shop: session.shop,
      trackClicks: formData.get("trackClicks") === "on",
      trackPageDuration: formData.get("trackPageDuration") === "on",
    },
  });

  return {
    ok: true,
    settings: {
      trackClicks: settings.trackClicks,
      trackPageDuration: settings.trackPageDuration,
    },
  };
};

export default function Index() {
  const { shop, settings } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const currentSettings = actionData?.settings ?? settings;

  return (
    <s-page heading="Storefront Randomizer">
      <Form method="post">
        <s-section heading="Tracking settings">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Control which optional storefront analytics are stored for {shop}.
            </s-paragraph>

            <label style={{ display: "block" }}>
              <input
                type="checkbox"
                name="trackClicks"
                defaultChecked={currentSettings.trackClicks}
                style={{ marginRight: 8 }}
              />
              Store shopper click events
            </label>

            <label style={{ display: "block" }}>
              <input
                type="checkbox"
                name="trackPageDuration"
                defaultChecked={currentSettings.trackPageDuration}
                style={{ marginRight: 8 }}
              />
              Store time spent on each page
            </label>

            <s-stack direction="inline" gap="base">
              <s-button
                type="submit"
                variant="primary"
                accessibilityLabel="Save tracking settings"
                {...(isSaving ? { loading: true } : {})}
              >
                Save settings
              </s-button>
              {actionData?.ok && <s-text>Saved</s-text>}
            </s-stack>
          </s-stack>
        </s-section>
      </Form>

      <s-section slot="aside" heading="Stored data">
        <s-unordered-list>
          <s-list-item>Assignments and visits stay enabled for experiment reporting.</s-list-item>
          <s-list-item>Click events are written to StorefrontClick only when enabled.</s-list-item>
          <s-list-item>Page duration is written to PageDuration only when enabled.</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
