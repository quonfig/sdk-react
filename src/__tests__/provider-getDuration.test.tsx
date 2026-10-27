import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import type { Duration } from "@quonfig/javascript";
import { QuonfigProvider, useQuonfig } from "../index";

// qfg-goi1.2.8: getDuration runs during render, so a non-duration value under
// a duration key must not take down the React tree. Since @quonfig/javascript
// 2.0 (qfg-zvyy) the client's getDuration never throws: it returns the
// caller's default and warns once per key (console.warn), and the provider
// passes the default through.

function DurationProbe({ configKey, fallback }: { configKey: string; fallback?: Duration }) {
  const { getDuration } = useQuonfig();
  return (
    <pre data-testid={configKey}>{JSON.stringify(getDuration(configKey, fallback) ?? null)}</pre>
  );
}

class Boundary extends React.Component<React.PropsWithChildren, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) return <div data-testid="crashed">{this.state.error.message}</div>;
    return this.props.children;
  }
}

const makeLogger = () => ({ warn: jest.fn(), error: jest.fn() });

let consoleError: jest.SpyInstance;
let consoleWarn: jest.SpyInstance;
beforeEach(() => {
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
  consoleWarn.mockRestore();
});

const durationWarnings = () =>
  consoleWarn.mock.calls.filter(([msg]) => String(msg).includes("expected duration"));

describe("QuonfigProvider getDuration on a non-duration value", () => {
  it.each([[true], [30], ["not-a-duration"]])(
    "returns undefined instead of throwing during render for %j",
    (value) => {
      // The provider uses the shared client singleton, which warns once per
      // key per client, so each case reads its own key.
      const key = `timeout-${JSON.stringify(value)}`;
      const logger = makeLogger();
      render(
        <Boundary>
          <QuonfigProvider
            sdkKey="sdk-key"
            contextAttributes={{ user: { key: "u1" } }}
            initialFlags={{ [key]: value }}
            logger={logger}
          >
            <DurationProbe configKey={key} />
          </QuonfigProvider>
        </Boundary>
      );

      expect(screen.queryByTestId("crashed")).toBeNull();
      expect(screen.getByTestId(key)).toHaveTextContent("null");
      expect(durationWarnings().map(([msg]) => msg)).toEqual([expect.stringContaining(`"${key}"`)]);
    }
  );

  it("warns once per key across re-renders", () => {
    const logger = makeLogger();
    const ui = (n: number) => (
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "u1" } }}
        initialFlags={{ "rerender.timeout": true, "rerender.retry": 5 }}
        logger={logger}
      >
        <DurationProbe configKey="rerender.timeout" />
        <DurationProbe configKey="rerender.retry" />
        <span>{n}</span>
      </QuonfigProvider>
    );
    const { rerender } = render(ui(1));
    rerender(ui(2));
    rerender(ui(3));

    const warnings = durationWarnings();
    expect(warnings).toHaveLength(2);
    expect(warnings.map(([msg]) => msg).join(" ")).toContain('"rerender.timeout"');
    expect(warnings.map(([msg]) => msg).join(" ")).toContain('"rerender.retry"');
  });

  it("still returns a real duration unchanged, without warning", () => {
    const logger = makeLogger();
    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "u1" } }}
        initialFlags={{ timeout: { ms: 1500, seconds: 1.5 } }}
        logger={logger}
      >
        <DurationProbe configKey="timeout" />
      </QuonfigProvider>
    );

    expect(JSON.parse(screen.getByTestId("timeout").textContent ?? "null")).toEqual({
      ms: 1500,
      seconds: 1.5,
    });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(durationWarnings()).toHaveLength(0);
  });

  it("returns the caller's default for a non-duration value", () => {
    const fallback = { ms: 250, seconds: 0.25 };
    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "u1" } }}
        initialFlags={{ "fallback.timeout": "not-a-duration" }}
      >
        <DurationProbe configKey="fallback.timeout" fallback={fallback} />
      </QuonfigProvider>
    );
    expect(JSON.parse(screen.getByTestId("fallback.timeout").textContent ?? "null")).toEqual(
      fallback
    );
  });
});
