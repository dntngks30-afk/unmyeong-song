import { createAdminClient, getOptionalAuth } from "../_shared/auth.ts";
import {
  AppError,
  jsonResponse,
  makeCorrelationId,
  toAppErrorPayload,
} from "../_shared/errors.ts";

type RequestBody = {
  finalTrackId?: string;
};

Deno.serve(async (request) => {
  const correlationId = makeCorrelationId();

  try {
    if (request.method !== "POST") {
      throw new AppError("NOT_FOUND", 404, "Not found");
    }

    const auth = await getOptionalAuth(request);
    const adminClient = auth?.supabaseAdmin ?? createAdminClient();

    const body = (await request.json()) as RequestBody;
    const finalTrackId = body.finalTrackId?.trim();
    if (!finalTrackId) {
      throw new AppError("NOT_FOUND", 404, "finalTrackId is required");
    }

    const { data: track, error: trackError } = await adminClient
      .from("final_tracks")
      .select("id, status, songs!inner(audio_path, status)")
      .eq("id", finalTrackId)
      .single();

    if (trackError || !track) {
      throw new AppError("NOT_FOUND", 404, "Final track not found");
    }

    const song = Array.isArray(track.songs) ? track.songs[0] : track.songs;
    if (!song?.audio_path) {
      throw new AppError("NOT_FOUND", 404, "Audio object path not found");
    }

    // Current contract: playback is allowed for public(final top10) track only.
    if (track.status !== "top10") {
      throw new AppError("FORBIDDEN_ROLE", 403, "Track is not publicly playable");
    }

    const { data: signed, error: signedError } = await adminClient.storage
      .from("song-audio")
      .createSignedUrl(song.audio_path, 60);

    if (signedError || !signed?.signedUrl) {
      throw new AppError("UNKNOWN", 500, "Failed to create play signed url");
    }

    return jsonResponse({
      correlationId,
      signedUrl: signed.signedUrl,
      expiresIn: 60,
    });
  } catch (error) {
    const { status, payload } = toAppErrorPayload(error, correlationId);
    return jsonResponse(payload as unknown as Record<string, unknown>, status);
  }
});

