// MAIN world entry. Must run at document_start — fetch/XHR must be patched
// before LeetCode's own code captures a reference to them.
import { initMonacoBridge } from "./monaco.js";
import { initNavigationEvents } from "./navigation.js";
import { initInterceptor } from "./interceptor.js";

initInterceptor();
initMonacoBridge();
initNavigationEvents();
