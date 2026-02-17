import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { toAppError } from "../../src/lib/errors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canSubmit = !loading && email.trim().length > 0 && password.length > 0;

  const onLogin = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        const appError = toAppError(error);
        setMessage(appError.userMessage);
        return;
      }
      setMessage("로그인에 성공했어요.");
    } catch (error) {
      setMessage(toAppError(error).userMessage);
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

      {message ? <Text>{message}</Text> : null}
    </View>
  );
}
