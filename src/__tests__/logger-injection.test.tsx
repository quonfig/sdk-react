import React, { act } from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { QuonfigProvider, Logger } from "../index";

let consoleWarnSpy: ReturnType<typeof jest.spyOn>;
let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => ({ evaluations: {} }),
    })
  ) as jest.Mock;
});

afterEach(() => {
  consoleWarnSpy.mockReset();
  consoleErrorSpy.mockReset();
});

const makeSpyLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe("QuonfigProvider logger prop (qfg-mol-1qw.4)", () => {
  it("routes the no-contextAttributes warning through the supplied logger", () => {
    const logger = makeSpyLogger();

    render(<QuonfigProvider sdkKey="sdk-key" logger={logger} />);

    expect(logger.warn).toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it("routes the polling+initialFlags conflict warning through the supplied logger", () => {
    const logger = makeSpyLogger();

    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { email: "test@example.com" } }}
        logger={logger}
        pollInterval={1000}
        initialFlags={{}}
      />
    );

    const warnedAboutPolling = logger.warn.mock.calls.some((call) =>
      String(call[0]).includes("Polling is not supported when hydrating flags via initialFlags")
    );
    expect(warnedAboutPolling).toBe(true);
  });

  it("routes the default onError fallback through logger.error when no onError is supplied", async () => {
    const logger = makeSpyLogger();

    global.fetch = jest.fn(() => Promise.reject(new Error("Network error"))) as jest.Mock;

    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { email: "test@example.com" } }}
        logger={logger}
        initTimeout={20}
      />
    );

    await act(async () => {
      await new Promise((r) => {
        setTimeout(r, 50);
      });
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Network error"),
      expect.any(Error)
    );
    // The provider's fallback (message, error) must not reach console.error.
    // @quonfig/javascript >= 1.6 logs its own "[quonfig] init FAILED" line to
    // the console (the js client takes no logger), so filter to the provider's
    // call shape rather than asserting console.error was never called.
    const providerShapedCalls = consoleErrorSpy.mock.calls.filter(
      (args: unknown[]) => args[1] instanceof Error
    );
    expect(providerShapedCalls).toEqual([]);
  });

  it("falls back to console.warn / console.error when no logger prop is supplied", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("Network error"))) as jest.Mock;

    // initTimeout: js >= 1.6 retries until initTimeout before it rejects.
    render(<QuonfigProvider sdkKey="sdk-key" initTimeout={20} />);

    await act(async () => {
      await new Promise((r) => {
        setTimeout(r, 50);
      });
    });

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("does not throw when the supplied logger omits debug and info", () => {
    const partialLogger: Logger = {
      warn: jest.fn(),
      error: jest.fn(),
    };

    expect(() => render(<QuonfigProvider sdkKey="sdk-key" logger={partialLogger} />)).not.toThrow();

    expect(partialLogger.warn).toHaveBeenCalled();
  });
});
