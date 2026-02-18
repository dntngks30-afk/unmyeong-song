import { createClient } from "npm:@supabase/supabase-js@2";
import { createAdminClient, requireRole } from "../_shared/auth.ts";
import {
  AppError,
  jsonResponse,
  makeCorrelationId,
  toAppErrorPayload,
} from "../_shared/errors.ts";

type UploadKind = "audio" | "cover";
type UploadPurpose = "song" | "application";

type RequestBody = {
  songId?: string;
  applicationId?: string;
  purpose?: UploadPurpose;
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

function diagHeaders(url: string): Record<string, string> {
  const projectRef = url?.split("https://")[1]?.split(".")[0] ?? "";
  return {
    "x-project-ref": projectRef,
    "x-auth-mode": "getUser",
  };
}

Deno.serve(async (request) => {
  const correlationId = makeCorrelationId();
  const authHeader = request.headers.get("authorization") ?? "";
  console.log("[create-upload-session] hasAuth=", !!authHeader);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const missing: string[] = [];
  if (!url?.trim()) missing.push("SUPABASE_URL");
  if (!anon?.trim()) missing.push("SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    return jsonResponse(
      {
        error: {
          code: "ENV_MISSING",
          message: `Missing env: ${missing.join(", ")}`,
          correlationId,
          missing,
        },
      },
      500,
      diagHeaders(url ?? "")
    );
  }

  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse(
      {
        error: {
          code: "AUTH_MISSING",
          message: "Authorization bearer token is required",
          correlationId,
        },
      },
      401,
      diagHeaders(url)
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonResponse(
      {
        error: {
          code: "AUTH_MISSING",
          message: "Authorization bearer token is required",
          correlationId,
        },
      },
      401,
      diagHeaders(url)
    );
  }

  try {
    const supabase = createClient(url, anon, { auth: { persistSession: false } });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.log("[create-upload-session] getUser failed", userError?.message);
      const payload = toAppErrorPayload(
        new AppError("AUTH_INVALID", 401, "Invalid JWT"),
        correlationId
      );
      return jsonResponse(
        payload.payload as unknown as Record<string, unknown>,
        payload.status,
        diagHeaders(url)
      );
    }
    console.log("[create-upload-session] user=", user.id, "hasAuth=", true);

    if (request.method !== "POST") {
      throw new AppError("NOT_FOUND", 404, "Not found");
    }

    const body = (await request.json()) as RequestBody;
    const purpose: UploadPurpose = body.purpose === "application" ? "application" : "song";
    const kind = body.kind;

    const supabaseAdmin = createAdminClient();
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, is_musician_approved")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.role) {
      throw new AppError("FORBIDDEN_ROLE", 403, "Profile role is not available");
    }
    const auth = {
      userId: user.id,
      role: profile.role as "viewer" | "artist" | "admin",
      isMusicianApproved: Boolean(profile?.is_musician_approved ?? false),
      supabaseAdmin,
    };

    console.log(
      "[create-upload-session] mode=",
      purpose,
      "uid=",
      auth.userId?.slice(0, 8),
      "purpose=",
      body.purpose,
      "applicationId=",
      body.applicationId ? "set" : "unset",
      "songId=",
      body.songId ? "set" : "unset",
      "kind=",
      kind
    );

    if (kind !== "audio" && kind !== "cover") {
      throw new AppError("STORAGE_PATH_INVALID", 400, "Invalid kind", {
        expected: "audio|cover",
      });
    }

    if (purpose === "application") {
      if (auth.role !== "admin" && auth.isMusicianApproved) {
        throw new AppError("FORBIDDEN_ROLE", 403, "Application sample upload is only for approval pending");
      }
      const applicationId = body.applicationId?.trim();
      if (!applicationId || !/^[0-9a-f-]{36}$/i.test(applicationId)) {
        throw new AppError("STORAGE_PATH_INVALID", 400, "Invalid applicationId for purpose=application");
      }
      const { data: app } = await auth.supabaseAdmin
        .from("musician_applications")
        .select("id, user_id, status")
        .eq("id", applicationId)
        .single();
      if (!app || app.status !== "pending") {
        throw new AppError("NOT_FOUND", 404, "Pending application not found");
      }
      if (auth.role !== "admin" && app.user_id !== auth.userId) {
        throw new AppError("FORBIDDEN_ROLE", 403, "Application ownership mismatch");
      }
      if (kind !== "audio") {
        throw new AppError("STORAGE_PATH_INVALID", 400, "Application sample must be audio");
      }
      const ext = extensionFromInput(kind, body.filename, body.mimeType);
      if (ext !== "mp3") {
        throw new AppError("STORAGE_PATH_INVALID", 400, "Application sample must be mp3");
      }
      const bucket = "song-audio";
      const objectPath = `artist/${auth.userId}/application/${applicationId}/sample.${ext}`;
      console.log("[create-upload-session] mode=application path=", objectPath);

      const { data: signedUpload, error: signedError } = await auth.supabaseAdmin.storage
        .from(bucket)
        .createSignedUploadUrl(objectPath);

      if (signedError || !signedUpload?.signedUrl) {
        throw new AppError("UNKNOWN", 500, "Failed to create signed upload url");
      }

      return jsonResponse(
        {
          correlationId,
          bucket,
          objectPath,
          signedUrl: signedUpload.signedUrl,
          token: signedUpload.token,
          expiresIn: 300,
        },
        200,
        diagHeaders(url)
      );
    }

    requireRole(auth.role, ["artist", "admin"]);
    if (auth.role !== "admin" && !auth.isMusicianApproved) {
      throw new AppError("FORBIDDEN_ROLE", 403, "Musician approval required for upload");
    }

    const songId = body.songId?.trim();
    if (!songId) {
      throw new AppError("STORAGE_PATH_INVALID", 400, "songId required for purpose=song");
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
    console.log("[create-upload-session] mode=song path=", objectPath);

    const { data: signedUpload, error: signedError } = await auth.supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath);

    if (signedError || !signedUpload?.signedUrl) {
      throw new AppError("UNKNOWN", 500, "Failed to create signed upload url");
    }

    return jsonResponse(
      {
        correlationId,
        bucket,
        objectPath,
        signedUrl: signedUpload.signedUrl,
        token: signedUpload.token,
        expiresIn: 300,
      },
      200,
      diagHeaders(Deno.env.get("SUPABASE_URL") ?? "")
    );
  } catch (error) {
    const { status, payload } = toAppErrorPayload(error, correlationId);
    return jsonResponse(
      payload as unknown as Record<string, unknown>,
      status,
      diagHeaders(Deno.env.get("SUPABASE_URL") ?? "")
    );
  }
});

