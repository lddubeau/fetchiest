import { expect, use } from "chai";
import * as chai from "chai";
import { expectRejection, use as erUse } from "expect-rejection";
import "mocha";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";

use(sinonChai);
erUse(chai);

// tslint:disable-next-line:no-implicit-dependencies
import * as fetchiest from "fetchiest";

// tslint:disable-next-line:no-any
function checkServerCheck(call: any[], serverURL: string): void {
  const startsWith = `${serverURL}?`;
  expect(call[0].startsWith(startsWith),
         `the call should have requested the server URL with \
favicon.ico? appended (${call[0]} does not begin with ${startsWith})`)
    .to.be.true;
}

describe("fetchiest", () => {
  let sandbox: sinon.SinonSandbox;
  let fetchStub: sinon.SinonStub<Parameters<typeof fetch>,
  ReturnType<typeof fetch>>;
  let onLine = true;
  const url = "http://www.example.com";
  let success: Response;
  // const error = [500, { "Content-Type": "application/html" }, "error"];

  function mockNavigatorOnline(): void {
    const descriptor = {
      get: () => onLine,
    };
    // This works in Chrome, Firefox, the IE family (IE, Edge), but not in
    // Safari. In Safari 9.1, it fails silently.
    Object.defineProperty(navigator.constructor.prototype, "onLine",
                          descriptor);

    // Check whether we're actually controlling navigator.onLine.
    onLine = false;
    let passes = navigator.onLine === onLine;
    onLine = true;
    passes = passes && (navigator.onLine === onLine);

    if (!passes) {
      // This works in Safari but will fail in Chrome, for instance. So we
      // cannot just use the following method for all browsers.

      // eslint-disable-next-line no-native-reassign, no-global-assign
      navigator = Object.create(navigator, { onLine: descriptor });
    }
  }

  before(() => {
    success = new Response("something", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });

    sandbox = sinon.createSandbox({
      useFakeTimers: true,
    });
    fetchStub = sandbox.stub(window, "fetch");
    mockNavigatorOnline();
    onLine = true;
  });

  beforeEach(() => {
    onLine = true;
  });

  afterEach(() => {
    sandbox.reset();
  });

  after(() => {
    sandbox.restore();
  });

  async function next(): Promise<void> {
    sandbox.clock.next();
    // Yes we need to resolve four times. :-/
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  async function tick(n: number): Promise<void> {
    sandbox.clock.tick(n);
    // Yes we need to resolve twice. :-/
    await Promise.resolve();
    await Promise.resolve();
  }

  async function neverResolves(): Promise<Response> {
    // tslint:disable-next-line:promise-must-complete
    return new Promise<Response>(() => undefined);
  }

  describe("#fetch", () => {
    describe("without any fetchiest options", () => {
      it("returns fetch's response immediately on success", async () => {
        fetchStub.returns(Promise.resolve(success));
        expect(await fetchiest.fetch(url)).to.equal(success);
        expect(fetchStub).to.have.been.calledOnce;
      });

      it("rejects immediately with fetch's rejection", async () => {
        const error = new Error("foo");
        fetchStub.returns(Promise.reject(error));
        await expectRejection(fetchiest.fetch(url), Error, "foo");
        expect(fetchStub).to.have.been.calledOnce;
      });

      it("passes fetch options to fetch", async () => {
        const fetchOptions = {};
        fetchStub.returns(Promise.resolve(success));
        expect(await fetchiest.fetch(url, fetchOptions)).to.equal(success);
        expect(fetchStub).to.have.been.calledOnce;
        expect(fetchStub).to.have.been.calledWith(url, fetchOptions);
      });
    });

    describe("with fetchiest options", () => {
      const options = {
        fetchiestOptions: {
          tries: 3,
        },
      };

      it("returns fetch's response immediately on immediate success",
         async () => {
           fetchStub.returns(Promise.resolve(success));
           expect(await fetchiest.fetch(url, options)).to.equal(success);
           expect(fetchStub).to.have.been.calledOnce;
         });

      it("passes fetch options to fetch", async () => {
        fetchStub.returns(Promise.resolve(success));
        expect(await fetchiest.fetch(url, options)).to.equal(success);
        expect(fetchStub).to.have.been.calledOnce;
        expect(fetchStub).to.have.been.calledWith(url, options);
      });

      it("rejects with fetch's rejection", async () => {
        const error = new Error("foo");
        fetchStub.returns(Promise.reject(error));
        await expectRejection(fetchiest.fetch(url, options), Error, "foo");
      });

      it("rejects immediately if tries is unspecified", async () => {
        const error = new Error("foo");
        fetchStub.returns(Promise.reject(error));
        await expectRejection(fetchiest.fetch(url, { fetchiestOptions: {} }),
                              Error, "foo");
        expect(fetchStub).to.have.been.calledOnce;
      });

      it("rejects after the number of specified tries", async () => {
        const error = new Error("foo");
        fetchStub.returns(Promise.reject(error));
        await expectRejection(fetchiest.fetch(url, options),
                              Error, "foo");
        expect(fetchStub).to.have.been.calledThrice;
      });

      it("returns fetch's response as soon as successful ", async () => {
        const error = new Error("foo");
        fetchStub.onFirstCall().returns(Promise.reject(error))
          .onSecondCall().returns(Promise.resolve(success));
        expect(await fetchiest.fetch(url, options)).to.equal(success);
        expect(fetchStub).to.have.been.calledTwice;
      });

      it("retries on timeouts", async () => {
        fetchStub.returns(neverResolves());
        const p = fetchiest.fetch(url, {
          fetchiestOptions: {
            tries: 3,
            timeout: 1000,
          },
        });
        expect(fetchStub).to.have.been.calledOnce;
        await next();
        expect(fetchStub).to.have.been.calledTwice;
        await next();
        expect(fetchStub).to.have.been.calledThrice;
        await next();
        await expectRejection(p, fetchiest.TimeoutError, /.*/);
        expect(fetchStub).to.have.been.calledThrice;
      });

      it("rejects with a TimeoutError on timeout", async () => {
        fetchStub.returns(neverResolves());
        const p = fetchiest.fetch(url, {
          fetchiestOptions: {
            timeout: 1000,
          },
        });
        expect(fetchStub).to.have.been.calledOnce;
        await next();
        await expectRejection(p, fetchiest.TimeoutError, /.*/);
        expect(fetchStub).to.have.been.calledOnce;
      });

      it("reports offline when offline", async () => {
        const error = new Error("foo");
        fetchStub.returns(Promise.reject(error));
        onLine = false;
        // tslint:disable-next-line:no-http-string
        await expectRejection(fetchiest.fetch("http://example.com:80", {
          fetchiestOptions: {
            tries: 2,
            diagnose: {
              serverURL: "http://localhost:1025/",
            },
          },
        }),
                              fetchiest.BrowserOfflineError,
                              "your browser is offline");
        expect(fetchStub).to.have.been.calledTwice;
      });

      it("reports server down when online and no knownServers", async () => {
        const error = new Error("foo");
        fetchStub.returns(Promise.reject(error));
        // tslint:disable-next-line:no-http-string
        await expectRejection(fetchiest.fetch("http://example.com:80", {
          fetchiestOptions: {
            tries: 2,
            diagnose: {
              serverURL: "http://localhost:1025/",
            },
          },
        }),
                              fetchiest.ServerDownError,
                              "the server appears to be down");
        // Two retries plus the diagnosis equals 3 calls.
        expect(fetchStub).to.have.been.calledThrice;
        checkServerCheck(fetchStub.args[2], "http://localhost:1025/");
      });

      it("reports server down when server times out", async () => {
        const error = new Error("foo");
        fetchStub.onFirstCall().returns(Promise.reject(error))
          .onSecondCall().returns(neverResolves());
        // tslint:disable-next-line:no-http-string
        const p = fetchiest.fetch("http://example.com:80", {
          fetchiestOptions: {
            diagnose: {
              serverURL: "http://localhost:1025/",
            },
          },
        });
        await next();
        await next();
        await expectRejection(p, fetchiest.ServerDownError,
                              "the server appears to be down");
        // One try plus the diagnosis equals 2 calls.
        expect(fetchStub).to.have.been.calledTwice;
        checkServerCheck(fetchStub.args[1], "http://localhost:1025/");
      });

      it("reports network down when no knownServers are reached ", async () => {
        const error = new Error("foo");
        fetchStub.returns(Promise.reject(error));
        const knownServers = [
          // tslint:disable-next-line:no-http-string
          "http://www.google.com/",
          // tslint:disable-next-line:no-http-string
          "http://www.cloudfront.com/",
        ];

        // tslint:disable-next-line:no-http-string
        await expectRejection(fetchiest.fetch("http://example.com:80", {
          fetchiestOptions: {
            tries: 2,
            diagnose: {
              serverURL: "http://localhost:1025/",
              knownServers,
            },
          },
        }),
                              fetchiest.NetworkDownError,
                              "the network appears to be down");
        // Two retries plus the diagnosis equals 5 calls.
        expect(fetchStub).to.have.callCount(5);
        // Check that the 1st call after the 2 tries was to the serverURL.
        const serverCall = fetchStub.args[2];
        checkServerCheck(serverCall, "http://localhost:1025/");

        const networkCalls = fetchStub.args.slice(3);
        for (let i = 0; i < networkCalls.length; ++i) {
          checkServerCheck(networkCalls[i], knownServers[i]);
        }
      });

      it("reports a server down when knownServers are reached ", async () => {
        const error = new Error("foo");
        fetchStub
        // Reject our single actual try.
          .onFirstCall().returns(Promise.reject(error))
        // Reject the contact with the server.
          .onSecondCall().returns(Promise.reject(error))
        // Success on reaching the first known server
          .onThirdCall().returns(Promise.resolve(success))
        // Error on reaching the second known server
          .onCall(3).returns(Promise.reject(error));
        const knownServers = [
          // tslint:disable-next-line:no-http-string
          "http://www.google.com/",
          // tslint:disable-next-line:no-http-string
          "http://www.cloudfront.com/",
        ];
        // tslint:disable-next-line:no-http-string
        await expectRejection(fetchiest.fetch("http://example.com:80", {
          fetchiestOptions: {
            diagnose: {
              serverURL: "http://localhost:1025/",
              knownServers,
            },
          },
        }),
                              fetchiest.ServerDownError,
                              "the server appears to be down");
        // We tried once and then tried diagnosing.
        expect(fetchStub).to.have.callCount(4);

        // Check that the 1st call after the try was to the serverURL.
        const serverCall = fetchStub.args[1];
        checkServerCheck(serverCall, "http://localhost:1025/");

        const networkCalls = fetchStub.args.slice(2);
        for (let i = 0; i < networkCalls.length; ++i) {
          checkServerCheck(networkCalls[i], knownServers[i]);
        }
      });

      it("ignores diagnosis when inhibit is true", async () => {
        const error = new Error("foo");
        fetchStub.returns(Promise.reject(error));
        await expectRejection(fetchiest.fetch(url, {
          fetchiestOptions: {
            diagnose: {
              inhibit: true,
              serverURL: "http://localhost:1025/",
            },
          },
        }),
                              Error, "foo");
        expect(fetchStub).to.have.been.calledOnce;
      });

      it("does not ignore diagnosis when inhibit is false", async () => {
        const error = new Error("foo");
        fetchStub.returns(Promise.reject(error));
        await expectRejection(fetchiest.fetch(url, {
          fetchiestOptions: {
            diagnose: {
              inhibit: false,
              serverURL: "http://localhost:1025/",
            },
          },
        }),
                              fetchiest.ServerDownError,
                              "the server appears to be down");
        expect(fetchStub).to.have.been.calledTwice;
      });

      it("delays tries when delay is specified", async () => {
        const error = new Error("foo");
        fetchStub.returns(Promise.reject(error));
        const p = fetchiest.fetch(url, {
          fetchiestOptions: {
            tries: 2,
            delay: 1000,
          },
        });

        // This moves us past the 1st 0-second wait used in the loop.
        await next();
        expect(fetchStub).to.have.been.calledOnce;

        await tick(500);
        // We've moved forward by 500 ms. That's still not past to 1000 ms
        // delay.
        expect(fetchStub).to.have.been.calledOnce;

        await tick(500);
        // Now we should be past the delay.
        expect(fetchStub).to.have.been.calledTwice;
        await expectRejection(p, Error, "foo");
      });
    });
  });
});
