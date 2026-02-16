// contracts: docs/contracts/api.md (사연 작성 submit_story_rate_limited), docs/contracts/ux-flows.md (사연 작성 플로우/PII 금지)
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { createStory } from "../../features/story/api/mutations";

const RATE_LIMITED_MESSAGE = "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
const CONTENT_BLOCKED_MESSAGE = "개인정보가 포함되어 제출할 수 없어요.";
const AUTH_REQUIRED_MESSAGE = "로그인이 필요해요";
const UNKNOWN_MESSAGE = "잠시 후 다시 시도해 주세요.";

function generateUuidV4(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function containsPii(text: string): boolean {
  const patterns = [
    /\b\d{2,3}-\d{3,4}-\d{4}\b/, // phone
    /\b\d{2,3}\s?\d{3,4}\s?\d{4}\b/, // phone(no hyphen)
    /@/, // email clue
    /계좌|은행|주소|주민등록|카드번호/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

export default function StoryWriteScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [lastClientRequestId, setLastClientRequestId] = useState<string | null>(null);

  const piiDetected = useMemo(() => containsPii(`${title}\n${content}`), [title, content]);
  const canRetry = useMemo(() => Boolean(lastClientRequestId && !isSubmitting), [lastClientRequestId, isSubmitting]);

  const submitWithRequestId = async (requestId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatusText("");

    const result = await createStory({ title, content, clientRequestId: requestId });
    setIsSubmitting(false);

    if (!result.ok) {
      if (result.error.code === "AUTH_REQUIRED") {
        setStatusText(AUTH_REQUIRED_MESSAGE);
        Alert.alert("안내", AUTH_REQUIRED_MESSAGE);
        return;
      }
      if (result.error.code === "RATE_LIMITED") {
        setStatusText(RATE_LIMITED_MESSAGE);
        Alert.alert("안내", RATE_LIMITED_MESSAGE);
        return;
      }
      if (result.error.code === "CONTENT_BLOCKED") {
        setStatusText(CONTENT_BLOCKED_MESSAGE);
        Alert.alert("안내", CONTENT_BLOCKED_MESSAGE);
        return;
      }
      setStatusText(UNKNOWN_MESSAGE);
      Alert.alert("오류", UNKNOWN_MESSAGE);
      return;
    }

    setLastClientRequestId(null);
    setStatusText("사연이 등록되었어요.");
    router.replace(`/story/${result.storyId}`);
  };

  const handleSubmit = async () => {
    const requestId = generateUuidV4();
    setLastClientRequestId(requestId);
    await submitWithRequestId(requestId);
  };

  const handleRetry = async () => {
    if (!lastClientRequestId) return;
    await submitWithRequestId(lastClientRequestId);
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>사연 작성</Text>
      <Text style={{ color: "#b45309" }}>
        개인정보(연락처/계좌/주소 등) 입력 금지. 위반 시 제출이 차단될 수 있어요.
      </Text>
      {piiDetected ? (
        <Text style={{ color: "#b91c1c" }}>
          입력 내용에 개인정보로 보이는 패턴이 있어요. 제출 전 다시 확인해 주세요.
        </Text>
      ) : null}
      <TextInput
        placeholder="제목"
        value={title}
        onChangeText={setTitle}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10 }}
      />
      <TextInput
        placeholder="사연을 입력해 주세요"
        value={content}
        onChangeText={setContent}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10, minHeight: 160 }}
      />
      <Button title={isSubmitting ? "제출 중..." : "사연 제출"} onPress={handleSubmit} disabled={isSubmitting} />
      <Button title="같은 요청으로 재시도" onPress={handleRetry} disabled={!canRetry} />
      {statusText ? <Text>{statusText}</Text> : null}
    </View>
  );
}
