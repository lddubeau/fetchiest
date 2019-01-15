/* global module require */
/* eslint-env node */
"use strict";

// Minimal localConfig if there is not one locally.
let localConfig = {
  browserStack: {},
};
try {
  // eslint-disable-next-line import/no-unresolved, global-require
  localConfig = require("./localConfig");
}
catch (ex) {} // eslint-disable-line no-empty

module.exports = function configure(config) {
  const coverage = !config.debug ? ["coverage"] : [];
  const options = {
    basePath: "",
    frameworks: ["mocha", "source-map-support"],
    files: [
      "node_modules/systemjs/dist/system.js",
      "test/karma-main.js",
      { pattern: "build/dist/fetchiest.*", included: false },
      { pattern: "test/*.ts", included: false },
      { pattern: "node_modules/chai/chai.js", included: false },
      { pattern: "node_modules/sinon/**/*.js", included: false },
      { pattern: "node_modules/expect-rejection/**/*.js", included: false },
      { pattern: "node_modules/sinon-chai/**/*.js", included: false },
    ],
    client: {
      mocha: {
        asyncOnly: true,
        grep: config.grep,
      },
    },
    preprocessors: {
      "test/*.ts": ["typescript"],
      "build/dist/fetchiest.js": coverage,
    },
    typescriptPreprocessor: {
      tsconfigPath: "./test/tsconfig.json",
      compilerOptions: {
        // eslint-disable-next-line global-require, import/no-extraneous-dependencies
        typescript: require("typescript"),
        sourceMap: false,
        // We have to have them inline for the browser to find them.
        inlineSourceMap: true,
        inlineSources: true,
      },
    },
    reporters: ["mocha", "coverage", "karma-remap-istanbul"],
    coverageReporter: {
      type: "in-memory",
    },
    remapIstanbulReporter: {
      reports: {
        html: "coverage/karma",
      },
    },
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ["ChromeHeadless", "FirefoxHeadless"],
    browserStack: {
      project: "fetchiest",
    },
    customLaunchers: {
      ChromeWin: {
        base: "BrowserStack",
        browser: "Chrome",
        os: "Windows",
        os_version: "10",
      },
      FirefoxWin: {
        base: "BrowserStack",
        browser: "Firefox",
        os: "Windows",
        os_version: "10",
      },
      Edge: {
        base: "BrowserStack",
        browser: "Edge",
        os: "Windows",
        os_version: "10",
      },
      Opera: {
        base: "BrowserStack",
        browser: "Opera",
        os: "Windows",
        os_version: "10",
      },
      SafariHighSierra: {
        base: "BrowserStack",
        browser: "Safari",
        os: "OS X",
        os_version: "High Sierra",
      },
      SafariSierra: {
        base: "BrowserStack",
        browser: "Safari",
        os: "OS X",
        os_version: "Sierra",
      },
    },
    singleRun: false,
  };

  // Bring in the options from the localConfig file.
  Object.assign(options.browserStack, localConfig.browserStack);

  const { browsers } = config;
  if (browsers.length === 1 && browsers[0] === "all") {
    const newList = options.browsers.concat(Object.keys(options.customLaunchers));

    // Yes, we must modify this array in place.
    browsers.splice.apply(browsers, [0, browsers.length].concat(newList));
  }

  config.set(options);
};
