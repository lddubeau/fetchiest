/**
 * This is required to work around a problem when extending built-in classes
 * like ``Error``. Some of the constructors for these classes return a value
 * from the constructor, which is then picked up by the constructors generated
 * by TypeScript (same with ES6 code transpiled through Babel), and this messes
 * up the inheritance chain.
 *
 * See https://github.com/Microsoft/TypeScript/issues/12123.
 */
// tslint:disable:no-any
// tslint:disable-next-line:ban-types
export function fixPrototype(obj: any, parent: Function): void {
  const oldProto = Object.getPrototypeOf !== undefined ?
    Object.getPrototypeOf(obj) : obj.__proto__;

  if (oldProto !== parent) {
    if (Object.setPrototypeOf !== undefined) {
      Object.setPrototypeOf(obj, parent.prototype);
    }
    else {
      obj.__proto__ = parent.prototype;
    }
  }
}

/**
 * The diagnosis options supported by fetchiest.
 */
export interface DiagnoseOptions {
  /**
   * If set to a truthy value, this inhibits the diagnosis algorithm, and is
   * equivalent to setting no options at all. This may be useful for debugging
   * code without having to comment out code.
   */
  inhibit?: boolean;

  /**
   * A URL that used to test whether your server is running or not. We recommend
   * making it a path that is inexpensive to serve. For instance, your
   * internet-facing nginx instance could have a rule that serves 200 and no
   * contents for GETs to ``/ping``. Fetchiest uses this URL to double check
   * whether your server is up.
   */
  serverURL?: string;

  /**
   * An array of URLs to known internet servers. Fetchiest uses these URLs to
   * determine whether the Internet is accessible or not.
   */
  knownServers?: string[];

  /**
   * A timeout used when doing server checks. This is independent from the top
   * level ``timeout`` parameter. The default is a half-second.
   */
  timeout?: number;
}

interface NormalizedDiagnoseOptions extends DiagnoseOptions {
  timeout: number;
}

/**
 * The options supported by fetchiest.
 */
export interface FetchiestOptions {
  /**
   * The number of times to attempt the query. If unspecified, the default value
   * is 1. Values less than 1 yield undefined behavior.
   */
  tries?: number;

  /**
   * A timeout for each attempt, in milliseconds. If unspecified or set to 0,
   * this means that there is no timeout. Negative values yield undefined
   * behavior.
   */
  timeout?: number;

  /**
   * A delay, in milliseconds, between each tries. If unspecified, the delay is
   * 0. Negative delays yield undefined behavior.
   *
   * Note that this parameter has no impact on diagnosis. If diagnosis is
   * requested, it starts immediately after the last try. And the queries done
   * during diagnosis are not delayed from one another.
   *
   * Also note that if ``timeout`` is greater than this option, then the
   * effective delay between two tries could be greater than the value set here.
   * For instance, if you set a delay of 1 second and a timeout of 2 seconds and
   * the timeout is hit, then there will be 2 seconds between one try and the
   * next. This option is meant to prevent firing tries in too close succession.
   */
  delay?: number;

  /**
   * The diagnosis options.
   */
  diagnose?: DiagnoseOptions;
}

/**
 * Base class of all errors raised by this library. All errors raised by this
 * library are subclasses of this class. The library never creates instances of
 * this class that are not instances of children of this class (i.e. no ``new
 * GeneralFetchiestError(...)``).
 */
export class GeneralFetchiestError extends Error {
  constructor(message: string) {
    super(message);
    fixPrototype(this, GeneralFetchiestError);
  }
}

/**
 * This is the error raised if a fetch request timed out. It is possible for
 * code calling fetchiest to get this error if diagnosis is not requested and
 * all tries failed.
 */
export class TimeoutError extends GeneralFetchiestError {
  constructor() {
    super("fetch operation timed out");
    fixPrototype(this, TimeoutError);
  }
}

/**
 * Base class for all errors raised that have to do with network connectivity.
 */
export class ConnectivityError extends GeneralFetchiestError {
  constructor(message: string) {
    super(message);
    fixPrototype(this, ConnectivityError);
  }
}

/**
 * Error raised when the browser is offline.
 */
export class BrowserOfflineError extends ConnectivityError {
  constructor() {
    super("your browser is offline");
    fixPrototype(this, BrowserOfflineError);
  }
}

/**
 * Error raised when the server is down.
 */
export class ServerDownError extends ConnectivityError {
  constructor() {
    super("the server appears to be down");
    fixPrototype(this, ServerDownError);
  }
}

/**
 * Error raised when the network is down.
 */
export class NetworkDownError extends ConnectivityError {
  constructor() {
    super("the network appears to be down");
    fixPrototype(this, NetworkDownError);
  }
}

// Make sure ``url`` is unique. We do this by appending a query parameter with
// the current time. This is done to bust caches.
function dedupURL(url: string): string {
  // If there is no query yet, we just add a query, otherwise we add a
  // parameter to the query.
  return `${url}${url.indexOf("?") < 0 ? "?" : "&_="}${Date.now()}`;
}

async function makeDelay(timeout: number): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, timeout);
  });
}

async function checkURL(url: string, timeout: number): Promise<boolean> {
  return Promise.race([makeDelay(timeout).then(() => false),
                       fetch(dedupURL(url), {
                         method: "HEAD",
                       }).then(x => x.ok)
                       .catch(() => false)]);
}

// This is called when our tries all failed. This function attempts to figure
// out where the issue is.
async function diagnoseIt(diagnose: NormalizedDiagnoseOptions): Promise<void> {
  // The browser reports being offline, blame the problem on this.
  if (("onLine" in navigator) && !navigator.onLine) {
    throw new BrowserOfflineError();
  }

  const { serverURL, knownServers: servers, timeout } = diagnose;
  // If the user gave us a server URL to check whether the server is up at all,
  // use it. If that failed, then we need to check the connection. If we do not
  // have a server URL, then we need to check the connection right away.
  if (serverURL === undefined || !await checkURL(serverURL, timeout)) {
    // We check all the servers that the user asked to check. If none respond,
    // we blame the network. Otherwise, we blame the server.
    throw (servers != null && servers.length !== 0 &&
           !(await Promise.all(servers
                               .map(async url => checkURL(url, timeout))))
           .some(r => r)) ? new NetworkDownError() : new ServerDownError();
  }
}

export type FetchiestRequestInit =
  RequestInit & { fetchiestOptions?: FetchiestOptions };

async function fetchiest(input: RequestInfo,
                         init?: FetchiestRequestInit): Promise<Response> {
  // If we did not specify any fetchiestOptions, then we don't want any of this
  // module's features.
  if (init === undefined || init.fetchiestOptions === undefined) {
    return fetch(input, init);
  }

  // tslint:disable-next-line:prefer-const
  let { fetchiestOptions: { tries, diagnose, timeout, delay } } = init;
  if (tries === undefined) {
    tries = 1;
  }

  let lastError: any;
  let waitFor: Promise<void> = Promise.resolve();
  while (tries > 0) {
    if (delay !== undefined) {
      await waitFor;
      if (tries > 1) {
        waitFor = makeDelay(delay);
      }
    }

    const query = fetch(input, init);
    let result: Response | null = null;
    try {
      result = await (timeout === undefined ? query :
                      Promise.race([query,
                                    makeDelay(timeout).then(() => {
                                      throw new TimeoutError();
                                    })]));
    }
    catch (ex) {
      lastError = ex;
    }

    if (result !== null) {
      return result;
    }

    tries--;
  }

  if (diagnose !== undefined && diagnose.inhibit !== true) {
    if (diagnose.timeout === undefined) {
      diagnose.timeout = 500;
    }

    await diagnoseIt(diagnose as NormalizedDiagnoseOptions);
  }

  // If we get here, the diagnosis did not fail... so we throw the error we
  // should have thrown on the last try.
  throw lastError;
}

export { fetchiest as fetch };
