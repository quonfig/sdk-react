/**
 * qfg-41nh.28 (WS5.4) — `hedgeDelay` is plumbed through QuonfigProvider so
 * React consumers can tune the hedge (spec 5e) against their primary's p99
 * without dropping to the explicit-`apiUrls` escape hatch. The prop must reach
 * the underlying `@quonfig/javascript` client's `init()` (and therefore its
 * Loader).
 */
import React, { act } from "react";
import { render } from "@testing-library/react";
import { Quonfig } from "@quonfig/javascript";
import { QuonfigProvider, useQuonfig } from "../index";

function Child() {
  useQuonfig();
  return <div>child</div>;
}

let initSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => ({ evaluations: {} }),
    })
  ) as jest.Mock;
  initSpy = jest.spyOn(Quonfig.prototype, "init");
});

afterEach(() => {
  jest.restoreAllMocks();
});

const contextAttributes = { user: { key: "alice" } };

it("forwards hedgeDelay to the underlying client init()", async () => {
  render(
    <QuonfigProvider
      sdkKey="sdk-key"
      contextAttributes={contextAttributes}
      hedgeDelay={1234}
      onError={() => {}}
    >
      <Child />
    </QuonfigProvider>
  );

  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

  expect(initSpy).toHaveBeenCalled();
  const initArg = initSpy.mock.calls[0][0] as { hedgeDelay?: number };
  expect(initArg.hedgeDelay).toBe(1234);
});

it("reaches the client's Loader so the hedge actually uses it", async () => {
  let client: Quonfig | undefined;

  function Capture() {
    const { quonfig } = useQuonfig();
    client = quonfig as unknown as Quonfig;
    return null;
  }

  render(
    <QuonfigProvider
      sdkKey="sdk-key"
      contextAttributes={contextAttributes}
      hedgeDelay={4321}
      onError={() => {}}
    >
      <Capture />
    </QuonfigProvider>
  );

  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

  expect(client).toBeDefined();
  expect((client as unknown as { loader?: { hedgeDelay?: number } }).loader?.hedgeDelay).toBe(4321);
});

it("omits hedgeDelay when the prop is not set (client falls back to its default)", async () => {
  render(
    <QuonfigProvider sdkKey="sdk-key" contextAttributes={contextAttributes} onError={() => {}}>
      <Child />
    </QuonfigProvider>
  );

  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });

  expect(initSpy).toHaveBeenCalled();
  const initArg = initSpy.mock.calls[0][0] as { hedgeDelay?: number };
  expect(initArg.hedgeDelay).toBeUndefined();
});
