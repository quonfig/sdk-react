import React, { PropsWithChildren } from "react";
import {
  QuonfigContext,
  QuonfigClientContext,
  useQuonfigClient,
  ProvidedContext,
} from "./QuonfigProvider";

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
  const getDuration = (key: string) => config[key];
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
