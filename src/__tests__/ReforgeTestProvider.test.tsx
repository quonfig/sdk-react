/* eslint-disable max-classes-per-file */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { Reforge } from "@reforge-com/javascript";
import { ReforgeTestProvider, useReforge, createReforgeHook } from "../index";

function MyComponent() {
  const { get, isEnabled, loading, keys } = useReforge();
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

describe("ReforgeTestProvider", () => {
  const renderInTestProvider = (config: Record<string, any>) => {
    render(
      <ReforgeTestProvider config={config}>
        <MyComponent />
      </ReforgeTestProvider>
    );
  };

  it("renders without config", () => {
    renderInTestProvider({});

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("Default");
    const secretFeature = screen.queryByTitle("secret-feature");
    expect(secretFeature).not.toBeInTheDocument();
  });

  it("allows providing flag values", async () => {
    renderInTestProvider({ greeting: "CUSTOM" });

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("CUSTOM");
    const secretFeature = screen.queryByTitle("secret-feature");
    expect(secretFeature).not.toBeInTheDocument();
  });

  it("allows providing true flag booleans", async () => {
    renderInTestProvider({ greeting: "CUSTOM", secretFeature: true });

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("CUSTOM");
    const secretFeature = screen.queryByTitle("secret-feature");
    expect(secretFeature).toBeInTheDocument();
  });

  it("allows providing false flag booleans", async () => {
    renderInTestProvider({ greeting: "CUSTOM", secretFeature: false });

    const alert = screen.queryByRole("alert");
    expect(alert).toHaveTextContent("CUSTOM");
    const secretFeature = screen.queryByTitle("secret-feature");
    expect(secretFeature).not.toBeInTheDocument();
  });

  it("allows access to the known keys", () => {
    renderInTestProvider({ magic: "true", keanu: "whoa" });

    const keys = screen.getByTestId("known-keys");
    expect(keys).toHaveTextContent('["magic","keanu"]');
  });
});

// Adding explicit tests for createReforgeHook functionality
describe("createReforgeHook functionality with ReforgeTestProvider", () => {
  // Custom TypesafeClass for testing
  class CustomFeatureFlags {
    constructor(public reforge: Reforge) {
      this.calculateCustomValue = this.calculateCustomValue.bind(this);
    }

    get(key: string): unknown {
      return this.reforge.get(key);
    }

    get isCustomFeatureEnabled(): boolean {
      return this.reforge.isEnabled("custom.feature");
    }

    get getCustomMessage(): string {
      const message = this.reforge.get("custom.message");
      return typeof message === "string" ? message : "Default Message";
    }

    calculateCustomValue(multiplier: number): number {
      const baseValue = this.reforge.get("custom.base.value");
      const base = typeof baseValue === "number" ? baseValue : 5;
      return base * multiplier;
    }
  }

  // Create a typed hook using our TypesafeClass
  const useCustomFeatureFlags = createReforgeHook(CustomFeatureFlags);

  // Component that uses the custom typed hook
  function CustomHookComponent() {
    const { isCustomFeatureEnabled, getCustomMessage, calculateCustomValue } =
      useCustomFeatureFlags();

    return (
      <div>
        <h1 data-testid="custom-message">{getCustomMessage}</h1>
        {isCustomFeatureEnabled && <div data-testid="custom-feature">Custom Feature Enabled</div>}
        <div data-testid="custom-calculated-value">{calculateCustomValue(3)}</div>
      </div>
    );
  }

  it("creates a working custom hook with createReforgeHook", () => {
    render(
      <ReforgeTestProvider
        config={{
          "custom.message": "Hello from Test Custom Hook",
          "custom.feature": true,
          "custom.base.value": 10,
        }}
      >
        <CustomHookComponent />
      </ReforgeTestProvider>
    );

    expect(screen.getByTestId("custom-message")).toHaveTextContent("Hello from Test Custom Hook");
    expect(screen.getByTestId("custom-feature")).toBeInTheDocument();
    expect(screen.getByTestId("custom-calculated-value")).toHaveTextContent("30"); // 10 * 3
  });

  it("provides default values when configs are not provided", () => {
    render(
      <ReforgeTestProvider
        config={{
          // Only specify some values
          "custom.message": "Only Message Set",
        }}
      >
        <CustomHookComponent />
      </ReforgeTestProvider>
    );

    expect(screen.getByTestId("custom-message")).toHaveTextContent("Only Message Set");
    expect(screen.queryByTestId("custom-feature")).not.toBeInTheDocument();
    expect(screen.getByTestId("custom-calculated-value")).toHaveTextContent("15"); // 5 (default) * 3
  });

  it("memoizes TypesafeClass instance when used with custom hook", async () => {
    // Create a class with spies
    const constructorSpy = jest.fn();
    const methodSpy = jest.fn().mockReturnValue("memoized result");

    class SpiedClass {
      constructor(public reforge: Reforge) {
        constructorSpy(reforge);
        this.testMethod = this.testMethod.bind(this);
      }

      get(key: string): unknown {
        return this.reforge.get(key);
      }

      // eslint-disable-next-line class-methods-use-this
      testMethod(): string {
        return methodSpy();
      }
    }

    const useSpiedHook = createReforgeHook(SpiedClass);

    // Component that forces re-renders
    function ReRenderingComponent() {
      const [counter, setCounter] = React.useState(0);
      const { testMethod } = useSpiedHook();

      // Call the method on each render
      const result = testMethod();

      React.useEffect(() => {
        // Force multiple re-renders
        if (counter < 3) {
          setTimeout(() => setCounter(counter + 1), 10);
        }
      }, [counter]);

      return (
        <div data-testid="test-result">
          {result} (Count: {counter})
        </div>
      );
    }

    render(
      <ReforgeTestProvider config={{}}>
        <ReRenderingComponent />
      </ReforgeTestProvider>
    );

    // Wait for all re-renders to complete
    await waitFor(() => {
      expect(screen.getByTestId("test-result")).toHaveTextContent("(Count: 3)");
    });

    // Constructor should be called only once, method called for each render
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    expect(methodSpy).toHaveBeenCalledTimes(4); // Initial render + 3 updates
  });
});
