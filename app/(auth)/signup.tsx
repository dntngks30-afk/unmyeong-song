import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { toAppError } from "../../src/lib/errors";

type SignupKind = "viewer" | "musician";

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signupKind, setSignupKind] = useState<SignupKind>("viewer");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canSubmit =
    !loading &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    displayName.trim().length > 0;

  const onSignup = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setMessage("");

    try {
      const result = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            requested_signup_kind: signupKind,
          },
        },
      });

      if (result.error) {
        setMessage(toAppError(result.error).userMessage);
        return;
      }

      setMessage("회원가입 요청이 완료되었어요. 이메일 인증 후 로그인해 주세요.");
    } catch (error) {
      setMessage(toAppError(error).userMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>회원가입</Text>
      <TextInput
        placeholder="닉네임"
        value={displayName}
        onChangeText={setDisplayName}
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
      />
      <TextInput
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
      />
      <TextInput
        placeholder="비밀번호(6자 이상)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={() => setSignupKind("viewer")}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: signupKind === "viewer" ? "#111827" : "#d4d4d4",
            borderRadius: 8,
            padding: 10,
            alignItems: "center",
          }}
        >
          <Text>사연자</Text>
        </Pressable>
        <Pressable
          onPress={() => setSignupKind("musician")}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: signupKind === "musician" ? "#111827" : "#d4d4d4",
            borderRadius: 8,
            padding: 10,
            alignItems: "center",
          }}
        >
          <Text>뮤지션 신청</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onSignup}
        disabled={!canSubmit}
        style={{
          backgroundColor: canSubmit ? "#111827" : "#9ca3af",
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "600" }}>{loading ? "가입 중..." : "가입하기"}</Text>
      </Pressable>

      <Link href="/(auth)/login" asChild>
        <Pressable style={{ paddingVertical: 10 }}>
          <Text style={{ color: "#2563eb" }}>로그인으로 이동</Text>
        </Pressable>
      </Link>

      {message ? <Text>{message}</Text> : null}
    </View>
  );
}
