# @reforge-com/react

A React provider and hook for [Reforge]

## Installation

`npm install @reforge-com/react` or `yarn add @reforge-com/react`

TypeScript types are included with the package.

## Usage in your app

### Configure the Provider

Wrap your component tree in the `ReforgeProvider`, e.g.

```javascript
import { ReforgeProvider } from "@reforge-com/react";

const WrappedApp = () => {
  const context = {
    user: { email: "jeffrey@example.com" },
    subscription: { plan: "advanced" },
  };

  const onError = (error) => {
    console.error(error);
  };

  return (
    <ReforgeProvider sdkKey={"YOUR_SDK_KEY"} contextAttributes={context} onError={onError}>
      <App />
    </ReforgeProvider>
  );
};
```

Here's an explanation of each provider prop:

| property            | required | type              | purpose                                                                       |
| ------------------- | -------- | ----------------- | ----------------------------------------------------------------------------- |
| `sdkKey`            | yes      | `string`          | your Reforge SDK key                                                          |
| `onError`           | no       | `(error) => void` | callback invoked if reforge fails to initialize                               |
| `contextAttributes` | no       | `Contexts`        | this is the context attributes object you passed when setting up the provider |
| `endpoints`         | no       | `string[]`        | CDN endpoints to load configuration from (defaults to 2 reforge-based CDNs)   |
| `timeout`           | no       | `number`          | initialization timeout (defaults to 10 seconds)                               |
| `pollInterval`      | no       | `number`          | configures reforge to poll for updates every `pollInterval` ms.               |

### Usage in Your Components

Use the `useReforge` hook to fetch flags and config values:

```javascript
const Logo = () => {
  const { isEnabled } = useReforge();

  if (isEnabled("new-logo")) {
    return <img src={newLogo} className="App-logo" alt="logo" />;
  }

  return <img src={logo} className="App-logo" alt="logo" />;
};
```

`useReforge` exposes the following:

```javascript
const { isEnabled, get, loading, contextAttributes } = useReforge();
```

Here's an explanation of each property:

| property            | example                 | purpose                                                                                  |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `isEnabled`         | `isEnabled("new-logo")` | returns a boolean (default `false`) if a feature is enabled based on the current context |
| `get`               | `get('retry-count')`    | returns the value of a flag or config                                                    |
| `loading`           | `if (loading) { ... }`  | a boolean indicating whether reforge content is being loaded                             |
| `contextAttributes` | N/A                     | this is the context attributes object you passed when setting up the provider            |
| `reforge`           | N/A                     | the underlying JavaScript reforge instance                                               |
| `keys`              | N/A                     | an array of all the flag and config names in the current configuration                   |

## Usage in your test suite

Wrap the component under test in a `ReforgeTestProvider` and provide a config object to set up your
test state.

e.g. if you wanted to test the following trivial component

```javascript
function MyComponent() {
  const { get, isEnabled, loading } = useReforge();
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
import { ReforgeTestProvider } from '@reforge-com/react';

const renderInTestProvider = (config: {[key: string]: any}) => {
  render(
    <ReforgeTestProvider config={config}>
      <MyComponent />
    </ReforgeTestProvider>,
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
[Prefab]: https://www.prefab.cloud/
