import React, { PropsWithChildren } from "react";
import {
  reforge,
  type ReforgeInitParams,
  type ConfigValue,
  type Contexts,
  Context,
  Reforge,
  TypedFrontEndConfigurationRaw,
  FrontEndConfigurationRaw,
  Duration,
} from "@reforge-com/javascript";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require("../package.json");

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
  quonfig: Reforge
) => T;

type SharedSettings = Partial<
  Pick<
    ReforgeInitParams,
    | "sdkKey"
    | "endpoints"
    | "apiEndpoint"
    | "timeout"
    | "collectEvaluationSummaries"
    | "collectLoggerNames"
    | "collectContextMode"
  >
> & {
  // We need to redefine the afterEvaluationCallback type to ensure proper dynamic resolution of K
  afterEvaluationCallback?: <K extends keyof TypedFrontEndConfigurationRaw>(
    key: K,
    value: TypedFrontEndConfigurationRaw[K],
    context: Context | undefined
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
  quonfig: typeof reforge;
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
  quonfig: reforge,
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

let globalQuonfigIsTaken = false;

export const assignQuonfigClient = () => {
  if (globalQuonfigIsTaken) {
    return new Reforge();
  }

  globalQuonfigIsTaken = true;
  return reforge;
};

export type QuonfigProviderProps = SharedSettings & {
  sdkKey: string;
  contextAttributes?: Contexts;
  initialFlags?: Record<string, unknown>;
};

const getContext = (
  contextAttributes: Contexts,
  onError: (e: Error) => void
): [Context, string] => {
  try {
    if (Object.keys(contextAttributes).length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "QuonfigProvider: You haven't passed any contextAttributes. See https://docs.quonfig.com/docs/sdks/react#using-context"
      );
    }

    const context = new Context(contextAttributes);
    const contextKey = context.encode();

    return [context, contextKey];
  } catch (e) {
    onError(e as Error);
    return [new Context({}), ""];
  }
};

function QuonfigProvider({
  sdkKey,
  contextAttributes = {},
  onError = (e: unknown) => {
    // eslint-disable-next-line no-console
    console.error(e);
  },
  initialFlags,
  children,
  timeout,
  endpoints,
  apiEndpoint,
  pollInterval,
  afterEvaluationCallback = undefined,
  collectEvaluationSummaries,
  collectLoggerNames,
  collectContextMode,
}: PropsWithChildren<QuonfigProviderProps>) {
  const settings = {
    sdkKey,
    endpoints,
    apiEndpoint,
    timeout,
    pollInterval,
    onError,
    afterEvaluationCallback,
    collectEvaluationSummaries,
    collectLoggerNames,
    collectContextMode,
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

  const quonfigClient: Reforge = React.useMemo(() => assignQuonfigClient(), []);

  const [context, contextKey] = getContext(contextAttributes, onError);

  if (initialFlags && initialLoad) {
    quonfigClient.hydrate(initialFlags);
    setInitialLoad(false);
    setLoadedContextKey(contextKey);
    setLoading(false);
    mostRecentlyLoadingContextKey.current = contextKey;

    if (pollInterval) {
      // eslint-disable-next-line no-console
      console.warn("Polling is not supported when hydrating flags via initialFlags");
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

        const initOptions: Parameters<typeof quonfigClient.init>[0] = {
          context,
          ...settings,
          clientNameString: "sdk-react",
          clientVersionString: version,
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
          .updateContext(context)
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
  }, [loadedContextKey, loading, quonfigClient.instanceHash, settings]);

  return <QuonfigContext.Provider value={value}>{children}</QuonfigContext.Provider>;
}

export { QuonfigProvider, ConfigValue, SharedSettings, QuonfigTypesafeClass };
