import { requireAuth, requireRole } from "../_shared/auth.ts";
import {
  AppError,
  jsonResponse,
  makeCorrelationId,
  toAppErrorPayload,
} from "../_shared/errors.ts";

type UploadKind = "audio" | "cover";

type RequestBody = {
  songId?: string;
  kind?: UploadKind;
  filename?: string;
  mimeType?: string;
};

function extensionFromInput(
  kind: UploadKind,
  filename?: string,
  mimeType?: string,
): string {
  const mimeMap: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const fromFilename = filename?.split(".").pop()?.toLowerCase();
  const fromMime = mimeType ? mimeMap[mimeType.toLowerCase()] : undefined;
  const ext = fromFilename ?? fromMime;

  if (!ext) {
    throw new AppError("STORAGE_PATH_INVALID", 400, "File extension is required");
  }

  const allowed =
    kind === "audio"
      ? new Set(["mp3", "m4a", "wav"])
      : new Set(["jpg", "jpeg", "png", "webp"]);

  if (!allowed.has(ext)) {
    throw new AppError("STORAGE_PATH_INVALID", 400, "File extension is not allowed", {
      kind,
      ext,
    });
  }

  return ext;
}

Deno.serve(async (request) => {
  const correlationId = makeCorrelationId();

  try {
    if (request.method !== "POST") {
      throw new AppError("NOT_FOUND", 404, "Not found");
    }

    const auth = await requireAuth(request);
    requireRole(auth.role, ["artist", "admin"]);

    const body = (await request.json()) as RequestBody;
    const songId = body.songId?.trim();
    const kind = body.kind;
    if (!songId || (kind !== "audio" && kind !== "cover")) {
      throw new AppError("STORAGE_PATH_INVALID", 400, "Invalid upload session request", {
        expected: { songId: "uuid", kind: "audio|cover" },
      });
    }

    const { data: song, error: songError } = await auth.supabaseAdmin
      .from("songs")
      .select("id, artist_id")
      .eq("id", songId)
      .single();

    if (songError || !song) {
      throw new AppError("NOT_FOUND", 404, "Song not found");
    }

    if (auth.role !== "admin" && song.artist_id !== auth.userId) {
      throw new AppError("FORBIDDEN_ROLE", 403, "Song ownership mismatch");
    }

    const ext = extensionFromInput(kind, body.filename, body.mimeType);
    const ownerId = song.artist_id;
    const bucket = kind === "audio" ? "song-audio" : "song-cover";
    const objectPath = `artist/${ownerId}/song/${songId}/${kind}.${ext}`;

    const { data: signedUpload, error: signedError } = await auth.supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath);

    if (signedError || !signedUpload?.signedUrl) {
      throw new AppError("UNKNOWN", 500, "Failed to create signed upload url");
    }

    return jsonResponse({
      correlationId,
      bucket,
      objectPath,
      signedUrl: signedUpload.signedUrl,
      token: signedUpload.token,
      expiresIn: 300,
    });
  } catch (error) {
    const { status, payload } = toAppErrorPayload(error, correlationId);
    return jsonResponse(payload as unknown as Record<string, unknown>, status);
  }
});

