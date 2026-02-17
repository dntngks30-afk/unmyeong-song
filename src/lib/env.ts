type EnvValues = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function validateAndTrim(raw: string | undefined, name: string): string {
  if (raw == null || raw.length === 0) {
    throw new Error(
      `SUPABASE_CONFIG_MISSING: ${name} is missing. `.concat(
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env and restart Expo. 공백 금지.",
      ),
    );
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(
      `SUPABASE_CONFIG_MISSING: ${name} is blank after trim. `.concat(
        "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env and restart Expo. 공백 금지.",
      ),
    );
  }

  if (trimmed !== raw) {
    throw new Error(
      `SUPABASE_CONFIG_MISSING: ${name} has leading/trailing whitespace (URL/KEY 공백 오염 의심). `.concat(
        "Remove trailing spaces from .env and restart Expo.",
      ),
    );
  }

  return trimmed;
}

export function getEnv(): EnvValues {
  const supabaseUrl = validateAndTrim(process.env.EXPO_PUBLIC_SUPABASE_URL, "EXPO_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = validateAndTrim(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );

  return { supabaseUrl, supabaseAnonKey };
}
