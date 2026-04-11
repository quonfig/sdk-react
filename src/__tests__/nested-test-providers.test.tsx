import React, { act } from "react";
import "@testing-library/jest-dom/extend-expect";
import { render, screen } from "@testing-library/react";
import {
  reforge as globalReforge,
  ReforgeProvider,
  useReforge,
  ReforgeTestProvider,
  ReforgeTestProviderProps,
} from "../index";

type Provider = typeof ReforgeTestProvider | typeof ReforgeProvider;

type Config = { [key: string]: any };

const stubConfig = (config: Config) =>
  new Promise((resolve) => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => {
          setTimeout(resolve);
          return { evaluations: config };
        },
      })
    ) as jest.Mock;
  });

function InnerUserComponent() {
  const { isEnabled, loading, reforge } = useReforge();

  if (loading) {
    return <div>Loading inner component...</div>;
  }

  return (
    <div data-testid="inner-wrapper" data-reforge-instance-hash={reforge.instanceHash}>
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
  innerTestConfig,
  InnerProvider,
}: {
  admin: { name: string };
  innerTestConfig: ReforgeTestProviderProps["config"];
  InnerProvider: Provider;
}) {
  const { get, isEnabled, loading, reforge, settings } = useReforge();

  if (loading) {
    return <div>Loading outer component...</div>;
  }

  return (
    <div data-testid="outer-wrapper" data-reforge-instance-hash={reforge.instanceHash}>
      <h1 data-testid="outer-greeting">{(get("greeting") as string) ?? "Default"}</h1>
      {isEnabled("secretFeature") && (
        <button data-testid="outer-secret-feature" type="submit" title="secret-feature">
          Secret feature
        </button>
      )}

      <div>
        <h1>You are looking at {admin.name}</h1>
        <InnerProvider
          config={innerTestConfig}
          /* eslint-disable-next-line react/jsx-props-no-spreading */
          {...settings}
          sdkKey={settings.sdkKey!}
          contextAttributes={{ user: { email: "test@example.com" } }}
        >
          <InnerUserComponent />
        </InnerProvider>
      </div>
    </div>
  );
}

function App({
  innerTestConfig,
  outerTestConfig,
  InnerProvider,
}: {
  innerTestConfig: ReforgeTestProviderProps["config"];
  outerTestConfig: ReforgeTestProviderProps["config"];
  InnerProvider: Provider;
}) {
  return (
    <ReforgeTestProvider config={outerTestConfig}>
      <OuterUserComponent
        admin={{ name: "John Doe" }}
        innerTestConfig={innerTestConfig}
        InnerProvider={InnerProvider}
      />
    </ReforgeTestProvider>
  );
}

it("allows nested test `ReforgeTestProvider`s", async () => {
  const outerUserContext = {
    user: { email: "dr.smith@example.com", doctor: true },
    outerOnly: { city: "NYC" },
  };
  const innerUserContext = { user: { email: "patient@example.com", doctor: false } };

  const outerTestConfig = {
    contextAttributes: outerUserContext,
    greeting: "Greetings, Doctor",
    secretFeature: true,
  };

  const innerTestConfig = {
    contextAttributes: innerUserContext,
    greeting: "Hi",
    secretFeature: false,
  };

  render(
    <App
      outerTestConfig={outerTestConfig}
      innerTestConfig={innerTestConfig}
      InnerProvider={ReforgeTestProvider}
    />
  );

  const outerGreeting = await screen.findByTestId("outer-greeting");
  const innerGreeting = await screen.findByTestId("inner-greeting");

  expect(outerGreeting).toHaveTextContent("Greetings, Doctor");
  expect(innerGreeting).toHaveTextContent("Hi");

  expect(screen.queryByTestId("outer-secret-feature")).toBeInTheDocument();
  expect(screen.queryByTestId("inner-secret-feature")).not.toBeInTheDocument();

  // Verify that each provider has its own copy of Reforge
  const outerReforgeInstanceHash = screen
    .getByTestId("outer-wrapper")
    .getAttribute("data-reforge-instance-hash");
  const innerReforgeInstanceHash = screen
    .getByTestId("inner-wrapper")
    .getAttribute("data-reforge-instance-hash");

  expect(outerReforgeInstanceHash).toHaveLength(36);
  expect(innerReforgeInstanceHash).toHaveLength(36);
  expect(outerReforgeInstanceHash).not.toEqual(innerReforgeInstanceHash);
  expect(outerReforgeInstanceHash).toEqual(globalReforge.instanceHash);
});

it("can nest a real provider within a test provider", async () => {
  const outerUserContext = {
    user: { email: "dr.smith@example.com", doctor: true },
    outerOnly: { city: "NYC" },
  };

  const outerTestConfig = {
    contextAttributes: outerUserContext,
    greeting: "Greetings, Doctor",
    secretFeature: true,
  };

  const innerTestConfig = {
    greeting: { value: { string: "Hi" } },
    secretFeature: { value: { bool: false } },
  };

  const promise = stubConfig(innerTestConfig);

  render(
    <App outerTestConfig={outerTestConfig} innerTestConfig={{}} InnerProvider={ReforgeProvider} />
  );

  await act(async () => {
    await promise;
  });

  const outerGreeting = await screen.findByTestId("outer-greeting");
  const innerGreeting = await screen.findByTestId("inner-greeting");

  expect(outerGreeting).toHaveTextContent("Greetings, Doctor");
  expect(innerGreeting).toHaveTextContent("Hi");

  expect(screen.queryByTestId("outer-secret-feature")).toBeInTheDocument();
  expect(screen.queryByTestId("inner-secret-feature")).not.toBeInTheDocument();

  // Verify that each provider has its own copy of Reforge
  const outerReforgeInstanceHash = screen
    .getByTestId("outer-wrapper")
    .getAttribute("data-reforge-instance-hash");
  const innerReforgeInstanceHash = screen
    .getByTestId("inner-wrapper")
    .getAttribute("data-reforge-instance-hash");

  expect(outerReforgeInstanceHash).toHaveLength(36);
  expect(innerReforgeInstanceHash).toHaveLength(36);
  expect(outerReforgeInstanceHash).not.toEqual(innerReforgeInstanceHash);
});
