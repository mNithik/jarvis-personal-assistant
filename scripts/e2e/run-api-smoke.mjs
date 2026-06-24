#!/usr/bin/env node
/**
 * HTTP smoke tests for local_turn_api (requires JARVIS running with gateway + local API).
 * In CI or E2E_STRICT mode, optional endpoints become required.
 */
const host = process.env.E2E_LOCAL_API_HOST ?? "127.0.0.1";
const port = process.env.E2E_LOCAL_API_PORT ?? "18789";
const token = process.env.E2E_BEARER_TOKEN ?? "";
const strict = process.env.CI === "true" || process.env.E2E_STRICT === "true";
const base = `http://${host}:${port}`;

async function request(method, path, { body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, json, text };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function reportOptionalEndpoint(name, response, successCheck, skipReason) {
  if (response.status === 200) {
    assert(successCheck(), `${name} response shape`);
    console.log(`OK: ${name}`);
    return;
  }

  if (strict) {
    console.error(`FAIL: ${name} returned ${response.status} in strict mode`);
    process.exit(1);
  }

  console.log(`SKIP: ${name} (${response.status}) - ${skipReason}`);
}

async function main() {
  console.log(`Smoke testing ${base}${strict ? " (strict mode)" : ""}`);

  const health = await request("GET", "/health", { auth: false });
  assert(health.status === 200, `/health status ${health.status}`);
  assert(health.json?.ok === true, "/health body");

  if (token) {
    const unauth = await request("GET", "/mobile/brief", { auth: false });
    assert(unauth.status === 401, `/mobile/brief without token should 401, got ${unauth.status}`);

    const unauthApprovals = await request("GET", "/mobile/approvals", { auth: false });
    assert(
      unauthApprovals.status === 401,
      `/mobile/approvals without token should 401, got ${unauthApprovals.status}`,
    );

    const unauthTurn = await request("POST", "/turn", {
      auth: false,
      body: { command: "list trigger recipes", channel: "e2e" },
    });
    assert(unauthTurn.status === 401, `/turn without token should 401, got ${unauthTurn.status}`);
  }

  const brief = await request("GET", "/mobile/brief");
  reportOptionalEndpoint(
    "GET /mobile/brief",
    brief,
    () =>
      Array.isArray(brief.json?.topThree) &&
      typeof brief.json?.pendingApprovalCount === "number",
    "enable mobileApproveEnabled",
  );

  const approvals = await request("GET", "/mobile/approvals");
  reportOptionalEndpoint(
    "GET /mobile/approvals",
    approvals,
    () => Array.isArray(approvals.json),
    "mobile approvals endpoint unavailable",
  );

  const turn = await request("POST", "/turn", {
    body: { command: "list trigger recipes", channel: "e2e" },
  });
  if (turn.status === 200) {
    assert(typeof turn.json?.correlationId === "string" && turn.json.correlationId.length > 0, "POST /turn correlationId");
    assert(Array.isArray(turn.json?.events), "POST /turn events array");
    assert(typeof turn.json?.result?.reply === "string", "POST /turn result.reply");
    assert(typeof turn.json?.result?.sessionId === "string", "POST /turn result.sessionId");
    assert(typeof turn.json?.result?.turnId === "number", "POST /turn result.turnId");
    assert(typeof turn.json?.result?.legacy === "boolean", "POST /turn result.legacy");
    console.log("OK: POST /turn");
  } else if (strict) {
    console.error(`FAIL: POST /turn returned ${turn.status} in strict mode`);
    process.exit(1);
  } else {
    console.log(`WARN: POST /turn (${turn.status}) - gateway may be disabled`);
  }

  console.log("HTTP smoke completed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
