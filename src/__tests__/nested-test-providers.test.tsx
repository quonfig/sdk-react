import React, { act } from "react";
import "@testing-library/jest-dom/extend-expect";
import { render, screen } from "@testing-library/react";
import {
  quonfig as globalQuonfig,
  QuonfigProvider,
  useQuonfig,
  QuonfigTestProvider,
  QuonfigTestProviderProps,
} from "../index";

type Provider = typeof QuonfigTestProvider | typeof QuonfigProvider;

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
  const { isEnabled, loading, quonfig } = useQuonfig();

  if (loading) {
    return <div>Loading inner component...</div>;
  }

  return (
    <div data-testid="inner-wrapper" data-quonfig-instance-hash={quonfig.instanceHash}>
      <h1 data-testid="inner-greeting">{quonfig.get("greeting")?.toString() ?? "Default"}</h1>
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
  innerTestConfig: QuonfigTestProviderProps["config"];
  InnerProvider: Provider;
}) {
  const { get, isEnabled, loading, quonfig, settings } = useQuonfig();

  if (loading) {
    return <div>Loading outer component...</div>;
  }

  return (
    <div data-testid="outer-wrapper" data-quonfig-instance-hash={quonfig.instanceHash}>
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
  innerTestConfig: QuonfigTestProviderProps["config"];
  outerTestConfig: QuonfigTestProviderProps["config"];
  InnerProvider: Provider;
}) {
  return (
    <QuonfigTestProvider config={outerTestConfig}>
      <OuterUserComponent
        admin={{ name: "John Doe" }}
        innerTestConfig={innerTestConfig}
        InnerProvider={InnerProvider}
      />
    </QuonfigTestProvider>
  );
}

it("allows nested test `QuonfigTestProvider`s", async () => {
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
      InnerProvider={QuonfigTestProvider}
    />
  );

  const outerGreeting = await screen.findByTestId("outer-greeting");
  const innerGreeting = await screen.findByTestId("inner-greeting");

  expect(outerGreeting).toHaveTextContent("Greetings, Doctor");
  expect(innerGreeting).toHaveTextContent("Hi");

  expect(screen.queryByTestId("outer-secret-feature")).toBeInTheDocument();
  expect(screen.queryByTestId("inner-secret-feature")).not.toBeInTheDocument();

  // Verify that each provider has its own copy of Quonfig
  const outerQuonfigInstanceHash = screen
    .getByTestId("outer-wrapper")
    .getAttribute("data-quonfig-instance-hash");
  const innerQuonfigInstanceHash = screen
    .getByTestId("inner-wrapper")
    .getAttribute("data-quonfig-instance-hash");

  expect(outerQuonfigInstanceHash).toHaveLength(36);
  expect(innerQuonfigInstanceHash).toHaveLength(36);
  expect(outerQuonfigInstanceHash).not.toEqual(innerQuonfigInstanceHash);
  expect(outerQuonfigInstanceHash).toEqual(globalQuonfig.instanceHash);
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
    greeting: { value: { type: "string", value: "Hi" } },
    secretFeature: { value: { type: "bool", value: false } },
  };

  const promise = stubConfig(innerTestConfig);

  render(
    <App outerTestConfig={outerTestConfig} innerTestConfig={{}} InnerProvider={QuonfigProvider} />
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

  // Verify that each provider has its own copy of Quonfig
  const outerQuonfigInstanceHash = screen
    .getByTestId("outer-wrapper")
    .getAttribute("data-quonfig-instance-hash");
  const innerQuonfigInstanceHash = screen
    .getByTestId("inner-wrapper")
    .getAttribute("data-quonfig-instance-hash");

  expect(outerQuonfigInstanceHash).toHaveLength(36);
  expect(innerQuonfigInstanceHash).toHaveLength(36);
  expect(outerQuonfigInstanceHash).not.toEqual(innerQuonfigInstanceHash);
});
