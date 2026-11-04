const encoder = new TextEncoder();
const MAX_BODY_BYTES = 2048;
const RPC_TIMEOUT_MS = 10_000;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function constantTimeTokenMatches(
  suppliedToken: string,
  configuredToken: string,
): Promise<boolean> {
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

function validateReading(body: unknown): {
  raw_value: number;
  weight_grams: number | null;
  weight_kg: number | null;
} | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }
  const reading: Record<string, unknown> = Object.fromEntries(Object.entries(body));
  const allowedKeys = new Set(["raw_value", "weight_grams", "weight_kg"]);
  if (Object.keys(reading).some((key) => !allowedKeys.has(key))) {
    return null;
  }

  const raw = reading.raw_value;
  const grams = reading.weight_grams;
  const kilograms = reading.weight_kg;
  if (typeof raw !== "number" || !Number.isSafeInteger(raw)) {
    return null;
  }
  const isUncalibrated = grams === null && kilograms === null;
  if ((grams === null) !== (kilograms === null)) {
    return null;
  }
  if (isUncalibrated) {
    return { raw_value: raw, weight_grams: null, weight_kg: null };
  }
  if (
    typeof grams !== "number" ||
    !Number.isFinite(grams) ||
    typeof kilograms !== "number" ||
    !Number.isFinite(kilograms) ||
    Math.abs(grams / 1000 - kilograms) > 0.000001
  ) {
    return null;
  }
  return { raw_value: raw, weight_grams: grams, weight_kg: kilograms };
}

function isInsertedReading(
  value: unknown,
): value is { id: number | string; test_record_id: string; recorded_at: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const row = Object.fromEntries(Object.entries(value));
  return (
    (typeof row.id === "number" && Number.isSafeInteger(row.id)) ||
    (typeof row.id === "string" && /^\d+$/.test(row.id))
  ) &&
    typeof row.test_record_id === "string" &&
    typeof row.recorded_at === "string";
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, code: "method_not_allowed" }, 405);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ ok: false, code: "unsupported_media_type" }, 415);
  }

  const configuredToken = Deno.env.get("HX711_DEVICE_TOKEN") ?? "";
  const suppliedToken = request.headers.get("x-kusog-device-token") ?? "";
  if (encoder.encode(configuredToken).length < 32) {
    console.error("HX711_DEVICE_TOKEN is missing or shorter than 32 bytes.");
    return jsonResponse({ ok: false, code: "server_not_configured" }, 500);
  }
  if (
    !suppliedToken ||
    !(await constantTimeTokenMatches(suppliedToken, configuredToken))
  ) {
    return jsonResponse({ ok: false, code: "unauthorized" }, 401);
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

  const reading = validateReading(body);
  if (!reading) {
    return jsonResponse({ ok: false, code: "invalid_reading" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase server credentials are unavailable to the HX711 function.");
    return jsonResponse({ ok: false, code: "server_not_configured" }, 500);
  }

  let rpcResponse: Response;
  try {
    rpcResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/kusog_insert_load_cell_reading_for_active_test`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          p_raw_value: reading.raw_value,
          p_weight_grams: reading.weight_grams,
          p_weight_kg: reading.weight_kg,
        }),
        signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
      },
    );
  } catch (error) {
    console.error("HX711 active-test RPC request failed:", error);
    return jsonResponse({ ok: false, code: "database_unavailable" }, 502);
  }

  if (!rpcResponse.ok) {
    const detail = (await rpcResponse.text()).slice(0, 500);
    console.error("HX711 active-test RPC returned an error:", rpcResponse.status, detail);
    return jsonResponse({ ok: false, code: "database_rejected_reading" }, 502);
  }

  let inserted: unknown;
  try {
    inserted = await rpcResponse.json();
  } catch {
    console.error("HX711 active-test RPC returned invalid JSON.");
    return jsonResponse({ ok: false, code: "invalid_database_response" }, 502);
  }

  if (Array.isArray(inserted) && inserted.length === 0) {
    return jsonResponse({
      ok: false,
      code: "no_active_test",
      message: "No test is RUNNING; the reading was not inserted.",
    }, 409);
  }
  if (
    !Array.isArray(inserted) ||
    inserted.length !== 1 ||
    !isInsertedReading(inserted[0])
  ) {
    console.error("HX711 active-test RPC returned an unexpected result.");
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
