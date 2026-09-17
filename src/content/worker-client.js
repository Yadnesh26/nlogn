export function rpc(method, params = {}) {
  return chrome.runtime.sendMessage({ __nlogn: "rpc", method, params });
}
