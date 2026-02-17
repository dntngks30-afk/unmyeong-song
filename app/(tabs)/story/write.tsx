import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Card } from "../../../src/components/ui/Card";
import { PrimaryButton } from "../../../src/components/ui/PrimaryButton";
import { Screen } from "../../../src/components/ui/Screen";
import { submitStory } from "../../../src/services/storySubmit";

const MIN_TITLE = 2;
const TITLE_MAX = 60;
const MIN_CONTENT = 200;
const BODY_MAX = 2000;
const EMAIL_MAX = 254;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_LIMITED_MSG = "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
const CONTENT_BLOCKED_MSG = "개인정보가 포함되어 제출할 수 없어요.";

function isValidEmail(s: string): boolean {
  if (!s.trim()) return true;
  return EMAIL_REGEX.test(s.trim());
}

function generateClientRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export default function StoryWriteScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [email, setEmail] = useState("");
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const contentLen = content.length;
  const setContentSafe = useCallback((v: string) => {
    setContent(v.length > BODY_MAX ? v.slice(0, BODY_MAX) : v);
  }, []);
  const setTitleSafe = useCallback((v: string) => {
    setTitle(v.length > TITLE_MAX ? v.slice(0, TITLE_MAX) : v);
  }, []);
  const setEmailSafe = useCallback((v: string) => {
    setEmail(v.length > EMAIL_MAX ? v.slice(0, EMAIL_MAX) : v);
  }, []);

  const isValid = useMemo(() => {
    return (
      title.trim().length >= MIN_TITLE &&
      title.length <= TITLE_MAX &&
      contentLen >= MIN_CONTENT &&
      contentLen <= BODY_MAX &&
      email.length <= EMAIL_MAX &&
      agree1 &&
      agree2 &&
      isValidEmail(email)
    );
  }, [title, contentLen, email, agree1, agree2]);

  const resetForm = useCallback(() => {
    setTitle("");
    setContent("");
    setEmail("");
    setAgree1(false);
    setAgree2(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await submitStory({
      title: title.trim(),
      body: content.trim(),
      clientRequestId: generateClientRequestId(),
    });

    setIsSubmitting(false);

    if (result.ok) {
      resetForm();
      setErrorMessage(null);
      router.replace(`/(tabs)/story/${result.storyId}?fromSubmit=1`);
      return;
    }

    const err = result.error;
    if (err.code === "RATE_LIMITED") {
      setErrorMessage(RATE_LIMITED_MSG);
      return;
    }
    if (err.code === "CONTENT_BLOCKED") {
      setErrorMessage(CONTENT_BLOCKED_MSG);
      return;
    }
    setErrorMessage(err.userMessage);
  }, [isValid, isSubmitting, title, content, resetForm, router]);

  return (
    <Screen title="사연 쓰기" onBackPress={() => router.back()}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 16 }}>
            <Card>
              <TextInput
                placeholder="제목을 입력하세요"
                placeholderTextColor="#94a3b8"
                value={title}
                onChangeText={setTitleSafe}
                maxLength={TITLE_MAX}
                style={{ fontSize: 15, color: "#1f2937", padding: 0 }}
              />
              <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 6, alignSelf: "flex-end" }}>
                {title.length}/{TITLE_MAX}
              </Text>
            </Card>

            <Card>
              <TextInput
                placeholder="당신의 사연을 들려주세요…"
                placeholderTextColor="#94a3b8"
                value={content}
                onChangeText={setContentSafe}
                multiline
                numberOfLines={6}
                style={{ fontSize: 15, color: "#1f2937", padding: 0, minHeight: 120, textAlignVertical: "top" }}
              />
              <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 8, alignSelf: "flex-end" }}>
                {contentLen}/{BODY_MAX}
              </Text>
            </Card>

            <Card>
              <TextInput
                placeholder="이메일(선택)"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmailSafe}
                maxLength={EMAIL_MAX}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ fontSize: 15, color: "#1f2937", padding: 0 }}
              />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <Text style={{ color: "#94a3b8", fontSize: 12 }}>채택/결선 안내용(공개되지 않음)</Text>
                <Text style={{ color: "#94a3b8", fontSize: 12 }}>{email.length}/{EMAIL_MAX}</Text>
              </View>
            </Card>

            <Card>
              <Pressable onPress={() => setAgree1((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: agree1 ? "#2563eb" : "#94a3b8",
                    backgroundColor: agree1 ? "#2563eb" : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {agree1 ? <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text> : null}
                </View>
                <Text style={{ color: "#374151", fontSize: 14 }}>익명 공개에 동의합니다(필수)</Text>
              </Pressable>
              <Pressable onPress={() => setAgree2((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: agree2 ? "#2563eb" : "#94a3b8",
                    backgroundColor: agree2 ? "#2563eb" : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {agree2 ? <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text> : null}
                </View>
                <Text style={{ color: "#374151", fontSize: 14 }}>개인정보/민감정보(PII) 포함 금지에 동의합니다(필수)</Text>
              </Pressable>
            </Card>

            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 18 }}>
              댓글은 없으며, 사연은 익명으로 공개됩니다.
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 18 }}>
              전화번호/주소/실명 등 개인정보는 입력하지 마세요.
            </Text>

            {!isValid && (title.length > 0 || content.length > 0) && (
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                제목 2~60자, 내용 200~2000자, 이메일 254자 이하, 필수 동의 2개 확인
              </Text>
            )}

            {isSubmitting ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color="#94a3b8" />
                <Text style={{ color: "#94a3b8", fontSize: 13 }}>제출 중...</Text>
              </View>
            ) : null}

            {errorMessage ? (
              <Text style={{ color: "#f87171", fontSize: 13 }}>{errorMessage}</Text>
            ) : null}
          </View>
        </ScrollView>

        <PrimaryButton
          label={isSubmitting ? "제출 중..." : "제출"}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
        />
      </KeyboardAvoidingView>
    </Screen>
  );
}
