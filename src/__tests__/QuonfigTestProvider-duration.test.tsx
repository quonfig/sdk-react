import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { QuonfigTestProvider, useQuonfig } from "../index";

// QuonfigTestProvider.getDuration validates like the real client
// (qfg-2agi.14): an ISO 8601 string is parsed by @quonfig/javascript's own
// duration parser, a parsed Duration passes through, anything else returns
// undefined (the default) with a warning instead of leaking a non-Duration.

function DurationProbe({ configKey }: { configKey: string }) {
  const { getDuration } = useQuonfig();
  return <pre data-testid="duration">{JSON.stringify(getDuration(configKey) ?? null)}</pre>;
}

const durationIn = (config: Record<string, unknown>, configKey = "timeout") => {
  render(
    <QuonfigTestProvider config={config}>
      <DurationProbe configKey={configKey} />
    </QuonfigTestProvider>
  );
  return JSON.parse(screen.getByTestId("duration").textContent ?? "null");
};

describe("QuonfigTestProvider getDuration", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("parses an ISO 8601 string into a Duration", () => {
    expect(durationIn({ timeout: "PT30S" })).toEqual({ ms: 30000, seconds: 30 });
  });

  it("passes a parsed Duration through", () => {
    expect(durationIn({ timeout: { ms: 1500, seconds: 1.5 } })).toEqual({ ms: 1500, seconds: 1.5 });
  });

  it("returns undefined for a missing key", () => {
    expect(durationIn({})).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([[30], [true], [{ foo: "bar" }], [["PT1S"]]])(
    "returns undefined and warns for a non-duration value %j",
    (value) => {
      expect(durationIn({ timeout: value })).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"timeout"'));
    }
  );
});
