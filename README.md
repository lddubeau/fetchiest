Features
========

* Optionally retry failed queries a number of times before giving up.

* Optionally diagnoses failed queries: network failure, server down, something
  else?

* Times out queries.

Platforms Supported
===================

This library is formally tested on:

* the latest version of Chrome and Firefox

* Edge 18

* Safari 11, 10

If you need formal support for other platforms, or old browser versions, PRs are
welcome.

Loading
=======

Fetchiest is built with a stub that allows loading it as an AMD module or a
CommonJS module.

Using Fetchiest
===============

The module exports these items:

* ``fetch(...)`` is a function that passes all its arguments to WHATWG's
  ``fetch``. However, the 2nd argument may take options specific to fetchiest.

* ``GeneralFetchiestError`` is a class that derives from JavaScript's stock
  ``Error``. The following errors are derived from it.

* ``TimeoutError`` is raised if the rejection was caused by a timeout.

* ``ConnectivityError`` indicates a network problem. This class of error is
  never raised directly but is raised through its children:

  + ``BrowserOfflineError`` is raised if the browser is offline.

  + ``ServerDownError`` is raised if the server is down.

  + ``NetworkDownError`` is raised if the network is down.

Options
-------

To set fetchiest's options, you can just add them to the ``RequestInit`` object
passed to ``fetch``, in a field named ``fetchiestOptions``. (The 2nd argument.)
For instance,

```
const rep = fetch("http://example.com", {
  fetchiestOptions: {
    tries: 3,
    diagnose: {
      serverURL: "...",
    },
  },
});
```

Fetchiest currently supports these options:

* ``tries``: the number of times to attempt the query. If unspecified, the
  default value is 1. Values less than 1 yield undefined behavior.

* ``timeout``: a timeout for each attempt, in milliseconds. If unspecified or
  set to 0, this means that there is no timeout. Negative values yield undefined
  behavior.

* ``delay``: a delay, in milliseconds, between each tries. If unspecified, the
  delay is 0. Negative delays yield undefined behavior.

* ``diagnose`` is an object with the following keys:

    * ``inhibit``: if set to a truthy value, this inhibits the diagnosis
      algorithm, and is equivalent to setting no options at all. This may be
      useful for debugging code without having to comment out code.

    * ``timeout``: this is a timeout used when doing server checks. This is
      independent from the top level ``timeout`` parameter. The default is a
      half-second.

    * ``serverURL``: a URL that used to test whether your server is running or
      not. We recommend making it a path that is inexpensive to serve. For
      instance, your internet-facing nginx instance could have a rule that
      serves 200 and no contents for GETs to ``/ping``. Fetchiest uses this URL
      to double check whether your server is up.

    * ``knownServers``: an array of URLs to known internet servers. Fetchiest
      uses these URLs to determine whether the Internet is accessible or not.

Diagnosis Rules
===============

Diagnosis happens only if the final try for the request failed with a timeout or
if ``fetch`` produced a rejected promise. Otherwise, no diagnosis occurs and the
error is reported immediately.

Fetchiest uses the following rules when diagnosis is requested:

1. If ``navigator.onLine`` is false, Fetchiest reports that the browser is
   offline.

2. If a ``serverURL`` is specified, then it checks whether the server is
   responds to a GET at this URL:

  A. If the server responds, Fetchiest reports the error that was reported by the
    last try.

  B. If the server does not respond, Fetchiest reports the result of a
     connectivity check.

3. If a ``serverURL`` was not specified, Fetchiest reports the result of a
   connectivity check.

Connectivity Check
------------------

1. If ``knownServers`` does not exist or is an empty list, then it reports that
   the server appears to be down.

2. Otherwise, Fetchiest contacts all the servers. If none of them respond, then
   it reports that the network appears to be down. Otherwise, it reports that
   the server appears to be down.

URL Checking Rules
------------------

For all URLs used in diagnosis, the URL is transformed prior to being used:

1. If it has no query, then it is transformed by adding a query that is a single
   number corresponding to the current time.

2. If it has a query, then it is transformed by adding a parameter named `_` and
   having for value a number corresponding to the current time.

We do this to bust caches.

Developing Fetchiest
==================

If you produce a pull request run ``npm test`` first to make sure they run
clean. If you add features, do add tests.

Coverage
--------

We need a Mocha run to test loading Fetchiest as a CommonJS module with ``script``
elements. The Karma run, which exercises over 95% of the code, uses RequireJS
to load Fetchiest.

Ideally, we combine the results of the Karma runs with the result of the Mocha
run. The problem though is that as we speak, ``karma-coverage`` uses Istanbul
0.4.x but to get coverage with Mocha with code that has run through Babel, we
need Istanbul 1.0.0-alpha2 or higher. We've not been able to combine the formats
produced by the various versions.

Testing
-------

[![Browser Stack](https://www.browserstack.com/images/mail/browserstack-logo-footer.png)](https://www.browserstack.com)

Fetchiest is tested using
[BrowserStack](https://www.browserstack.com). BrowserStack provides this service
for free under their program for supporting open-source software.

<!--
#  LocalWords:  Fetchiest jQuery's ajax jQuery jquery CommonJS bluejax url jqXHR
#  LocalWords:  GeneralAjaxError getElementById innerHTML verboseResults nginx
#  LocalWords:  textStatus errorThrown HttpError TimeoutError AbortError GETs
#  LocalWords:  ParserError ConnectivityError BrowserOfflineError AjaxError xhr
#  LocalWords:  ServerDownError NetworkDownError setDefaultOptions Fetchiest's
#  LocalWords:  getDefaultOptions serverURL knownServers verboseExceptions JSON
#  LocalWords:  fetchiestOptions provideXHR onLine favicon ico ttttt
-->
