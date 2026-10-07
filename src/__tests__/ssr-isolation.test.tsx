/**
 * @jest-environment node
 */

/**
 * qfg-goi1.2.1: on the server (`typeof window === "undefined"`) every
 * QuonfigProvider must get its own Quonfig client. The module singleton from
 * @quonfig/javascript is shared by every request in the process, so seeding it
 * with one request's `initialFlags` can put that user's values into another
 * user's server-rendered HTML.
 */

import React, { Suspense } from "react";
import { renderToString, renderToPipeableStream } from "react-dom/server";
import { Writable } from "stream";
import { quonfig } from "@quonfig/javascript";
import { QuonfigProvider, useQuonfig } from "../index";

// fetch mock: the evaluation payload depends on which user is in the context.
const who = (url: string): string => {
  const seg = url.split("eval-with-context/")[1].split("?")[0];
  const decoded = Buffer.from(decodeURIComponent(seg), "base64").toString("utf8");
  return decoded.includes("alice") ? "alice" : "bob";
};

beforeEach(() => {
  global.fetch = jest.fn(async (url: string) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      evaluations: { banner: { value: { type: "string", value: `for-${who(url)}` } } },
    }),
  })) as unknown as typeof fetch;
});

// One text node, so renderToString does not insert a `<!-- -->` separator.
const Banner = () => {
  const { get } = useQuonfig();
  return <p>{`banner=${String(get("banner"))}`}</p>;
};

describe("SSR request isolation", () => {
  it("a server render does not write initialFlags into the module singleton", () => {
    renderToString(
      <QuonfigProvider
        sdkKey="k"
        contextAttributes={{ user: { key: "carol" } }}
        initialFlags={{ "ssr-only-key": "for-carol" }}
      >
        <Banner />
      </QuonfigProvider>
    );

    expect(quonfig.get("ssr-only-key")).toBeUndefined();
  });

  it("sequential renders with different key sets do not leak values", () => {
    const a = renderToString(
      <QuonfigProvider
        sdkKey="k"
        contextAttributes={{ user: { key: "alice" } }}
        initialFlags={{ banner: "for-alice" }}
      >
        <Banner />
      </QuonfigProvider>
    );
    const b = renderToString(
      <QuonfigProvider
        sdkKey="k"
        contextAttributes={{ user: { key: "bob" } }}
        initialFlags={{ other: 1 }}
      >
        <Banner />
      </QuonfigProvider>
    );

    expect(a).toContain("banner=for-alice");
    expect(b).toContain("banner=undefined");
    expect(b).not.toContain("for-alice");
  });

  it("streaming Suspense: a concurrent request with the same key set does not leak into pending HTML", async () => {
    // Request A seeds its provider with its own flags.
    const flagsA = { banner: "for-alice" };

    // A Suspense child that stays pending until we release it. A thrown
    // promise works on both React 18 and 19 (React.use is 19-only).
    let ready = false;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = () => {
        ready = true;
        resolve();
      };
    });
    const Deferred = () => {
      if (!ready) throw gate;
      return <Banner />;
    };

    let html = "";
    const done = new Promise<void>((resolve, reject) => {
      const sink = new Writable({
        write(chunk, _enc, cb) {
          html += chunk.toString();
          cb();
        },
        final(cb) {
          resolve();
          cb();
        },
      });
      const { pipe } = renderToPipeableStream(
        <QuonfigProvider
          sdkKey="k"
          contextAttributes={{ user: { key: "alice" } }}
          initialFlags={flagsA}
        >
          <Suspense fallback={<p>loading</p>}>
            <Deferred />
          </Suspense>
        </QuonfigProvider>,
        { onShellReady: () => pipe(sink), onShellError: reject }
      );
    });

    // Request B arrives while A's boundary is still pending and loads the
    // same key on the module singleton (the old docs pattern).
    await quonfig.init({
      sdkKey: "k",
      context: { user: { key: "bob" } },
      collectEvaluationSummaries: false,
    });
    expect(quonfig.get("banner")).toBe("for-bob");

    release();
    await done;

    expect(html).toContain("banner=for-alice");
    expect(html).not.toContain("for-bob");
  });
});
