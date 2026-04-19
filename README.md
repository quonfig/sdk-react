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

| property            | required | type              | purpose                                                                       |
| ------------------- | -------- | ----------------- | ----------------------------------------------------------------------------- |
| `sdkKey`            | yes      | `string`          | your Quonfig SDK key                                                          |
| `onError`           | no       | `(error) => void` | callback invoked if quonfig fails to initialize                               |
| `contextAttributes` | no       | `Contexts`        | this is the context attributes object you passed when setting up the provider |
| `timeout`           | no       | `number`          | initialization timeout (defaults to 10 seconds)                               |
| `pollInterval`      | no       | `number`          | configures quonfig to poll for updates every `pollInterval` ms.               |

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
