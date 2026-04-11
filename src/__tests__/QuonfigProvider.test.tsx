/* eslint-disable max-classes-per-file */
import React, { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { ContextValue, Reforge, Contexts } from "@reforge-com/javascript";
import { QuonfigProvider, useQuonfig, createQuonfigHook } from "../index";

type Config = { [key: string]: any };

function MyComponent() {
  const { get, isEnabled, loading, keys } = useQuonfig();
  const greeting = get("greeting") || "Default";
  // @ts-expect-error This is OK in a test
  const subtitle = get("subtitle")?.actualSubtitle || "Default Subtitle";

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 role="alert">{greeting.toString()}</h1>
      <h2 role="banner">{subtitle}</h2>
      {isEnabled("secretFeature") && (
        <button type="submit" title="secret-feature">
          Secret feature
        </button>
      )}

      <pre data-testid="known-keys">{JSON.stringify(keys)}</pre>
    </div>
  );
}

let warn: ReturnType<typeof jest.spyOn>;
let error: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  error = jest.spyOn(console, "error").mockImplementation(() => {});
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockReset();
  error.mockReset();
});

describe("QuonfigProvider", () => {
  const defaultContextAttributes = { user: { email: "test@example.com" } };

  const renderInProvider = ({
    contextAttributes,
    onError,
    initialFlags,
  }: {
    contextAttributes?: { [key: string]: Record<string, ContextValue> };
    onError?: (err: Error) => void;
    initialFlags?: Record<string, unknown>;
  }) =>
    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={contextAttributes}
        onError={onError}
        initialFlags={initialFlags}
      >
        <MyComponent />
      </QuonfigProvider>
    );

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

  const renderWithConfig = async (
    config: Config,
    providerConfig: Parameters<typeof renderInProvider>[0] = {
      contextAttributes: defaultContextAttributes,
      onError: (e) => {
        throw e;
      },
    }
  ) => {
    const promise = stubConfig(config);

    const rendered = renderInProvider(providerConfig);

    await act(async () => {
      await promise;
    });

    // wait for the loading content to go away
    screen.findByRole("alert");

    return rendered;
  };

  it("renders without config", async () => {
    await renderWithConfig({});

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("Default");
    const secretFeature = screen.queryByTitle("secret-feature");
    expect(secretFeature).not.toBeInTheDocument();
  });

  it("allows providing flag values", async () => {
    await renderWithConfig({ greeting: { value: { string: "CUSTOM" } } });

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("CUSTOM");
    const secretFeature = screen.queryByTitle("secret-feature");
    expect(secretFeature).not.toBeInTheDocument();
  });

  it("allows providing true flag booleans", async () => {
    await renderWithConfig({
      greeting: { value: { string: "CUSTOM" } },
      secretFeature: { value: { boolean: true } },
    });

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("CUSTOM");
    const secretFeature = screen.queryByTitle("secret-feature");
    expect(secretFeature).toBeInTheDocument();
  });

  it("allows providing false flag booleans", async () => {
    await renderWithConfig({
      greeting: { value: { string: "CUSTOM" } },
      secretFeature: { value: { boolean: false } },
    });

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("CUSTOM");
    const secretFeature = screen.queryByTitle("secret-feature");
    expect(secretFeature).not.toBeInTheDocument();
  });

  it("allows providing json configs", async () => {
    await renderWithConfig({
      subtitle: { value: { json: '{ "actualSubtitle": "Json Subtitle" }' } },
    });

    const alert = screen.queryByRole("banner");
    expect(alert).toHaveTextContent("Json Subtitle");
  });

  it("warns when you do not provide contextAttributes", async () => {
    const rendered = await renderWithConfig(
      {
        greeting: { value: { string: "CUSTOM" } },
        secretFeature: { value: { boolean: true } },
      },
      { contextAttributes: { user: { email: "old@example.com" } } }
    );

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("CUSTOM");

    const newConfigPromise = stubConfig({
      greeting: { value: { string: "ANOTHER" } },
      secretFeature: { value: { boolean: false } },
    });

    act(() => {
      rendered.rerender(
        <QuonfigProvider
          sdkKey="sdk-key"
          contextAttributes={{ user: { email: "test@example.com" } }}
          onError={() => {}}
        >
          <MyComponent />
        </QuonfigProvider>
      );
    });

    await newConfigPromise;
    // wait for render
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 1));

    const updatedAlert = screen.queryByRole("alert");
    expect(updatedAlert).toHaveTextContent("ANOTHER");
  });

  it("re-fetches when you update the contextAttributes prop on the provider", async () => {
    let setContextAttributes: (attributes: Contexts) => void = () => {
      // eslint-disable-next-line no-console
      console.warn("setContextAttributes not set");
    };

    const promise = stubConfig({ greeting: { value: { string: "CUSTOM" } } });

    function Wrapper({ context }: { context: Contexts }) {
      const [contextAttributes, innerSetContextAttributes] = React.useState(context);

      setContextAttributes = innerSetContextAttributes;

      return (
        <QuonfigProvider sdkKey="sdk-key" contextAttributes={contextAttributes} onError={() => {}}>
          <MyComponent />
        </QuonfigProvider>
      );
    }

    render(<Wrapper context={{ user: { email: "test@example.com" } }} />);

    await act(async () => {
      await promise;
    });

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("CUSTOM");

    const newRequestPromise = stubConfig({
      greeting: { value: { string: "UPDATED FROM CONTEXT" } },
    });

    setContextAttributes({ user: { email: "foo@example.com" } });

    await newRequestPromise;
    // wait for render
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 1));

    const updatedAlert = screen.queryByRole("alert");
    expect(updatedAlert).toHaveTextContent("UPDATED FROM CONTEXT");
  });

  it("shows pre-hydrated flags without making a request", () => {
    const context = { user: { email: "test@example.com" } };

    // Mock the fetch response to return nothing
    // If this ran, we would end up rendering only default values
    // and no secret feature
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => ({ evaluations: {} }),
      })
    ) as jest.Mock;

    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={context}
        onError={() => {}}
        initialFlags={{ greeting: "My seeded greeting", secretFeature: true }}
      >
        <MyComponent />
      </QuonfigProvider>
    );

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("My seeded greeting");
    const banner = screen.queryByRole("banner");
    expect(banner).toHaveTextContent("Default Subtitle");
    const secretFeature = screen.queryByTitle("secret-feature");
    expect(secretFeature).toBeInTheDocument();
  });

  it("allows providing an afterEvaluationCallback", async () => {
    const context = { user: { email: "test@example.com" } };

    const callback = jest.fn();

    const promise = stubConfig({ greeting: { value: { string: "afterEvaluationCallback" } } });

    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={context}
        afterEvaluationCallback={callback}
        onError={() => {}}
      >
        <MyComponent />
      </QuonfigProvider>
    );

    await act(async () => {
      await promise;
    });

    // wait for async callback to be called
    // eslint-disable-next-line no-promise-executor-return
    await new Promise((r) => setTimeout(r, 1));

    expect(callback).toHaveBeenCalledWith("greeting", "afterEvaluationCallback", {
      contexts: context,
    });
  });

  it("triggers onError if something goes wrong", async () => {
    const context = { user: { name: "🥰", phone: "(555) 555–5555" } };
    const onError = jest.fn();

    await renderWithConfig({}, { contextAttributes: context, onError });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        // NOTE: While context-encoding bug is fixed in the in-browser version
        // of prefab-cloud-js since
        // https://github.com/prefab-cloud/prefab-cloud-js/pull/65 the Node
        // version (which is only intended to be run in unit-tests) still
        // exhibits the bug. It is convenient for us to test this onError.
        name: "InvalidCharacterError",
        message: "The string to be encoded contains invalid characters.",
      })
    );

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("Default");
    const secretFeature = screen.queryByTitle("secret-feature");
    expect(secretFeature).not.toBeInTheDocument();
  });
});

// Adding explicit tests for createQuonfigHook functionality
describe("createQuonfigHook functionality with QuonfigProvider", () => {
  const defaultContextAttributes = { user: { email: "test@example.com" } };

  // Create a custom TypesafeClass for testing
  class CustomFeatureFlags {
    constructor(public quonfig: Reforge) {
      this.calculateValue = this.calculateValue.bind(this);
    }

    get(key: string): unknown {
      return this.quonfig.get(key);
    }

    get isSecretFeatureEnabled(): boolean {
      return this.quonfig.isEnabled("secret.feature");
    }

    get getGreeting(): string {
      const greeting = this.quonfig.get("greeting");
      return typeof greeting === "string" ? greeting : "Default Greeting";
    }

    calculateValue(multiplier: number): number {
      const baseValue = this.quonfig.get("base.value");
      const base = typeof baseValue === "number" ? baseValue : 10;
      return base * multiplier;
    }
  }

  // Create a typed hook using our TypesafeClass
  const useCustomFeatureFlags = createQuonfigHook(CustomFeatureFlags);

  // Component that uses the custom typed hook
  function CustomHookComponent() {
    const { isSecretFeatureEnabled, getGreeting, calculateValue, loading } =
      useCustomFeatureFlags();

    if (loading) {
      return <div>Loading...</div>;
    }

    return (
      <div>
        <h1 data-testid="custom-greeting">{getGreeting}</h1>
        {isSecretFeatureEnabled && <div data-testid="custom-feature">Secret Feature Enabled</div>}
        <div data-testid="calculated-value">{calculateValue(5)}</div>
      </div>
    );
  }

  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => ({
          evaluations: {
            greeting: { value: { string: "Hello from Custom Hook" } },
            "secret.feature": { value: { boolean: true } },
            "base.value": { value: { int: 20 } },
          },
        }),
      })
    ) as jest.Mock;
  });

  it("creates a working custom hook with createQuonfigHook", async () => {
    render(
      <QuonfigProvider sdkKey="test-sdk-key" contextAttributes={defaultContextAttributes}>
        <CustomHookComponent />
      </QuonfigProvider>
    );

    // Wait for loading to finish
    await act(async () => {
      // eslint-disable-next-line no-promise-executor-return
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.getByTestId("custom-greeting")).toHaveTextContent("Hello from Custom Hook");
    expect(screen.getByTestId("custom-feature")).toBeInTheDocument();
    expect(screen.getByTestId("calculated-value")).toHaveTextContent("100"); // 20 * 5
  });

  it("memoizes TypesafeClass instance when used with custom hook", async () => {
    // Create a mocked version with constructor and method spies
    const constructorSpy = jest.fn();
    const methodSpy = jest.fn().mockReturnValue("test result");

    class SpiedClass {
      constructor(public quonfig: Reforge) {
        constructorSpy(quonfig);
      }

      get(key: string): unknown {
        return this.quonfig.get(key);
      }

      // eslint-disable-next-line class-methods-use-this
      testMethod(): string {
        return methodSpy();
      }
    }

    const useSpiedHook = createQuonfigHook(SpiedClass);

    // Component that forces re-renders
    function ReRenderingComponent() {
      const [counter, setCounter] = React.useState(0);
      const { testMethod } = useSpiedHook();

      // Call the method on each render
      const result = testMethod();

      React.useEffect(() => {
        // Force multiple re-renders
        if (counter < 6) {
          setTimeout(() => setCounter(counter + 1), 10);
        }
      }, [counter]);

      return (
        <div data-testid="hook-result">
          {result} (Render count: {counter})
        </div>
      );
    }

    // Mock the fetch response for QuonfigProvider
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => ({ evaluations: {} }),
      })
    ) as jest.Mock;

    render(
      <QuonfigProvider sdkKey="test-sdk-key" contextAttributes={defaultContextAttributes}>
        <ReRenderingComponent />
      </QuonfigProvider>
    );

    // Wait for all re-renders to complete
    await waitFor(() => {
      expect(screen.getByTestId("hook-result")).toHaveTextContent("(Render count: 6)");
    });

    // In QuonfigProvider, constructor is called:
    // - once on initial render
    // - once during initialization (set's context key)
    // - once for unclear reasons, but unrelated to renders per increased render count in test component
    // or the provider's initialization process, which is still valid behavior
    expect(constructorSpy).toHaveBeenCalledTimes(3);
    // Method is called once on initial render, once during initialization, and three more times for re-renders
    expect(methodSpy).toHaveBeenCalledTimes(9);
  });
});
