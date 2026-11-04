const encoder = new TextEncoder();
const MAX_BODY_BYTES = 2048;
const REQUEST_TIMEOUT_MS = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function tokenMatches(suppliedToken: string, configuredToken: string): Promise<boolean> {
  const [suppliedDigest, configuredDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(suppliedToken)),
    crypto.subtle.digest("SHA-256", encoder.encode(configuredToken)),
  ]);
  const supplied = new Uint8Array(suppliedDigest);
  const configured = new Uint8Array(configuredDigest);
  let difference = 0;
  for (let index = 0; index < configured.length; index += 1) {
    difference |= supplied[index] ^ configured[index];
  }
  return difference === 0;
}

function isReading(value: unknown): value is {
  temperature_c: number;
  pressure_hpa: number;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const reading = Object.fromEntries(Object.entries(value));
  return Object.keys(reading).length === 2
    && Object.keys(reading).every((key) => ["temperature_c", "pressure_hpa"].includes(key))
    && typeof reading.temperature_c === "number"
    && Number.isFinite(reading.temperature_c)
    && reading.temperature_c >= -40
    && reading.temperature_c <= 85
    && typeof reading.pressure_hpa === "number"
    && Number.isFinite(reading.pressure_hpa)
    && reading.pressure_hpa >= 300
    && reading.pressure_hpa <= 1100;
}

function isInsertedReading(value: unknown): value is {
  id: number | string;
  test_record_id: string | null;
  recorded_at: string;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const row = Object.fromEntries(Object.entries(value));
  return Object.keys(row).length === 3
    && ["id", "test_record_id", "recorded_at"].every((key) => key in row)
    && (
    (typeof row.id === "number" && Number.isSafeInteger(row.id))
    || (typeof row.id === "string" && /^\d+$/.test(row.id))
    )
    && (row.test_record_id === null || (typeof row.test_record_id === "string" && UUID_PATTERN.test(row.test_record_id)))
    && typeof row.recorded_at === "string";
}

function credentials(): { supabaseUrl: string; serviceRoleKey: string } | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return supabaseUrl && serviceRoleKey ? { supabaseUrl, serviceRoleKey } : null;
}

async function authorizeDevice(
  request: Request,
): Promise<"authorized" | "unauthorized" | "misconfigured"> {
  const configuredToken = Deno.env.get("BMP280_DEVICE_TOKEN") ?? "";
  const suppliedToken = request.headers.get("x-kusog-device-token") ?? "";
  if (encoder.encode(configuredToken).length < 32) {
    console.error("BMP280_DEVICE_TOKEN is missing or shorter than 32 bytes.");
    return "misconfigured";
  }
  if (!suppliedToken || !(await tokenMatches(suppliedToken, configuredToken))) {
    return "unauthorized";
  }
  return "authorized";
}

async function getActiveTest(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ id: string } | null> {
  const query = new URLSearchParams({
    select: "id",
    status: "eq.RUNNING",
    limit: "2",
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/test_records?${query}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Active-test lookup returned HTTP ${response.status}.`);
  }
  const tests: unknown = await response.json();
  if (!Array.isArray(tests) || tests.length > 1) {
    throw new Error("Active-test lookup returned an unexpected number of tests.");
  }
  if (tests.length === 0) return null;
  const row = tests[0];
  if (row === null || typeof row !== "object" || typeof row.id !== "string" || !UUID_PATTERN.test(row.id)) {
    throw new Error("Active-test lookup returned an invalid test ID.");
  }
  return { id: row.id };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ ok: false, code: "method_not_allowed" }, 405);
  }
  const authorization = await authorizeDevice(request);
  if (authorization === "misconfigured") {
    return jsonResponse({ ok: false, code: "server_not_configured" }, 500);
  }
  if (authorization === "unauthorized") {
    return jsonResponse({ ok: false, code: "unauthorized" }, 401);
  }

  const serverCredentials = credentials();
  if (!serverCredentials) {
    console.error("Supabase server credentials are unavailable to the BMP280 function.");
    return jsonResponse({ ok: false, code: "server_not_configured" }, 500);
  }

  if (request.method === "GET") {
    try {
      const activeTest = await getActiveTest(
        serverCredentials.supabaseUrl,
        serverCredentials.serviceRoleKey,
      );
      return jsonResponse({
        active: activeTest !== null,
        test_record_id: activeTest?.id ?? null,
      });
    } catch (error) {
      console.error("BMP280 active-test lookup failed:", error);
      return jsonResponse({ ok: false, code: "database_unavailable" }, 502);
    }
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ ok: false, code: "unsupported_media_type" }, 415);
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, code: "payload_too_large" }, 413);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (encoder.encode(rawBody).length > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, code: "payload_too_large" }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, code: "invalid_json" }, 400);
  }

  if (!isReading(body)) {
    return jsonResponse({ ok: false, code: "invalid_reading" }, 400);
  }

  let rpcResponse: Response;
  try {
    rpcResponse = await fetch(
      `${serverCredentials.supabaseUrl}/rest/v1/rpc/kusog_insert_bmp280_reading`,
      {
        method: "POST",
        headers: {
          apikey: serverCredentials.serviceRoleKey,
          Authorization: `Bearer ${serverCredentials.serviceRoleKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          p_temperature_c: body.temperature_c,
          p_pressure_hpa: body.pressure_hpa,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  } catch (error) {
    console.error("BMP280 insertion RPC request failed:", error);
    return jsonResponse({ ok: false, code: "database_unavailable" }, 502);
  }

  if (!rpcResponse.ok) {
    const detail = (await rpcResponse.text()).slice(0, 500);
    console.error("BMP280 insertion RPC returned an error:", rpcResponse.status, detail);
    return jsonResponse({ ok: false, code: "database_rejected_reading" }, 502);
  }

  let inserted: unknown;
  try {
    inserted = await rpcResponse.json();
  } catch {
    console.error("BMP280 active-test RPC returned invalid JSON.");
    return jsonResponse({ ok: false, code: "invalid_database_response" }, 502);
  }
  if (
    !Array.isArray(inserted)
    || inserted.length !== 1
    || !isInsertedReading(inserted[0])
  ) {
    console.error("BMP280 insertion RPC returned an unexpected result.");
    return jsonResponse({ ok: false, code: "invalid_database_response" }, 502);
  }

  return jsonResponse({
    ok: true,
    reading: {
      id: inserted[0].id,
      test_record_id: inserted[0].test_record_id,
      recorded_at: inserted[0].recorded_at,
    },
  });
});
