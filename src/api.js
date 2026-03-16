import { getQueryParams, LANG_CODE } from "./config.js";

function buildUrl(session, endpoint) {
  const base = session.baseUrl || `https://p188-maildomainws.icloud.com`;
  return `${base}${endpoint}?${getQueryParams()}`;
}

async function request(session, endpoint, method, body = null) {
  const url = buildUrl(session, endpoint);

  // In extensions, we just use credentials: 'include' to pass cookies transparently
  const options = { 
    method, 
    credentials: "include",
    headers: {
      "Accept": "*/*",
      "Content-Type": "text/plain",
      "X-Apple-Dsid": session.dsid,
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  let data;
  try {
     data = await res.json();
  } catch (err) {
    throw new Error(`API fetch error or invalid JSON from Apple API.`);
  }

  if (!data || !data.success) {
    const code = data?.error?.errorCode || "UNKNOWN";
    const msg = data?.error?.errorMessage || "Request failed";
    throw new Error(`API error (${code}): ${msg}`);
  }

  return data.result;
}

export async function generate(session) {
  return await request(session, "/v1/hme/generate", "POST", { langCode: LANG_CODE });
}

export async function reserve(session, hme, label, note) {
  return await request(session, "/v1/hme/reserve", "POST", { hme, label, note });
}

export async function list(session) {
  return await request(session, "/v2/hme/list", "GET");
}

export async function get(session, anonymousId) {
  return await request(session, "/v2/hme/get", "POST", { anonymousId });
}

export async function deactivate(session, anonymousId) {
  return await request(session, "/v1/hme/deactivate", "POST", { anonymousId });
}

export async function reactivate(session, anonymousId) {
  return await request(session, "/v1/hme/reactivate", "POST", { anonymousId });
}

export async function deleteEmail(session, anonymousId) {
  return await request(session, "/v1/hme/delete", "POST", { anonymousId });
}

export async function updateMetaData(session, anonymousId, label, note) {
  return await request(session, "/v1/hme/updateMetaData", "POST", {
    anonymousId,
    label,
    note,
  });
}
