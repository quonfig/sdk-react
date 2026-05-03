# @quonfig/react

A React provider and hook for [Quonfig](https://quonfig.com)

## Installation

`npm install @quonfig/react` or `yarn add @quonfig/react`

TypeScript types are included with the package.

## Usage in your app

### Configure the Provider

Wrap your component tree in the `QuonfigProvider`, e.g.

```javascript
import { QuonfigProvider } from "@quonfig/react";

const WrappedApp = () => {
  const context = {
    user: { email: "jeffrey@example.com" },
    subscription: { plan: "advanced" },
  };

  const onError = (error) => {
    console.error(error);
  };

  return (
    <QuonfigProvider sdkKey={"YOUR_SDK_KEY"} contextAttributes={context} onError={onError}>
      <App />
    </QuonfigProvider>
  );
};
```

Here's an explanation of each provider prop:

| property            | required | type                      | purpose                                                                                                     |
| ------------------- | -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `sdkKey`            | yes      | `string`                  | your Quonfig SDK key                                                                                        |
| `onError`           | no       | `(error) => void`         | callback invoked if quonfig fails to initialize                                                             |
| `contextAttributes` | no       | `Contexts`                | this is the context attributes object you passed when setting up the provider                               |
| `timeout`           | no       | `number`                  | initialization timeout (defaults to 10 seconds)                                                             |
| `pollInterval`      | no       | `number`                  | configures quonfig to poll for updates every `pollInterval` ms.                                             |
| `initialFlags`      | no       | `Record<string, unknown>` | seed flag values evaluated on the server — see [Next.js / RSC integration](#nextjs--rsc-integration) below. |

### Usage in Your Components

Use the `useQuonfig` hook to fetch flags and config values:

```javascript
const Logo = () => {
  const { isEnabled } = useQuonfig();

  if (isEnabled("new-logo")) {
    return <img src={newLogo} className="App-logo" alt="logo" />;
  }

  return <img src={logo} className="App-logo" alt="logo" />;
};
```

`useQuonfig` exposes the following:

```javascript
const { isEnabled, get, loading, contextAttributes } = useQuonfig();
```

Here's an explanation of each property:

| property            | example                 | purpose                                                                                  |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `isEnabled`         | `isEnabled("new-logo")` | returns a boolean (default `false`) if a feature is enabled based on the current context |
| `get`               | `get('retry-count')`    | returns the value of a flag or config                                                    |
| `loading`           | `if (loading) { ... }`  | a boolean indicating whether quonfig content is being loaded                             |
| `contextAttributes` | N/A                     | this is the context attributes object you passed when setting up the provider            |
| `quonfig`           | N/A                     | the underlying JavaScript quonfig instance                                               |
| `keys`              | N/A                     | an array of all the flag and config names in the current configuration                   |

### `useFlag` — per-key selector hook

`useQuonfig()` re-renders every consumer when _any_ flag value changes. For components that only
care about one flag, use `useFlag(key)` — it subscribes to that single key and skips re-renders when
unrelated flags change.

```javascript
import { useFlag } from "@quonfig/react";

const Logo = () => {
  const showNewLogo = useFlag("new-logo");
  return <img src={showNewLogo ? newLogo : logo} alt="logo" />;
};
```

If you have a typed config (via `@quonfig/cli generate`), `useFlag` returns the type declared for
the key.

## Next.js / RSC integration

The provider runs on the client (it uses `fetch` and `useEffect`), but you often want to seed flag
values on the server so the first paint reflects real data instead of defaults. Pass evaluated flags
through the `initialFlags` prop on `QuonfigProvider`.

### App Router (RSC)

Fetch flags in a Server Component, then pass the evaluated map to a Client Component that owns the
provider. `QuonfigProvider` itself must be inside a Client Component because of its hooks.

```javascript
// app/quonfig-wrapper.tsx — Client Component
"use client";

import { QuonfigProvider } from "@quonfig/react";

export function QuonfigWrapper({ children, initialFlags, contextAttributes }) {
  return (
    <QuonfigProvider
      sdkKey={process.env.NEXT_PUBLIC_QUONFIG_API_KEY!}
      contextAttributes={contextAttributes}
      initialFlags={initialFlags}
    >
      {children}
    </QuonfigProvider>
  );
}
```

```javascript
// app/layout.tsx — Server Component
import { QuonfigWrapper } from "./quonfig-wrapper";

export default async function RootLayout({ children }) {
  // Evaluate flags on the server with @quonfig/node (or similar) and
  // hand the flat key/value map to the client provider.
  const initialFlags = await evaluateFlagsOnServer({
    user: { id: "1" },
  });

  return (
    <html>
      <body>
        <QuonfigWrapper initialFlags={initialFlags} contextAttributes={{ user: { id: "1" } }}>
          {children}
        </QuonfigWrapper>
      </body>
    </html>
  );
}
```

`initialFlags` is the flat-map shape `{ flagKey: value }`, e.g.
`{ "new-logo": true, "retry-count": 3 }`. When `initialFlags` is set, the provider hydrates
synchronously on first render — no loading flicker — and skips the initial fetch. Subsequent context
changes still trigger fetches.

### Pages Router (`getServerSideProps`)

```javascript
export async function getServerSideProps({ req }) {
  const initialFlags = await evaluateFlagsOnServer(extractContext(req));
  return { props: { initialFlags } };
}

export default function Page({ initialFlags }) {
  return (
    <QuonfigProvider sdkKey={process.env.NEXT_PUBLIC_QUONFIG_API_KEY} initialFlags={initialFlags}>
      <App />
    </QuonfigProvider>
  );
}
```

### Hydration mismatch caveats

- Pass the **same** `contextAttributes` on the server and the client. If the client has different
  inputs (e.g. it adds attributes from `document` or `window`), the first client render will fetch a
  different evaluation and flag values can flicker.
- `initialFlags` only applies on the first render. Don't expect changing it later to swap flags out
  — use `setConfig`/poll for that.
- Don't combine `initialFlags` with `pollInterval` unless you want both — the provider warns at
  runtime if you do.

## SSR / multi-tenant rendering

`QuonfigProvider` is a client-only component (it uses `useEffect` and `fetch`), so it does not run
during SSR. The provider's client identity is keyed by React tree position via
`QuonfigClientContext`: a top-level provider claims the module singleton (so `import { quonfig }`
consumers see the same instance), and any nested `QuonfigProvider` mints a fresh `Quonfig()` so its
config can't leak into the parent tree.

## Usage in your test suite

Wrap the component under test in a `QuonfigTestProvider` and provide a config object to set up your
test state.

e.g. if you wanted to test the following trivial component

```javascript
function MyComponent() {
  const { get, isEnabled, loading } = useQuonfig();
  const greeting = get("greeting") || "Greetings";

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1 role="alert">{greeting}</h1>
      {isEnabled("secretFeature") && (
        <button type="submit" title="secret-feature">
          Secret feature
        </button>
      )}
    </div>
  );
}
```

You could do the following in [jest]/[rtl]

```javascript
import { QuonfigTestProvider } from '@quonfig/react';

const renderInTestProvider = (config: {[key: string]: any}) => {
  render(
    <QuonfigTestProvider config={config}>
      <MyComponent />
    </QuonfigTestProvider>,
  );
};

it('shows a custom greeting', async () => {
  renderInTestProvider({ greeting: 'Hello' });

  const alert = screen.queryByRole('alert');
  expect(alert).toHaveTextContent('Hello');
});

it('shows the secret feature when it is enabled', async () => {
  renderInTestProvider({ secretFeature: true });

  const secretFeature = screen.queryByTitle('secret-feature');
  expect(secretFeature).toBeInTheDocument();
});
```

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and
create. Any contributions you make are **greatly appreciated**. For detailed contributing
guidelines, please see [CONTRIBUTING.md](CONTRIBUTING.md)

[jest]: https://jestjs.io/
[rtl]: https://testing-library.com/docs/react-testing-library/intro/
[Quonfig]: https://quonfig.com
