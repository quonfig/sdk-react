/**
 * qfg-lkpm.6: useFlag(key) is a per-key selector hook. Components subscribed
 * to a single flag must NOT re-render when an unrelated flag changes. This is
 * the property `useQuonfig()` does not have — it bumps every consumer on every
 * data-version increment.
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { Quonfig } from "@quonfig/javascript";
import { QuonfigProvider, useFlag, useQuonfig } from "../index";

let warnSpy: ReturnType<typeof jest.spyOn>;
let errorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

const stubFetch = (initial: Record<string, unknown> = {}) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => ({ evaluations: initial }),
    })
  ) as jest.Mock;
};

const initialPayload = {
  foo: { value: { type: "string", value: "FOO_INITIAL" } },
  bar: { value: { type: "string", value: "BAR_INITIAL" } },
};

describe("useFlag selector hook (qfg-lkpm.6)", () => {
  it("returns the current value for a key and updates when that key changes", async () => {
    stubFetch(initialPayload);

    let client: Quonfig | undefined;

    function FooView() {
      const value = useFlag("foo");
      return <div data-testid="foo">{String(value)}</div>;
    }
    function ClientCapture() {
      const { quonfig } = useQuonfig();
      client = quonfig as Quonfig;
      return null;
    }

    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { id: "1" } }}
        onError={() => {}}
      >
        <FooView />
        <ClientCapture />
      </QuonfigProvider>
    );

    await waitFor(() => expect(screen.getByTestId("foo")).toHaveTextContent("FOO_INITIAL"));

    act(() => {
      client!.setConfig({
        evaluations: {
          ...initialPayload,
          foo: { value: { type: "string", value: "FOO_UPDATED" } },
        },
      } as any);
    });

    await waitFor(() => expect(screen.getByTestId("foo")).toHaveTextContent("FOO_UPDATED"));
  });

  it("does not re-render a useFlag('foo') consumer when an unrelated flag 'bar' changes", async () => {
    stubFetch(initialPayload);

    let client: Quonfig | undefined;
    let fooRenders = 0;
    let barRenders = 0;
    let fullRenders = 0;

    function FooView() {
      fooRenders += 1;
      const value = useFlag("foo");
      return <div data-testid="foo">{String(value)}</div>;
    }
    function BarView() {
      barRenders += 1;
      const value = useFlag("bar");
      return <div data-testid="bar">{String(value)}</div>;
    }
    function FullView() {
      fullRenders += 1;
      const { get } = useQuonfig();
      return <div data-testid="full">{String(get("bar"))}</div>;
    }
    function ClientCapture() {
      const { quonfig } = useQuonfig();
      client = quonfig as Quonfig;
      return null;
    }

    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { id: "1" } }}
        onError={() => {}}
      >
        <FooView />
        <BarView />
        <FullView />
        <ClientCapture />
      </QuonfigProvider>
    );

    // Wait for initial load to settle so render counts stabilise.
    await waitFor(() => expect(screen.getByTestId("foo")).toHaveTextContent("FOO_INITIAL"));
    await waitFor(() => expect(screen.getByTestId("bar")).toHaveTextContent("BAR_INITIAL"));

    const fooBaseline = fooRenders;
    const barBaseline = barRenders;
    const fullBaseline = fullRenders;

    // Mutate ONLY bar — foo's value stays exactly the same primitive string.
    act(() => {
      client!.setConfig({
        evaluations: {
          foo: { value: { type: "string", value: "FOO_INITIAL" } },
          bar: { value: { type: "string", value: "BAR_UPDATED" } },
        },
      } as any);
    });

    await waitFor(() => expect(screen.getByTestId("bar")).toHaveTextContent("BAR_UPDATED"));

    // The selector hook for foo MUST NOT have re-rendered — its value is
    // unchanged. This is the specific mechanism under test: if useFlag fell
    // back to a context whose value identity changes on every dataVersion
    // bump (the useQuonfig path), this assertion would fail.
    expect(fooRenders).toBe(fooBaseline);

    // bar consumer DID re-render — it's the one whose key changed.
    expect(barRenders).toBeGreaterThan(barBaseline);

    // useQuonfig consumer also re-rendered — confirms the change actually
    // propagated and we're not just measuring a no-op.
    expect(fullRenders).toBeGreaterThan(fullBaseline);
  });
});
