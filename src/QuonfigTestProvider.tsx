import React, { PropsWithChildren } from "react";
import { Config } from "@quonfig/javascript";
import type { Duration } from "@quonfig/javascript";
import {
  QuonfigContext,
  QuonfigClientContext,
  useQuonfigClient,
  ProvidedContext,
} from "./QuonfigProvider";

const isDuration = (value: unknown): value is Duration =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Duration).ms === "number" &&
  typeof (value as Duration).seconds === "number";

/**
 * Resolve a test-config value the way the real client resolves a duration:
 * an ISO 8601 string goes through @quonfig/javascript's own parser, a parsed
 * Duration passes through, and anything else is not a duration.
 */
const toDuration = (key: string, value: unknown): Duration | undefined => {
  if (isDuration(value)) return value;
  if (typeof value === "string") {
    const evaluation = {
      value: { type: "duration", value },
      configId: "",
      configType: "config",
      valueType: "duration",
    };
    const parsed = Config.digest({ evaluations: { [key]: evaluation } })[key]?.value;
    if (isDuration(parsed)) return parsed;
  }
  return undefined;
};

export type QuonfigTestProviderProps = {
  config: Record<string, any>;
  sdkKey?: string;
};

function QuonfigTestProvider({
  sdkKey,
  config,
  children,
}: PropsWithChildren<QuonfigTestProviderProps>) {
  const get = (key: string) => config[key];
  // Same answers as the real client (qfg-zvyy): a non-duration value returns
  // the caller's default and an isEnabled on anything but a boolean true is
  // false. Neither throws; each warns once per key, never with the value.
  const warnedKeys = React.useRef(new Set<string>());
  const warnOnce = (key: string, reason: string) => {
    if (warnedKeys.current.has(key)) return;
    warnedKeys.current.add(key);
    console.warn(
      `QuonfigTestProvider: read of "${key}" returned no value; the caller's default applies: ${reason}`
    );
  };
  const getDuration = (key: string, defaultValue?: Duration): Duration | undefined => {
    const value = config[key];
    if (value === undefined) return defaultValue;
    const duration = toDuration(key, value);
    if (duration === undefined) {
      warnOnce(key, "the value is not a valid ISO 8601 duration");
      return defaultValue;
    }
    return duration;
  };
  const isEnabled = (key: string) => {
    const value = config[key];
    if (value === undefined || typeof value === "boolean") return value === true;
    warnOnce(key, "the value is not a boolean");
    return false;
  };

  const quonfigClient = useQuonfigClient();

  const value = React.useMemo(() => {
    quonfigClient.get = get;
    // useFlag reads its snapshot with peek(); answer it from the same config.
    quonfigClient.peek = get;
    quonfigClient.getDuration = getDuration;
    quonfigClient.isEnabled = isEnabled;

    const baseContext: ProvidedContext = {
      isEnabled,
      contextAttributes: config.contextAttributes,
      get,
      getDuration,
      loading: false,
      isReady: true,
      error: undefined,
      source: "network",
      quonfig: quonfigClient,
      keys: Object.keys(config),
      settings: { sdkKey: sdkKey ?? "fake-sdk-key-via-the-test-provider" },
    };

    return baseContext;
  }, [config, quonfigClient, sdkKey]);

  return (
    <QuonfigClientContext.Provider value={quonfigClient}>
      <QuonfigContext.Provider value={value}>{children}</QuonfigContext.Provider>
    </QuonfigClientContext.Provider>
  );
}

export { QuonfigTestProvider };
