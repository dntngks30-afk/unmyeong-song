import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { AppError } from "./errors.ts";

export type UserRole = "viewer" | "artist" | "admin";

type AuthContext = {
  userId: string;
  role: UserRole;
  isMusicianApproved: boolean;
  supabaseAdmin: SupabaseClient;
};

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new AppError("UNKNOWN", 500, `Missing env: ${name}`);
  }
  return value;
}

export function createAdminClient(): SupabaseClient {
  const url = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function parseBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new AppError("AUTH_REQUIRED", 401, "Authorization bearer token is required");
  }
  return token;
}

export async function requireAuth(request: Request): Promise<AuthContext> {
  const supabaseAdmin = createAdminClient();
  const token = parseBearerToken(request);

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new AppError("AUTH_INVALID", 401, "Invalid JWT");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, is_musician_approved")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile?.role) {
    throw new AppError("FORBIDDEN_ROLE", 403, "Profile role is not available");
  }

  return {
    userId: data.user.id,
    role: profile.role as UserRole,
    isMusicianApproved: Boolean(profile?.is_musician_approved ?? false),
    supabaseAdmin,
  };
}

export async function getOptionalAuth(
  request: Request,
): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  try {
    return await requireAuth(request);
  } catch {
    return null;
  }
}

export function requireRole(
  role: UserRole,
  allowed: UserRole[],
): void {
  if (!allowed.includes(role)) {
    throw new AppError("FORBIDDEN_ROLE", 403, "Role is not allowed");
  }
}

