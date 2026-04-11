import React from "react";
import "@testing-library/jest-dom/extend-expect";
import { render, screen } from "@testing-library/react";
import { Context as ReforgeContext, Contexts } from "@reforge-com/javascript";
import fetchMock, { enableFetchMocks } from "jest-fetch-mock";
import { reforge as globalReforge, ReforgeProvider, useReforge, SharedSettings } from "../index";

enableFetchMocks();

// eslint-disable-next-line no-console
const onError = console.error;
const sdkKey = "nested-providers-test-sdk-key";

function InnerUserComponent() {
  const { isEnabled, loading, reforge, settings } = useReforge();

  if (loading) {
    return <div>Loading inner component...</div>;
  }

  return (
    <div
      data-testid="inner-wrapper"
      data-reforge-instance-hash={reforge.instanceHash}
      data-reforge-settings={JSON.stringify(settings)}
    >
      <h1 data-testid="inner-greeting">{reforge.get("greeting")?.toString() ?? "Default"}</h1>
      {isEnabled("secretFeature") && (
        <button data-testid="inner-secret-feature" type="submit" title="secret-feature">
          Secret feature
        </button>
      )}
    </div>
  );
}

function OuterUserComponent({
  admin,
  innerProviderSettings,
  innerUserContext,
}: {
  admin: { name: string };
  innerUserContext: Contexts;
  innerProviderSettings: SharedSettings;
}) {
  const { get, isEnabled, loading, reforge, settings: parentProviderSettings } = useReforge();

  let innerSettings = innerProviderSettings;
  if (Object.keys(innerProviderSettings).length === 0) {
    // inherit the parent settings if none are provided
    innerSettings = parentProviderSettings;
  }

  if (loading) {
    return <div>Loading outer component...</div>;
  }

  return (
    <div
      data-testid="outer-wrapper"
      data-reforge-instance-hash={reforge.instanceHash}
      data-reforge-settings={JSON.stringify(parentProviderSettings)}
    >
      <h1 data-testid="outer-greeting">{(get("greeting") as string) ?? "Default"}</h1>
      {isEnabled("secretFeature") && (
        <button data-testid="outer-secret-feature" type="submit" title="secret-feature">
          Secret feature
        </button>
      )}

      <div>
        <h1>You are looking at {admin.name}</h1>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <ReforgeProvider
          {...innerSettings}
          contextAttributes={innerUserContext}
          sdkKey={innerSettings.sdkKey!}
        >
          <InnerUserComponent />
        </ReforgeProvider>
      </div>
    </div>
  );
}
function App({
  outerUserContext,
  innerUserContext,
  innerProviderSettings,
}: {
  outerUserContext: Contexts;
  innerUserContext: Contexts;
  innerProviderSettings?: SharedSettings;
}) {
  return (
    <ReforgeProvider
      sdkKey={sdkKey}
      contextAttributes={outerUserContext}
      onError={onError}
      // eslint-disable-next-line react/jsx-boolean-value
      collectEvaluationSummaries={false}
    >
      <OuterUserComponent
        admin={{ name: "John Doe" }}
        innerUserContext={innerUserContext}
        innerProviderSettings={innerProviderSettings || {}}
      />
    </ReforgeProvider>
  );
}

it("allows nested `ReforgeProvider`s that reuse the parent provider's settings", async () => {
  const outerUserContext = {
    user: { email: "dr.smith@example.com", doctor: true },
    outerOnly: { city: "NYC" },
  };
  const innerUserContext = { user: { email: "patient@example.com", doctor: false } };

  const outerUserFetchData = {
    evaluations: {
      greeting: { value: { string: "Greetings, Doctor" } },
      secretFeature: { value: { bool: true } },
    },
  };
  const innerUserFetchData = {
    evaluations: {
      greeting: { value: { string: "Hi" } },
      secretFeature: { value: { bool: false } },
    },
  };

  fetchMock.mockResponse((req) => {
    if (req.url.includes(new ReforgeContext(outerUserContext).encode())) {
      return Promise.resolve({
        body: JSON.stringify(outerUserFetchData),
        status: 200,
      });
    }

    return Promise.resolve({
      body: JSON.stringify(innerUserFetchData),
      status: 200,
    });
  });

  render(<App outerUserContext={outerUserContext} innerUserContext={innerUserContext} />);

  const outerGreeting = await screen.findByTestId("outer-greeting");
  const innerGreeting = await screen.findByTestId("inner-greeting");

  expect(outerGreeting).toHaveTextContent("Greetings, Doctor");
  expect(innerGreeting).toHaveTextContent("Hi");

  expect(screen.queryByTestId("outer-secret-feature")).toBeInTheDocument();
  expect(screen.queryByTestId("inner-secret-feature")).not.toBeInTheDocument();

  // Verify that each provider has its own copy of Reforge
  const outerReforgeWrapper = screen.getByTestId("outer-wrapper");
  const innerReforgeWrapper = screen.getByTestId("inner-wrapper");

  const outerReforgeInstanceHash = outerReforgeWrapper.getAttribute("data-reforge-instance-hash");
  const innerReforgeInstanceHash = innerReforgeWrapper.getAttribute("data-reforge-instance-hash");

  expect(outerReforgeInstanceHash).toHaveLength(36);
  expect(innerReforgeInstanceHash).toHaveLength(36);
  expect(outerReforgeInstanceHash).not.toEqual(innerReforgeInstanceHash);
  expect(outerReforgeInstanceHash).toEqual(globalReforge.instanceHash);

  expect(outerReforgeWrapper.getAttribute("data-reforge-settings")).toStrictEqual(
    JSON.stringify({
      sdkKey,
      collectEvaluationSummaries: false,
      onError,
    })
  );

  // These are all inherited
  expect(innerReforgeWrapper.getAttribute("data-reforge-settings")).toStrictEqual(
    JSON.stringify({
      sdkKey,
      collectEvaluationSummaries: false,
      onError,
    })
  );
});

it("allows nested `ReforgeProvider`s that use new settings", async () => {
  const outerUserContext = {
    user: { email: "dr.smith@example.com", doctor: true },
    outerOnly: { city: "NYC" },
  };
  const innerUserContext = { user: { email: "patient@example.com", doctor: false } };

  const outerUserFetchData = {
    evaluations: {
      greeting: { value: { string: "Greetings, Doctor" } },
      secretFeature: { value: { bool: true } },
    },
  };
  const innerUserFetchData = {
    evaluations: {
      greeting: { value: { string: "Hi" } },
      secretFeature: { value: { bool: false } },
    },
  };

  fetchMock.mockResponse((req) => {
    if (req.url.includes(new ReforgeContext(outerUserContext).encode())) {
      return Promise.resolve({
        body: JSON.stringify(outerUserFetchData),
        status: 200,
      });
    }

    return Promise.resolve({
      body: JSON.stringify(innerUserFetchData),
      status: 200,
    });
  });

  const innerProviderSettings = {
    sdkKey: "inner-sdk-key",
    collectLoggerNames: true,
  };

  render(
    <App
      outerUserContext={outerUserContext}
      innerUserContext={innerUserContext}
      innerProviderSettings={innerProviderSettings}
    />
  );

  const outerGreeting = await screen.findByTestId("outer-greeting");
  const innerGreeting = await screen.findByTestId("inner-greeting");

  expect(outerGreeting).toHaveTextContent("Greetings, Doctor");
  expect(innerGreeting).toHaveTextContent("Hi");

  expect(screen.queryByTestId("outer-secret-feature")).toBeInTheDocument();
  expect(screen.queryByTestId("inner-secret-feature")).not.toBeInTheDocument();

  // Verify that each provider has its own copy of Reforge
  const outerReforgeWrapper = screen.getByTestId("outer-wrapper");
  const innerReforgeWrapper = screen.getByTestId("inner-wrapper");

  expect(outerReforgeWrapper.getAttribute("data-reforge-settings")).toStrictEqual(
    JSON.stringify({
      sdkKey,
      collectEvaluationSummaries: false,
      onError,
    })
  );

  // These are NOT inherited so we get what we set on the inner provider
  expect(innerReforgeWrapper.getAttribute("data-reforge-settings")).toStrictEqual(
    JSON.stringify({
      sdkKey: "inner-sdk-key",
      collectLoggerNames: true,
    })
  );
});
