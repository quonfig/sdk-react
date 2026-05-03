import React, { PropsWithChildren } from "react";
import {
  quonfig,
  type InitOptions,
  type ConfigValue,
  type Contexts,
  Quonfig,
  TypedFrontEndConfigurationRaw,
  FrontEndConfigurationRaw,
  Duration,
  encodeContexts,
} from "@quonfig/javascript";
import reactSdkVersion from "./version";
import { normalizeLogger, type Logger, type NormalizedLogger } from "./sdkLogger";

// qfg-lkpm.6: per-tree owner context. The value is the active Quonfig client
// for this provider subtree. A null value means no Provider is above us, so
// the next mount can claim the module-level singleton; a non-null value
// signals "you're nested, mint a fresh client". This replaces the previous
// module-level `globalQuonfigIsTaken` flag, which never reset and so leaked
// state across test runs and (in principle) across SSR render trees.
const QuonfigClientContext = React.createContext<Quonfig | null>(null);

// @quonfig/cli#generate will create interfaces into this namespace for React to consume
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FrontEndConfigurationAccessor {}

export type TypedFrontEndConfigurationAccessor = keyof FrontEndConfigurationAccessor extends never
  ? Record<string, unknown>
  : {
      [TypedFlagKey in keyof FrontEndConfigurationAccessor]: FrontEndConfigurationAccessor[TypedFlagKey];
    };

type ClassMethods<T> = { [K in keyof T]: T[K] };

type QuonfigTypesafeClass<T = unknown> = new (
  // eslint-disable-next-line no-shadow
  quonfig: Quonfig
) => T;

type SharedSettings = Partial<
  Pick<
    InitOptions,
    | "sdkKey"
    | "apiUrls"
    | "domain"
    | "timeout"
    | "collectEvaluationSummaries"
    | "collectLoggerNames"
  >
> & {
  // Convenience alias for a single API URL — normalized to apiUrls=[apiUrl]
  // before being passed to the underlying SDK, which only accepts apiUrls.
  apiUrl?: string;
  // We need to redefine the afterEvaluationCallback type to ensure proper dynamic resolution of K
  afterEvaluationCallback?: <K extends keyof TypedFrontEndConfigurationRaw>(
    key: K,
    value: TypedFrontEndConfigurationRaw[K],
    contexts: Contexts | undefined
  ) => void;
  pollInterval?: number;
  onError?: (error: Error) => void;
};

export type BaseContext = {
  get: <K extends keyof TypedFrontEndConfigurationRaw>(key: K) => TypedFrontEndConfigurationRaw[K];
  getDuration: <
    K extends keyof FrontEndConfigurationRaw extends never
      ? string
      : {
          [IK in keyof TypedFrontEndConfigurationRaw]: TypedFrontEndConfigurationRaw[IK] extends Duration
            ? IK
            : never;
        }[keyof TypedFrontEndConfigurationRaw],
  >(
    key: K
  ) => Duration | undefined;
  contextAttributes: Contexts;
  isEnabled: <
    K extends keyof FrontEndConfigurationRaw extends never
      ? string
      : {
          [IK in keyof TypedFrontEndConfigurationRaw]: TypedFrontEndConfigurationRaw[IK] extends boolean
            ? IK
            : never;
        }[keyof TypedFrontEndConfigurationRaw],
  >(
    key: K
  ) => boolean;
  loading: boolean;
  quonfig: typeof quonfig;
  keys: (keyof TypedFrontEndConfigurationRaw)[];
  settings: SharedSettings;
};

export type ProvidedContext = BaseContext & ClassMethods<QuonfigTypesafeClass>;

export const defaultContext: BaseContext = {
  get: (_key) => undefined,
  getDuration: (_key) => undefined,
  isEnabled: (_key) => false,
  keys: [],
  loading: true,
  contextAttributes: {},
  quonfig,
  settings: {},
};

export const QuonfigContext = React.createContext<ProvidedContext>(
  defaultContext as ProvidedContext
);

// This is a factory function that creates a fully typed useQuonfig hook for a specific QuonfigTypesafe class
export function createQuonfigHook<T>(TypesafeClass: QuonfigTypesafeClass<T>) {
  return function useQuonfigHook(): BaseContext & T {
    const baseContext = React.useContext(QuonfigContext);

    // Memoize the typesafe instance to prevent unnecessary constructor calls
    const typesafeInstance = React.useMemo(() => {
      const instance = new TypesafeClass(baseContext.quonfig);

      // Copy baseContext properties to typesafeInstance except for `get` + `quonfig`
      Object.assign(instance as any, {
        getDuration: baseContext.getDuration,
        contextAttributes: baseContext.contextAttributes,
        isEnabled: baseContext.isEnabled,
        loading: baseContext.loading,
        keys: baseContext.keys,
        settings: baseContext.settings,
      });

      return instance;
    }, [baseContext]);

    return typesafeInstance as BaseContext & T;
  };
}

// Basic hook for general use - requires type parameter
export const useBaseQuonfig = () => React.useContext(QuonfigContext);

// General hook that returns the context with any explicit type
export const useQuonfig = (): ProvidedContext => useBaseQuonfig() as unknown as ProvidedContext;

// qfg-lkpm.6: per-key selector hook. Subscribes via the underlying client's
// notify list rather than React context, so a flag mutation only re-renders
// components whose selected key actually changed. `useQuonfig()` re-renders
// on every dataVersion bump because the context value identity changes; this
// hook bypasses that.
export function useFlag<K extends keyof TypedFrontEndConfigurationRaw>(
  key: K
): TypedFrontEndConfigurationRaw[K];
export function useFlag(key: string): ConfigValue;
export function useFlag(key: string): ConfigValue {
  const client = React.useContext(QuonfigClientContext) ?? quonfig;
  const subscribe = React.useCallback(
    (onChange: () => void) => client.subscribe(onChange),
    [client]
  );
  const getSnapshot = React.useCallback(() => client.get(key), [client, key]);
  const getServerSnapshot = React.useCallback((): ConfigValue => undefined, []);
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// qfg-lkpm.6: replacement for the old module-level `globalQuonfigIsTaken`
// flag. A provider asks "is there already a Quonfig client above me in the
// React tree?". If yes, mint a fresh client (multi-tenant nesting); if no,
// claim the module singleton so non-React code that imports `quonfig`
// directly sees the same instance.
export const useQuonfigClient = (): Quonfig => {
  const parentClient = React.useContext(QuonfigClientContext);
  // Mount-only: parent context is fixed for the lifetime of this provider.
  const parentClientRef = React.useRef(parentClient);
  return React.useMemo(() => (parentClientRef.current ? new Quonfig() : quonfig), []);
};

export type QuonfigProviderProps = SharedSettings & {
  sdkKey: string;
  contextAttributes?: Contexts;
  initialFlags?: Record<string, unknown>;
  logger?: Logger;
};

const getContextKey = (
  contextAttributes: Contexts,
  logger: NormalizedLogger,
  onError: (e: Error) => void
): string => {
  try {
    if (Object.keys(contextAttributes).length === 0) {
      logger.warn(
        "QuonfigProvider: You haven't passed any contextAttributes. See https://docs.quonfig.com/docs/sdks/react#using-context"
      );
    }

    return encodeContexts(contextAttributes);
  } catch (e) {
    onError(e as Error);
    return "";
  }
};

function QuonfigProvider({
  sdkKey,
  contextAttributes = {},
  onError: userOnError,
  logger,
  initialFlags,
  children,
  timeout,
  apiUrl,
  apiUrls,
  domain,
  pollInterval,
  afterEvaluationCallback = undefined,
  collectEvaluationSummaries,
  collectLoggerNames,
}: PropsWithChildren<QuonfigProviderProps>) {
  const normalizedLogger = React.useMemo(() => normalizeLogger(logger), [logger]);
  const onError = React.useCallback(
    (e: unknown) => {
      if (userOnError) {
        userOnError(e as Error);
      } else {
        const message = e instanceof Error ? e.message : String(e);
        normalizedLogger.error(message, e);
      }
    },
    [userOnError, normalizedLogger]
  );
  const settings = {
    sdkKey,
    apiUrl,
    apiUrls,
    domain,
    timeout,
    pollInterval,
    onError,
    afterEvaluationCallback,
    collectEvaluationSummaries,
    collectLoggerNames,
  };

  // We use this state to prevent a double-init when useEffect fires due to
  // StrictMode
  const mostRecentlyLoadingContextKey = React.useRef<string | undefined>(undefined);
  // We use this state to pass the loading state to the Provider (updating
  // currentLoadingContextKey won't trigger an update)
  const [loading, setLoading] = React.useState(true);
  const [initialLoad, setInitialLoad] = React.useState(true);
  // Here we track the current identity so we can reload our config when it
  // changes
  const [loadedContextKey, setLoadedContextKey] = React.useState("");

  const quonfigClient: Quonfig = useQuonfigClient();

  // qfg-daxq: re-render when the underlying client's in-memory config changes
  // (poll fetch, setConfig, hydrate). Without this the singleton mutates in
  // place and React never sees the update.
  const dataVersion = React.useSyncExternalStore(
    React.useCallback((onChange) => quonfigClient.subscribe(onChange), [quonfigClient]),
    React.useCallback(() => quonfigClient.dataVersion, [quonfigClient]),
    React.useCallback(() => 0, [])
  );

  const contextKey = getContextKey(contextAttributes, normalizedLogger, onError);

  if (initialFlags && initialLoad) {
    quonfigClient.hydrate(initialFlags);
    setInitialLoad(false);
    setLoadedContextKey(contextKey);
    setLoading(false);
    mostRecentlyLoadingContextKey.current = contextKey;

    if (pollInterval) {
      normalizedLogger.warn("Polling is not supported when hydrating flags via initialFlags");
    }
  }

  React.useEffect(() => {
    setInitialLoad(false);

    if (mostRecentlyLoadingContextKey.current === contextKey) {
      return;
    }

    setLoading(true);
    try {
      if (mostRecentlyLoadingContextKey.current === undefined) {
        mostRecentlyLoadingContextKey.current = contextKey;

        if (!sdkKey) {
          throw new Error("QuonfigProvider: sdkKey is required");
        }

        quonfigClient.clientName = "react";
        quonfigClient.clientVersion = reactSdkVersion;

        const resolvedApiUrls = apiUrls ?? (apiUrl ? [apiUrl] : undefined);

        const initOptions: InitOptions = {
          context: contextAttributes,
          sdkKey,
          apiUrls: resolvedApiUrls,
          domain,
          timeout,
          afterEvaluationCallback,
          collectEvaluationSummaries,
          collectLoggerNames,
        };

        quonfigClient
          .init(initOptions)
          .then(() => {
            setLoadedContextKey(contextKey);
            setLoading(false);

            if (pollInterval) {
              quonfigClient.poll({ frequencyInMs: pollInterval });
            }
          })
          .catch((reason: any) => {
            setLoading(false);
            onError(reason);
          });
      } else {
        mostRecentlyLoadingContextKey.current = contextKey;

        quonfigClient
          .updateContext(contextAttributes)
          .then(() => {
            setLoadedContextKey(contextKey);
            setLoading(false);
          })
          .catch((reason: any) => {
            setLoading(false);
            onError(reason);
          });
      }
    } catch (e) {
      setLoading(false);
      onError(e as Error);
    }
  }, [
    sdkKey,
    loadedContextKey,
    contextKey,
    loading,
    setLoading,
    onError,
    quonfigClient.instanceHash,
  ]);

  // qfg-2acr: drain telemetry + stop polling/telemetry timers when the
  // provider unmounts so route swaps don't leave the singleton polling
  // forever. Mount-only deps so context-attribute changes don't tear down
  // the SDK. In React StrictMode the synthetic unmount fires too — we
  // reset the init-guard ref so the next mount cleanly re-inits.
  React.useEffect(
    () => () => {
      quonfigClient.close().catch(() => {});
      mostRecentlyLoadingContextKey.current = undefined;
    },
    [quonfigClient]
  );

  const value = React.useMemo(() => {
    const baseContext: ProvidedContext = {
      isEnabled: quonfigClient.isEnabled.bind(quonfigClient),
      contextAttributes,
      get: quonfigClient.get.bind(quonfigClient),
      getDuration: quonfigClient.getDuration.bind(quonfigClient),
      keys: Object.keys(quonfigClient.extract()),
      quonfig: quonfigClient,
      loading,
      settings,
    };

    return baseContext;
  }, [loadedContextKey, loading, quonfigClient.instanceHash, settings, dataVersion]);

  return (
    <QuonfigClientContext.Provider value={quonfigClient}>
      <QuonfigContext.Provider value={value}>{children}</QuonfigContext.Provider>
    </QuonfigClientContext.Provider>
  );
}

export { QuonfigProvider, QuonfigClientContext, ConfigValue, SharedSettings, QuonfigTypesafeClass };
