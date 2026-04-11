import React, { PropsWithChildren } from "react";
import { ReforgeContext, assignReforgeClient, ProvidedContext } from "./ReforgeProvider";

export type ReforgeTestProviderProps = {
  config: Record<string, any>;
  sdkKey?: string;
};

function ReforgeTestProvider({
  sdkKey,
  config,
  children,
}: PropsWithChildren<ReforgeTestProviderProps>) {
  const get = (key: string) => config[key];
  const getDuration = (key: string) => config[key];
  const isEnabled = (key: string) => !!get(key);

  const reforgeClient = React.useMemo(() => assignReforgeClient(), []);

  const value = React.useMemo(() => {
    reforgeClient.get = get;
    reforgeClient.getDuration = getDuration;
    reforgeClient.isEnabled = isEnabled;

    const baseContext: ProvidedContext = {
      isEnabled,
      contextAttributes: config.contextAttributes,
      get,
      getDuration,
      loading: false,
      reforge: reforgeClient,
      keys: Object.keys(config),
      settings: { sdkKey: sdkKey ?? "fake-sdk-key-via-the-test-provider" },
    };

    return baseContext;
  }, [config, reforgeClient, sdkKey]);

  return <ReforgeContext.Provider value={value}>{children}</ReforgeContext.Provider>;
}

export { ReforgeTestProvider };
