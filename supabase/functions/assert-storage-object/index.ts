/**
 * Verify that an object exists in storage (server-side check)
 * Uses service role - createSignedUrl fails if object does not exist
 */
import { createAdminClient } from "../_shared/auth.ts";
import { requireAuth } from "../_shared/auth.ts";
import {
  AppError,
  jsonResponse,
  makeCorrelationId,
  toAppErrorPayload,
} from "../_shared/errors.ts";

type RequestBody = {
  bucket?: string;
  path?: string;
};

Deno.serve(async (request) => {
  const correlationId = makeCorrelationId();

  try {
    if (request.method !== "POST") {
      throw new AppError("NOT_FOUND", 404, "Not found");
    }

    await requireAuth(request);

    const body = (await request.json()) as RequestBody;
    const bucket = body.bucket?.trim();
    const path = body.path?.trim();
    if (!bucket || !path) {
      throw new AppError("STORAGE_PATH_INVALID", 400, "bucket and path required");
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(path, 1);

    const exists = !error && !!data?.signedUrl;
    return jsonResponse({
      correlationId,
      exists,
    });
  } catch (error) {
    const { status, payload } = toAppErrorPayload(error, correlationId);
    return jsonResponse(payload as unknown as Record<string, unknown>, status);
  }
});
