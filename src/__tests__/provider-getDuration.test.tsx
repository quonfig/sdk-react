import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { QuonfigProvider, useQuonfig } from "../index";

// qfg-goi1.2.8: the real client's getDuration throws `Value for key "<k>" is
// not a duration` when the stored value is not a duration. The provider calls
// it during render, so a single config edit (a bool, number or string under a
// duration key) used to take down the whole React tree. The provider now wraps
// it: a mismatch returns undefined (the default) and warns once per key
// through the provider's logger, matching QuonfigTestProvider.

function DurationProbe({ configKey }: { configKey: string }) {
  const { getDuration } = useQuonfig();
  return <pre data-testid={configKey}>{JSON.stringify(getDuration(configKey) ?? null)}</pre>;
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
beforeEach(() => {
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe("QuonfigProvider getDuration on a non-duration value", () => {
  it.each([[true], [30], ["not-a-duration"]])(
    "returns undefined instead of throwing during render for %j",
    (value) => {
      const logger = makeLogger();
      render(
        <Boundary>
          <QuonfigProvider
            sdkKey="sdk-key"
            contextAttributes={{ user: { key: "u1" } }}
            initialFlags={{ timeout: value }}
            logger={logger}
          >
            <DurationProbe configKey="timeout" />
          </QuonfigProvider>
        </Boundary>
      );

      expect(screen.queryByTestId("crashed")).toBeNull();
      expect(screen.getByTestId("timeout")).toHaveTextContent("null");
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('"timeout"'));
    }
  );

  it("warns once per key across re-renders", () => {
    const logger = makeLogger();
    const ui = (n: number) => (
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "u1" } }}
        initialFlags={{ timeout: true, retry: 5 }}
        logger={logger}
      >
        <DurationProbe configKey="timeout" />
        <DurationProbe configKey="retry" />
        <span>{n}</span>
      </QuonfigProvider>
    );
    const { rerender } = render(ui(1));
    rerender(ui(2));
    rerender(ui(3));

    const durationWarnings = logger.warn.mock.calls.filter(([msg]) =>
      String(msg).includes("is not a duration")
    );
    expect(durationWarnings).toHaveLength(2);
    expect(durationWarnings.map(([msg]) => msg).join(" ")).toContain('"timeout"');
    expect(durationWarnings.map(([msg]) => msg).join(" ")).toContain('"retry"');
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
  });
});
