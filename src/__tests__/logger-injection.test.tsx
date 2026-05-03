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
      />
    );

    await act(async () => {
      await new Promise((r) => {
        setTimeout(r, 50);
      });
    });

    expect(logger.error).toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("falls back to console.warn / console.error when no logger prop is supplied", async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error("Network error"))) as jest.Mock;

    render(<QuonfigProvider sdkKey="sdk-key" />);

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
