import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { toAppError } from "../../src/lib/errors";

type LoginErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "NETWORK"
  | "SESSION_MISSING"
  | "UNKNOWN";

function mapLoginError(error: unknown): { code: LoginErrorCode; message: string } {
  const appError = toAppError(error);
  const raw = `${appError.message}\n${JSON.stringify(appError.details ?? {})}`.toLowerCase();
  if (raw.includes("invalid login credentials") || raw.includes("invalid_credentials")) {
    return { code: "AUTH_INVALID_CREDENTIALS", message: "이메일 또는 비밀번호가 올바르지 않아요." };
  }
  if (raw.includes("email not confirmed")) {
    return { code: "EMAIL_NOT_CONFIRMED", message: "이메일 인증 후 로그인해 주세요." };
  }
  if (raw.includes("network") || raw.includes("fetch")) {
    return { code: "NETWORK", message: "네트워크 연결을 확인해 주세요." };
  }
  if (raw.includes("session")) {
    return { code: "SESSION_MISSING", message: "세션을 생성하지 못했어요. 다시 로그인해 주세요." };
  }
  return { code: "UNKNOWN", message: appError.userMessage };
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorCode, setErrorCode] = useState<LoginErrorCode | null>(null);

  const canSubmit = !loading && email.trim().length > 0 && password.length > 0;

  const onLogin = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setMessage("");
    setErrorCode(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        console.error("[auth][login] signIn error", error);
        const mapped = mapLoginError(error);
        setErrorCode(mapped.code);
        setMessage(mapped.message);
        return;
      }
      if (!data.session) {
        const mapped = mapLoginError(new Error("SESSION_MISSING"));
        setErrorCode(mapped.code);
        setMessage(mapped.message);
        return;
      }
      setMessage("로그인에 성공했어요. 홈으로 이동해요.");
      router.replace("/(tabs)/home");
    } catch (error) {
      console.error("[auth][login] unexpected", error);
      const mapped = mapLoginError(error);
      setErrorCode(mapped.code);
      setMessage(mapped.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>로그인</Text>
      <TextInput
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
      />
      <TextInput
        placeholder="비밀번호"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
      />

      <Pressable
        onPress={onLogin}
        disabled={!canSubmit}
        style={{
          backgroundColor: canSubmit ? "#111827" : "#9ca3af",
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>{loading ? "로그인 중..." : "로그인"}</Text>
      </Pressable>

      <Link href="/(auth)/signup" asChild>
        <Pressable style={{ paddingVertical: 10 }}>
          <Text style={{ color: "#2563eb" }}>회원가입으로 이동</Text>
        </Pressable>
      </Link>

      {errorCode ? <Text style={{ color: "#b91c1c" }}>에러 코드: {errorCode}</Text> : null}
      {message ? <Text>{message}</Text> : null}
    </View>
  );
}
