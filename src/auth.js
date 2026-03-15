import { Client, Hash, Mode, Srp, util } from "@foxt/js-srp";
import { toBase64, fromBase64 } from "./utils.js";

const AUTH_BASE = "https://idmsa.apple.com/appleauth/auth";
const SETUP_BASE = "https://setup.icloud.com/setup/ws/1";

const AUTH_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "X-Apple-OAuth-Client-Id":
    "d39ba9916b7251055b22c7f910e2ea796ee65e98b2ddecea8f5dde8d9d1a815d",
  "X-Apple-OAuth-Client-Type": "firstPartyAuth",
  "X-Apple-OAuth-Redirect-URI": "https://www.icloud.com",
  "X-Apple-OAuth-Require-Grant-Code": "true",
  "X-Apple-OAuth-Response-Mode": "web_message",
  "X-Apple-OAuth-Response-Type": "code",
  "X-Apple-OAuth-State": "",
  "X-Apple-Widget-Key":
    "d39ba9916b7251055b22c7f910e2ea796ee65e98b2ddecea8f5dde8d9d1a815d",
  Origin: "https://www.icloud.com",
  Referer: "https://www.icloud.com/",
};

class GSASRPAuthenticator {
  constructor(username) {
    this.username = username;
    this.srpClient = undefined;
    this.srp = new Srp(Mode.GSA, Hash.SHA256, 2048);
  }

  async derivePassword(protocol, password, salt, iterations) {
    const stringToU8 = (str) => new TextEncoder().encode(str);
    let passHash = new Uint8Array(
      await util.hash(this.srp.h, stringToU8(password)),
    );

    if (protocol === "s2k_fo") {
      passHash = stringToU8(util.toHex(passHash));
    }

    const imported = await crypto.subtle.importKey(
      "raw",
      passHash,
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );

    const derived = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: { name: "SHA-256" }, iterations, salt },
      imported,
      256,
    );

    return new Uint8Array(derived);
  }

  async getInit() {
    const stringToU8 = (str) => new TextEncoder().encode(str);

    this.srpClient = await this.srp.newClient(
      stringToU8(this.username),
      new Uint8Array(),
    );

    const a = toBase64(util.bytesFromBigint(this.srpClient.A));

    return {
      a,
      protocols: ["s2k", "s2k_fo"],
      accountName: this.username,
    };
  }

  async getComplete(password, serverData) {
    if (!this.srpClient) throw new Error("Not initialized");
    if (serverData.protocol !== "s2k" && serverData.protocol !== "s2k_fo") {
      throw new Error("Unsupported protocol: " + serverData.protocol);
    }

    const salt = fromBase64(serverData.salt);
    const serverPub = fromBase64(serverData.b);
    const iterations = serverData.iteration;

    const derived = await this.derivePassword(
      serverData.protocol,
      password,
      salt,
      iterations,
    );

    this.srpClient.p = derived;
    await this.srpClient.generate(salt, serverPub);

    const m1 = toBase64(this.srpClient._M);
    const M2 = await this.srpClient.generateM2();
    const m2 = toBase64(M2);

    return {
      accountName: this.username,
      m1,
      m2,
      c: serverData.c,
    };
  }
}

async function authRequest(url, body, extraHeaders = {}) {
  const res = await fetch(AUTH_BASE + url, {
    method: "POST",
    headers: { ...AUTH_HEADERS, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include"
  });

  const scnt = res.headers.get("scnt") || "";
  const sessionId = res.headers.get("X-Apple-ID-Session-Id") || "";
  const sessionToken = res.headers.get("X-Apple-Session-Token") || "";

  let data = null;
  try {
    data = await res.json();
  } catch {}

  return { status: res.status, data, scnt, sessionId, sessionToken };
}

export async function loginStep1(appleId, password) {
  const authenticator = new GSASRPAuthenticator(appleId);
  const initPayload = await authenticator.getInit();

  const initRes = await authRequest("/signin/init", initPayload);
  if (!initRes.data || !initRes.data.salt) {
    const code = initRes.data?.serviceErrors?.[0]?.code || "UNKNOWN";
    throw new Error("SRP init failed (code: " + code + ")");
  }

  const completePayload = await authenticator.getComplete(
    password,
    initRes.data,
  );
  
  const completeRes = await authRequest(
    "/signin/complete?isRememberMeEnabled=true",
    { ...completePayload, rememberMe: true, trustTokens: [] },
  );

  let sessionHeaders = {
    scnt: completeRes.scnt || initRes.scnt,
    "X-Apple-ID-Session-Id": completeRes.sessionId || initRes.sessionId,
  };

  if (completeRes.status === 409 || completeRes.status === 403) {
    // Need 2FA
    await fetch(AUTH_BASE + "/verify/trusteddevice", {
      method: "GET",
      headers: { ...AUTH_HEADERS, ...sessionHeaders },
      credentials: "include"
    });
    return {
      requires2FA: true,
      sessionHeaders
    };
  } else if (completeRes.status !== 200) {
    const msg = completeRes.data?.serviceErrors?.[0]?.message || "Unknown error";
    throw new Error("Authentication failed: " + msg);
  }
  
  // Directly successful without 2FA
  return await finishLogin(completeRes.sessionToken);
}

export async function loginStep2(code, sessionHeaders) {
  const verifyRes = await fetch(
    AUTH_BASE + "/verify/trusteddevice/securitycode",
    {
      method: "POST",
      headers: {
        ...AUTH_HEADERS,
        ...sessionHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ securityCode: { code: code.trim() } }),
      credentials: "include"
    },
  );

  if (verifyRes.status !== 204 && verifyRes.status !== 200) {
    throw new Error("2FA verification failed (HTTP " + verifyRes.status + ")");
  }

  const newScnt = verifyRes.headers.get("scnt");
  const newSessionId = verifyRes.headers.get("X-Apple-ID-Session-Id");
  if (newScnt) sessionHeaders.scnt = newScnt;
  if (newSessionId) sessionHeaders["X-Apple-ID-Session-Id"] = newSessionId;

  const trustRes = await authRequest("/2sv/trust", null, sessionHeaders);
  
  return await finishLogin(trustRes.sessionToken);
}

async function finishLogin(dsWebAuthToken) {
  const accountLoginRes = await fetch(SETUP_BASE + "/accountLogin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://www.icloud.com",
      Referer: "https://www.icloud.com/",
    },
    body: JSON.stringify({
      dsWebAuthToken: dsWebAuthToken || "",
      extended_login: true,
    }),
    credentials: "include"
  });

  const accountData = await accountLoginRes.json();
  if (!accountData.dsInfo) {
    const msg = accountData.error || "Invalid session";
    throw new Error("Account login failed: " + msg);
  }

  const dsid = String(accountData.dsInfo.dsid);
  const webservices = accountData.webservices || {};
  const mailDomainUrl = webservices.premiummailsettings?.url || "";

  const session = {
    dsid,
    baseUrl: mailDomainUrl.replace("/v1", ""),
    webservices,
    timestamp: Date.now(),
  };

  return { requires2FA: false, session };
}
