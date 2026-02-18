import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStory } from "../../../features/story/api/mutations";
import { supabase } from "../../../src/lib/supabase";
import { Card } from "../../../src/components/ui/Card";
import { PrimaryButton } from "../../../src/components/ui/PrimaryButton";
import { Screen } from "../../../src/components/ui/Screen";

const FOOTER_HEIGHT = 64;
const SUBMIT_SUCCESS_MSG = "제출이 완료 되었습니다. 승인 후 게시판에 게재됩니다.";

const MIN_TITLE = 2;
const TITLE_MAX = 60;
const MIN_CONTENT = 10;
const BODY_MAX = 2000;

const RATE_LIMITED_MSG = "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
const CONTENT_BLOCKED_MSG = "개인정보가 포함되어 제출할 수 없어요.";
const SESSION_EXPIRED_MSG = "세션이 만료되었어요. 다시 로그인 해주세요.";
const FORBIDDEN_ROLE_MSG = "프로필 설정이 완료되지 않았을 수 있어요. 로그아웃 후 다시 로그인해 주세요.";
const SAVE_FAILED_MSG = "저장에 실패했어요. 잠시 후 다시 시도해 주세요.";

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
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;
        if (error && __DEV__) console.warn("[story/write] getSession error:", error);
        setAccessToken(data.session?.access_token ?? undefined);
        setSessionUserId(data.session?.user?.id ?? null);
      } catch (e) {
        if (__DEV__) console.warn("[story/write] getSession exception:", e);
      } finally {
        if (alive) setIsSessionLoading(false);
      }
    };
    void sync();
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (!alive) return;
      setAccessToken(session?.access_token ?? undefined);
      setSessionUserId(session?.user?.id ?? null);
      setIsSessionLoading(false);
    });
    return () => {
      alive = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const titleTrim = title.trim();
  const contentTrim = content.trim();
  const titleLen = titleTrim.length;
  const contentLen = contentTrim.length;

  const titleOk = titleLen >= MIN_TITLE && title.length <= TITLE_MAX;
  const contentOk = contentLen >= MIN_CONTENT && content.length <= BODY_MAX;
  const agreeOk = agree1 && agree2;
  const sessionOk = !isSessionLoading && !!accessToken;
  const canSubmit = titleOk && contentOk && agreeOk && sessionOk && !isSubmitting;
  const hasAccessToken = Boolean(accessToken);
  const buttonDisabledProp = !canSubmit;

  const disabledReason = !titleOk
    ? "제목 부족"
    : !contentOk
      ? "내용 부족"
      : !agreeOk
        ? "약관 미동의"
        : isSessionLoading
          ? "세션 로딩"
          : !hasAccessToken
            ? "토큰 없음"
            : isSubmitting
              ? "제출 중"
              : "활성 가능";

  const resetForm = useCallback(() => {
    setTitle("");
    setContent("");
    setAgree1(false);
    setAgree2(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    console.log("[StoryWrite] handleSubmit start", {
      canSubmit,
      isSubmitting,
      isSessionLoading,
      hasAccessToken,
    });

    if (!canSubmit) {
      setErrorMessage(`${disabledReason} — 제출 조건을 확인해 주세요.`);
      return;
    }
    if (!accessToken) {
      setErrorMessage(SESSION_EXPIRED_MSG);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await createStory({
        title: title.trim(),
        content: content.trim(),
        clientRequestId: generateClientRequestId(),
        accessToken,
      });

      if (result.ok) {
        console.log("[StoryWrite] success reached, storyId=", result.storyId);
        resetForm();
        setErrorMessage(null);
        console.log("[StoryWrite] Alert.alert 호출 직전");
        Alert.alert(
          "제출 완료",
          SUBMIT_SUCCESS_MSG,
          [{ text: "확인", onPress: () => router.replace("/(tabs)/home") }],
          { cancelable: false }
        );
        console.log("[StoryWrite] Alert.alert 호출 직후");
        return;
      }

      const err = result.error;
      if (err.code === "AUTH_REQUIRED") {
        setErrorMessage(SESSION_EXPIRED_MSG);
        return;
      }
      if (err.code === "RATE_LIMITED") {
        setErrorMessage(RATE_LIMITED_MSG);
        return;
      }
      if (err.code === "CONTENT_BLOCKED") {
        setErrorMessage(CONTENT_BLOCKED_MSG);
        return;
      }
      if (err.code === "FORBIDDEN_ROLE") {
        setErrorMessage(FORBIDDEN_ROLE_MSG);
        return;
      }
      setErrorMessage(err.userMessage || SAVE_FAILED_MSG);
    } catch (e) {
      console.warn("[StoryWrite] createStory exception:", e);
      setErrorMessage(SAVE_FAILED_MSG);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    disabledReason,
    accessToken,
    title,
    content,
    resetForm,
    router,
  ]);

  const footerBottom = Math.max(insets.bottom, 12);
  const footerStyle = {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 20,
    paddingBottom: footerBottom + 10,
    backgroundColor: "#0f0f1a",
    alignItems: "center" as const,
    zIndex: 1000,
    elevation: 20,
    pointerEvents: "box-none" as const,
  };

  return (
    <Screen title="사연 쓰기" onBackPress={() => router.back()}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT + footerBottom + 24, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 16 }}>
            <Card>
              <TextInput
                placeholder="제목을 입력하세요"
                placeholderTextColor="#94a3b8"
                value={title}
                onChangeText={(v) => setTitle(v.length > TITLE_MAX ? v.slice(0, TITLE_MAX) : v)}
                maxLength={TITLE_MAX}
                style={{ fontSize: 15, color: "#1f2937", padding: 0 }}
              />
              <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 6, alignSelf: "flex-end" }}>
                {title.length}/{TITLE_MAX}
              </Text>
              <Text style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
                제목은 2자 이상 입력해주세요.
              </Text>
            </Card>

            <Card>
              <TextInput
                placeholder="당신의 사연을 들려주세요…"
                placeholderTextColor="#94a3b8"
                value={content}
                onChangeText={(v) => setContent(v.length > BODY_MAX ? v.slice(0, BODY_MAX) : v)}
                multiline
                numberOfLines={6}
                style={{ fontSize: 15, color: "#1f2937", padding: 0, minHeight: 120, textAlignVertical: "top" }}
              />
              <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 8, alignSelf: "flex-end" }}>
                {content.length}/{BODY_MAX}
              </Text>
              <Text style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>
                사연은 10자 이상 입력해주세요.
              </Text>
            </Card>

            <Card>
              <Text style={{ color: "#64748b", fontSize: 11, marginBottom: 8 }}>
                약관 2개 모두 동의해야 제출할 수 있어요.
              </Text>
              <Pressable
                onPress={() => setAgree1((v) => !v)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
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
              <Pressable
                onPress={() => setAgree2((v) => !v)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}
              >
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

            {!canSubmit && (titleLen > 0 || contentLen > 0) && (
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                제목 2~60자, 내용 10~2000자, 필수 동의 2개 확인
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

            {__DEV__ ? (
            <Card style={{ backgroundColor: "#1e1e2e", borderColor: "#333" }}>
              <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "600", marginBottom: 8 }}>
                [DebugPanel] 증거 패널
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                titleLen={titleLen} contentLen={contentLen}
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                agree1={String(agree1)} agree2={String(agree2)}
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                isSubmitting={String(isSubmitting)} isSessionLoading={String(isSessionLoading)}
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                hasAccessToken={String(hasAccessToken)} userId={sessionUserId ?? "null"}
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                MIN_TITLE={MIN_TITLE} MIN_CONTENT={MIN_CONTENT}
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                titleOk={String(titleOk)} contentOk={String(contentOk)} agreeOk={String(agreeOk)} sessionOk={String(sessionOk)}
              </Text>
              <Text style={{ color: "#94a3b8", fontSize: 10 }}>
                canSubmit={String(canSubmit)} buttonDisabledProp={String(buttonDisabledProp)}
              </Text>
              <Text style={{ color: disabledReason === "활성 가능" ? "#22c55e" : "#f59e0b", fontSize: 11, marginTop: 6 }}>
                disabledReason: {disabledReason}
              </Text>
            </Card>
            ) : null}
          </View>
        </ScrollView>

        <View style={footerStyle}>
          <PrimaryButton
            label={isSubmitting ? "제출 중..." : canSubmit ? "제출" : disabledReason}
            onPress={() => {
              console.log("[StoryWrite] submit pressed");
              handleSubmit();
            }}
            disabled={buttonDisabledProp}
            compact
            inline
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
