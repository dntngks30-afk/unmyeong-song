// contracts: docs/contracts/api.md (create-upload-session, complete_song_submission, STORAGE_PATH_INVALID), docs/contracts/ux-flows.md (제출 업로드 플로우)
import { useMemo, useState } from "react";
import { Alert, Button, ScrollView, Text, TextInput, View } from "react-native";
import {
  completeSongSubmission,
  createUploadSession,
  uploadFileToSignedUrl,
} from "../../features/submission/api/mutations";
import type { LocalFileInput, SubmissionStage, UploadKind } from "../../features/submission/model/types";

const STORAGE_PATH_INVALID_MESSAGE = "업로드 경로가 올바르지 않아요. 다시 시도해 주세요.";
const AUTH_REQUIRED_MESSAGE = "로그인이 필요해요";
const FORBIDDEN_ROLE_MESSAGE = "권한이 없어요";
const UNKNOWN_MESSAGE = "잠시 후 다시 시도해 주세요";

function buildFile(uri: string, mimeType: string, fallbackName: string): LocalFileInput {
  const trimmedUri = uri.trim();
  const filename = trimmedUri.split("/").pop() || fallbackName;
  return {
    uri: trimmedUri,
    mimeType: mimeType.trim() || "application/octet-stream",
    filename,
  };
}

function stepLabel(stage: SubmissionStage): string {
  if (stage.type === "Issuing") return "세션 발급 중…";
  if (stage.type === "Uploading") return "업로드 중…";
  if (stage.type === "Submitting") return "제출 중…";
  if (stage.type === "Done") return "제출 완료";
  if (stage.type === "Error") return "오류";
  return "제출하기";
}

export default function SubmissionNewScreen() {
  const [songId, setSongId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [makingNote, setMakingNote] = useState("");

  const [audioUri, setAudioUri] = useState("");
  const [audioMime, setAudioMime] = useState("audio/mpeg");
  const [coverUri, setCoverUri] = useState("");
  const [coverMime, setCoverMime] = useState("image/jpeg");

  const [stage, setStage] = useState<SubmissionStage>({ type: "Idle" });
  const [statusText, setStatusText] = useState("");

  const isBusy = stage.type === "Issuing" || stage.type === "Uploading" || stage.type === "Submitting";
  const hasCover = useMemo(() => coverUri.trim().length > 0, [coverUri]);

  const mapAndShowError = (code: string, fallbackMessage?: string) => {
    if (code === "STORAGE_PATH_INVALID") {
      setStatusText(STORAGE_PATH_INVALID_MESSAGE);
      Alert.alert("안내", STORAGE_PATH_INVALID_MESSAGE);
      return;
    }
    if (code === "AUTH_REQUIRED") {
      setStatusText(AUTH_REQUIRED_MESSAGE);
      Alert.alert("안내", AUTH_REQUIRED_MESSAGE);
      return;
    }
    if (code === "FORBIDDEN_ROLE") {
      setStatusText(FORBIDDEN_ROLE_MESSAGE);
      Alert.alert("안내", FORBIDDEN_ROLE_MESSAGE);
      return;
    }
    setStatusText(fallbackMessage ?? UNKNOWN_MESSAGE);
    Alert.alert("오류", fallbackMessage ?? UNKNOWN_MESSAGE);
  };

  const runUpload = async (kind: UploadKind, file: LocalFileInput): Promise<string | null> => {
    setStage({ type: "Issuing", kind });
    const sessionResult = await createUploadSession({
      kind,
      songId: songId.trim(),
      accessToken: accessToken.trim() || undefined,
      file,
    });
    if (!sessionResult.ok) {
      if (sessionResult.error.correlationId) {
        console.log("[submission][issue-session]", sessionResult.error.correlationId);
      }
      setStage({
        type: "Error",
        code: sessionResult.error.code,
        message: sessionResult.error.userMessage,
      });
      mapAndShowError(sessionResult.error.code, sessionResult.error.userMessage);
      return null;
    }
    if (sessionResult.data.correlationId) {
      console.log("[submission][issue-session]", sessionResult.data.correlationId);
    }

    setStage({ type: "Uploading", kind });
    const uploadResult = await uploadFileToSignedUrl(sessionResult.data, file);
    if (!uploadResult.ok) {
      if (uploadResult.error.correlationId) {
        console.log("[submission][upload]", uploadResult.error.correlationId);
      }
      setStage({
        type: "Error",
        code: uploadResult.error.code,
        message: uploadResult.error.userMessage,
      });
      mapAndShowError(uploadResult.error.code, uploadResult.error.userMessage);
      return null;
    }

    return sessionResult.data.objectPath;
  };

  const handleSubmit = async () => {
    if (isBusy) return;
    if (!songId.trim()) {
      Alert.alert("안내", "songId를 입력해 주세요.");
      return;
    }
    if (!makingNote.trim()) {
      Alert.alert("안내", "메이킹노트를 입력해 주세요.");
      return;
    }
    if (!audioUri.trim()) {
      Alert.alert("안내", "오디오 파일을 선택해 주세요.");
      return;
    }

    setStatusText("");
    const audioFile = buildFile(audioUri, audioMime, "audio.mp3");
    const audioPath = await runUpload("audio", audioFile);
    if (!audioPath) return;

    let coverPath: string | null = null;
    if (hasCover) {
      const coverFile = buildFile(coverUri, coverMime, "cover.jpg");
      coverPath = await runUpload("cover", coverFile);
      if (!coverPath) return;
    }

    setStage({ type: "Submitting" });
    const submitResult = await completeSongSubmission({
      songId: songId.trim(),
      makingNote,
      audioPath,
      coverPath,
      accessToken: accessToken.trim() || undefined,
    });

    if (!submitResult.ok) {
      if (submitResult.error.correlationId) {
        console.log("[submission][complete]", submitResult.error.correlationId);
      }
      setStage({
        type: "Error",
        code: submitResult.error.code,
        message: submitResult.error.userMessage,
      });
      mapAndShowError(submitResult.error.code, submitResult.error.userMessage);
      return;
    }

    setStage({ type: "Done", songId: submitResult.songId });
    setStatusText("제출이 완료되었어요.");
    Alert.alert("완료", "제출이 완료되었어요.");
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>곡 제출</Text>
      <Text style={{ color: "#737373" }}>
        오디오(필수) / 커버(선택) / 메이킹노트(필수)
      </Text>

      <TextInput
        placeholder="songId (UUID)"
        value={songId}
        onChangeText={setSongId}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10 }}
      />
      <TextInput
        placeholder="accessToken (선택: 로그인 토큰)"
        value={accessToken}
        onChangeText={setAccessToken}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10 }}
      />
      <TextInput
        placeholder="메이킹노트 (필수)"
        value={makingNote}
        onChangeText={setMakingNote}
        multiline
        textAlignVertical="top"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10, minHeight: 100 }}
      />

      <Text style={{ fontWeight: "600" }}>오디오 파일 선택 (필수)</Text>
      <TextInput
        placeholder="오디오 파일 URI (예: file:///...)"
        value={audioUri}
        onChangeText={setAudioUri}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10 }}
      />
      <TextInput
        placeholder="오디오 MIME (예: audio/mpeg)"
        value={audioMime}
        onChangeText={setAudioMime}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10 }}
      />

      <Text style={{ fontWeight: "600" }}>커버 파일 선택 (선택)</Text>
      <TextInput
        placeholder="커버 이미지 URI (예: file:///...)"
        value={coverUri}
        onChangeText={setCoverUri}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10 }}
      />
      <TextInput
        placeholder="커버 MIME (예: image/jpeg)"
        value={coverMime}
        onChangeText={setCoverMime}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 10 }}
      />

      <Button title={stepLabel(stage)} onPress={() => void handleSubmit()} disabled={isBusy} />
      {stage.type === "Error" ? <Text>{stage.message}</Text> : null}
      {statusText ? <Text>{statusText}</Text> : null}
    </ScrollView>
  );
}
