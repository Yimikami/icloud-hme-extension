import { v4 as uuidv4 } from "uuid";

const CLIENT_BUILD_NUMBER = "2604Build17";
const CLIENT_MASTERING_NUMBER = "2604Build17";
const LANG_CODE = "en-en";

let clientId = uuidv4();

export function getQueryParams(dsid) {
  return new URLSearchParams({
    clientBuildNumber: CLIENT_BUILD_NUMBER,
    clientMasteringNumber: CLIENT_MASTERING_NUMBER,
    clientId,
    dsid,
  }).toString();
}

export function getHeaders(cookies) {
  // In the browser, the Fetch API handles Origin and Referer securely, depending on host permissions.
  // We attach the cookies explicitly if needed since we are a background script proxying to Apple.
  return {
    accept: "*/*",
    "content-type": "text/plain",
    // We do NOT set Origin or Referer for the browser fetch, as background scripts handles it or setting them triggers unsafe header warnings.
    // However, if Apple requires specific Origin/Referer, we need to use Declarative Net Request or just let the background script send them if allowed.
    // Actually, Chrome extension background scripts can send Origin and Referer.
    origin: "https://www.icloud.com",
    referer: "https://www.icloud.com/",
    // "cookie" might be a forbidden header to set manually in some fetch versions, but in extensions with host_permissions it might work? Wait, in MV3 background fetch, setting "Cookie" manually works if host_permissions are granted!
    // But setting it manually is fine.
    cookie: cookies,
  };
}

export { LANG_CODE };
