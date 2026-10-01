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
  const getDuration = (key: string): Duration | undefined => {
    const value = config[key];
    if (value === undefined) return undefined;
    const duration = toDuration(key, value);
    if (duration === undefined) {
      console.warn(
        `QuonfigTestProvider: value for key "${key}" is not a valid ISO 8601 duration; returning the default.`
      );
    }
    return duration;
  };
  const isEnabled = (key: string) => !!get(key);

  const quonfigClient = useQuonfigClient();

  const value = React.useMemo(() => {
    quonfigClient.get = get;
    quonfigClient.getDuration = getDuration;
    quonfigClient.isEnabled = isEnabled;

    const baseContext: ProvidedContext = {
      isEnabled,
      contextAttributes: config.contextAttributes,
      get,
      getDuration,
      loading: false,
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
