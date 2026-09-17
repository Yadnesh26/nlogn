// Captures submission verdicts by patching fetch/XHR. LeetCode has used both
// over time, so both are patched. Every branch is wrapped in try/catch:
// if this throws, it must never prevent the user's request from completing.
//
// Two URL shapes matter: the polled .../v2/check/ endpoint (used while
// judging is in progress — confirmed live; the v2/ segment isn't optional
// the way an earlier version of this assumed), and the initial
// .../submit/ POST itself, which can return a Compile Error synchronously
// without ever entering the polling flow.
const VERDICT_RE = /\/submissions\/detail\/\d+\/(?:v\d+\/)?check\/|\/problems\/[^/]+\/submit\/?($|\?)/;

function emitVerdict(data) {
  try {
    // status_msg is only populated once a result actually exists — absent
    // on in-flight PENDING/RUNNING_TESTS polls and on a plain submit-POST
    // ack ({submission_id}), present once judging finishes (confirmed live:
    // status_msg, total_correct, total_testcases, last_testcase,
    // expected_output, code_output, status_runtime, status_memory,
    // runtime_percentile all present on the final /check/ response).
    if (data?.status_msg) {
      window.postMessage({ __nlogn: "verdict", data }, window.origin);
    }
  } catch {}
}

function patchFetch() {
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url ?? "";
      if (VERDICT_RE.test(url)) {
        res
          .clone()
          .json()
          .then(emitVerdict)
          .catch(() => {});
      }
    } catch {}
    return res;
  };
}

function patchXHR() {
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      this.__nlognUrl = url;
    } catch {}
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    try {
      const url = this.__nlognUrl ?? "";
      if (VERDICT_RE.test(url)) {
        this.addEventListener("load", () => {
          try {
            emitVerdict(JSON.parse(this.responseText));
          } catch {}
        });
      }
    } catch {}
    return origSend.apply(this, args);
  };
}

export function initInterceptor() {
  try {
    patchFetch();
  } catch {}
  try {
    patchXHR();
  } catch {}
}
