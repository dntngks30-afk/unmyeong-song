import { requireAuth, requireRole } from "../_shared/auth.ts";
import {
  AppError,
  jsonResponse,
  makeCorrelationId,
  toAppErrorPayload,
} from "../_shared/errors.ts";

type RequestBody = {
  applicationId?: string;
};

const TTL_SECONDS = 60;

Deno.serve(async (request) => {
  const correlationId = makeCorrelationId();

  try {
    if (request.method !== "POST") {
      throw new AppError("NOT_FOUND", 404, "Not found");
    }

    const auth = await requireAuth(request);
    requireRole(auth.role, ["admin"]);

    const body = (await request.json()) as RequestBody;
    const applicationId = body.applicationId?.trim();
    if (!applicationId || !/^[0-9a-f-]{36}$/i.test(applicationId)) {
      throw new AppError("NOT_FOUND", 404, "applicationId is required");
    }

    const { data: app, error: appError } = await auth.supabaseAdmin
      .from("musician_applications")
      .select("id, user_id, sample_song_audio_path")
      .eq("id", applicationId)
      .single();

    if (appError || !app) {
      throw new AppError("NOT_FOUND", 404, "Application not found");
    }

    const applicantUid = app.user_id;
    const rawPath = app.sample_song_audio_path?.trim();
    if (!rawPath) {
      throw new AppError("NOT_FOUND", 404, "Sample audio not uploaded");
    }

    const path = rawPath.replace(/^\/+|\/+$/g, "");
    const expectedPath = `artist/${applicantUid}/application/${applicationId}/sample.mp3`;
    if (path !== expectedPath) {
      throw new AppError("STORAGE_PATH_INVALID", 404, "Sample path does not match expected format");
    }

    console.log("[get-application-sample-url]", { adminUid: auth.userId, applicationId, path });

    const { data: signed, error: signedError } = await auth.supabaseAdmin.storage
      .from("song-audio")
      .createSignedUrl(path, TTL_SECONDS);

    if (signedError || !signed?.signedUrl) {
      throw new AppError("UNKNOWN", 500, "Failed to create play signed url");
    }

    return jsonResponse({
      correlationId,
      signedUrl: signed.signedUrl,
      expiresIn: TTL_SECONDS,
    });
  } catch (error) {
    const { status, payload } = toAppErrorPayload(error, correlationId);
    return jsonResponse(payload as unknown as Record<string, unknown>, status);
  }
});
