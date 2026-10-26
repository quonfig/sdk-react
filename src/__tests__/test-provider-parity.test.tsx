import React from "react";
import { render } from "@testing-library/react";
import { Quonfig } from "@quonfig/javascript";
import type { Duration } from "@quonfig/javascript";
import { QuonfigTestProvider, useQuonfig } from "../index";

// qfg-zvyy.9: QuonfigTestProvider must answer isEnabled / getDuration exactly
// like the real @quonfig/javascript client for the same stored value, across
// the cross-SDK typed-getter matrix (integration-test-data v2026.10.23
// getter.contract.* fixtures). The real client is fed each value as
// api-delivery sends it; the test provider gets the same JSON value as its
// config entry.
//
// A test config is untyped, so an ISO 8601 string in it stands for a
// duration config (the wire form of a duration) and `true` for a bool config.
// The rows it cannot express are a *string* config holding "PT1S" and a
// *json* config holding `true`, which the real client treats as type
// mismatches; those rows are covered by the client's own suite.

const MATRIX: Array<[string, { type: string; value: unknown }]> = [
  ["bool true", { type: "bool", value: true }],
  ["bool false", { type: "bool", value: false }],
  ["string", { type: "string", value: "fast" }],
  ['string "true"', { type: "string", value: "true" }],
  ['string "false"', { type: "string", value: "false" }],
  ['string "3"', { type: "string", value: "3" }],
  ["int", { type: "int", value: 30 }],
  ["int 0", { type: "int", value: 0 }],
  ["double", { type: "double", value: 3.9 }],
  ["string_list", { type: "string_list", value: ["a", "b"] }],
  ["json", { type: "json", value: { a: 1 } }],
  ["duration", { type: "duration", value: "PT30S" }],
  ["malformed duration", { type: "duration", value: "5m" }],
  ["malformed int", { type: "int", value: "twelve" }],
  ["malformed double", { type: "double", value: "abc" }],
];

const KEY = "getter.contract.key";
const DEFAULT: Duration = { ms: 1234, seconds: 1.234 };

type Readers = {
  isEnabled: (key: string) => boolean;
  getDuration: (key: string, defaultValue?: Duration) => Duration | undefined;
};

const realClient = (stored: { type: string; value: unknown }): Readers => {
  const client = new Quonfig();
  client.setConfig({
    evaluations: {
      [KEY]: { value: stored, configId: "c", configType: "config", valueType: stored.type },
    },
  });
  return client;
};

const testProvider = (config: Record<string, unknown>): Readers => {
  let readers: Readers | undefined;
  function Probe() {
    const { isEnabled, getDuration } = useQuonfig();
    readers = { isEnabled, getDuration } as Readers;
    return null;
  }
  render(
    <QuonfigTestProvider config={config}>
      <Probe />
    </QuonfigTestProvider>
  );
  return readers!;
};

describe("QuonfigTestProvider matches the real client", () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it.each(MATRIX)("isEnabled on stored %s", (_name, stored) => {
    expect(testProvider({ [KEY]: stored.value }).isEnabled(KEY)).toBe(
      realClient(stored).isEnabled(KEY)
    );
  });

  it.each(MATRIX)("getDuration with a default on stored %s", (_name, stored) => {
    expect(testProvider({ [KEY]: stored.value }).getDuration(KEY, DEFAULT)).toEqual(
      realClient(stored).getDuration(KEY, DEFAULT)
    );
  });

  it.each(MATRIX)("getDuration without a default on stored %s", (_name, stored) => {
    expect(testProvider({ [KEY]: stored.value }).getDuration(KEY)).toEqual(
      realClient(stored).getDuration(KEY)
    );
  });

  it("a missing key: isEnabled false, getDuration returns the default", () => {
    const provider = testProvider({});
    const client = realClient({ type: "bool", value: true });
    expect(provider.isEnabled("missing")).toBe(client.isEnabled("missing"));
    expect(provider.getDuration("missing", DEFAULT)).toEqual(
      client.getDuration("missing", DEFAULT)
    );
    expect(provider.getDuration("missing")).toEqual(client.getDuration("missing"));
  });

  it("never throws and warns once per key, like the client", () => {
    const provider = testProvider({ a: 30, b: "fast" });
    expect(() => provider.getDuration("a")).not.toThrow();
    provider.getDuration("a");
    provider.getDuration("a", DEFAULT);
    provider.isEnabled("b");
    provider.isEnabled("b");
    const warningsFor = (key: string) =>
      warn.mock.calls.filter(([msg]) => String(msg).includes(`"${key}"`)).length;
    expect(warningsFor("a")).toBe(1);
    expect(warningsFor("b")).toBe(1);
  });
});
