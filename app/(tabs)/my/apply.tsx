/**
 * 뮤지션 승인 신청 - 샘플 1곡 업로드
 * PR-NEXT-03: role=artist && !is_musician_approved 시 접근
 */
import { useCallback, useEffect, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { supabase } from "../../../src/lib/supabase";
import {
  createApplicationSampleUploadSession,
  uploadFileToSignedUrl,
  assertStorageObject,
  setMusicianApplicationSamplePath,
  submitMusicianApplication,
} from "../../../features/musician-apply/api/mutations";

type Stage = "idle" | "creating" | "issuing" | "uploading" | "saving" | "done" | "error";

export default function MusicianApplyScreen() {
  const router = useRouter();
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [canAccess, setCanAccess] = useState<boolean | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [artistName, setArtistName] = useState("");
  const [bio, setBio] = useState("");
  const [sampleFile, setSampleFile] = useState<{
    uri: string;
    name: string;
    mimeType: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    const fn = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const userId = data.session?.user?.id;
      setAccessToken(token);
      if (!userId) {
        setCanAccess(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_musician_approved")
        .eq("id", userId)
        .maybeSingle();

      const approved = Boolean((profile as any)?.is_musician_approved);
      if (approved) {
        setCanAccess(false);
        return;
      }

      const { data: app } = await supabase
        .from("musician_applications")
        .select("id, artist_name, bio")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;
      setCanAccess(true);
      if ((app as any)?.id) {
        setApplicationId((app as any).id);
        setArtistName((app as any).artist_name ?? "");
        setBio((app as any).bio ?? "");
      }
    };
    void fn();
    return () => {
      alive = false;
    };
  }, []);

  const createApplication = useCallback(async (): Promise<string | null> => {
    if (!accessToken) return null;
    const { data } = await supabase.auth.getUser();
    const userId = data.data?.user?.id;
    if (!userId) return null;

    const { data: inserted, error } = await supabase
      .from("musician_applications")
      .insert({
        user_id: userId,
        bio: bio.trim() || "승인 신청 중",
        artist_name: artistName.trim() || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      setErrorMsg(error.message);
      return null;
    }
    return (inserted as any)?.id ?? null;
  }, [accessToken, artistName, bio]);

  const pickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setSampleFile({
      uri: asset.uri,
      name: asset.name ?? "sample.mp3",
      mimeType: asset.mimeType ?? "audio/mpeg",
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    console.log("[Apply] submit pressed");
    if (!accessToken) {
      setErrorMsg("로그인이 필요해요.");
      return;
    }
    if (!sampleFile) {
      setErrorMsg("샘플 오디오 파일을 선택해 주세요.");
      return;
    }

    let appId = applicationId;
    try {
      if (!appId) {
        setStage("creating");
        setErrorMsg("");
        appId = await createApplication();
        if (!appId) {
          setStage("error");
          return;
        }
        setApplicationId(appId);
      }

      setStage("issuing");
      setErrorMsg("");
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        setStage("error");
        setErrorMsg("로그인이 필요해요.");
        return;
      }
      const token = sessionData.session.access_token;
      const sessionRes = await createApplicationSampleUploadSession({
        applicationId: appId,
        accessToken: token,
        file: {
          uri: sampleFile.uri,
          mimeType: sampleFile.mimeType,
          filename: sampleFile.name,
          kind: "audio",
        },
      });

      if (!sessionRes.ok) {
        setStage("error");
        setErrorMsg(sessionRes.error.userMessage);
        return;
      }

      setStage("uploading");
      const uploadRes = await uploadFileToSignedUrl(sessionRes.data, {
        uri: sampleFile.uri,
        mimeType: sampleFile.mimeType,
        filename: sampleFile.name,
        kind: "audio",
      });

      if (!uploadRes.ok) {
        setStage("error");
        setErrorMsg(uploadRes.error.userMessage);
        return;
      }

      const verifyRes = await assertStorageObject({
        bucket: sessionRes.data.bucket,
        path: uploadRes.objectPath,
        accessToken,
      });
      if (!verifyRes.ok || !verifyRes.exists) {
        setStage("error");
        setErrorMsg("업로드에 실패했어요(저장 확인 실패). 다시 시도해주세요.");
        Alert.alert(
          "업로드에 실패했어요",
          "저장 확인 실패. 다시 시도해주세요.",
          [{ text: "확인" }]
        );
        return;
      }

      setStage("saving");
      const saveRes = await setMusicianApplicationSamplePath({
        applicationId: appId,
        samplePath: sessionRes.data.objectPath,
        accessToken,
      });

      if (!saveRes.ok) {
        setStage("error");
        setErrorMsg(saveRes.error.userMessage);
        return;
      }

      const submitRes = await submitMusicianApplication({
        applicationId: appId,
        accessToken,
      });

      if (!submitRes.ok) {
        setStage("error");
        setErrorMsg(submitRes.error.userMessage);
        return;
      }

      setStage("done");
      Alert.alert(
        "신청 완료",
        "신청이 완료 되었습니다. 승인이 완료되면 뮤지션 활동이 가능합니다.",
        [{ text: "확인", onPress: () => router.replace("/(tabs)/home") }]
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Apply] submit error", msg);
      setStage("error");
      setErrorMsg(msg || "제출 중 오류가 발생했어요.");
    }
  }, [accessToken, applicationId, sampleFile, createApplication, router]);

  if (canAccess === null) {
    return (
      <Screen title="뮤지션 승인 신청" onBackPress={() => router.back()}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#60a5fa" />
        </View>
      </Screen>
    );
  }

  if (!canAccess) {
    return (
      <Screen title="뮤지션 승인 신청" onBackPress={() => router.back()}>
        <Card>
          <Text style={{ color: "#94a3b8" }}>
            승인 대기 중인 뮤지션만 이용할 수 있어요.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              marginTop: 16,
              paddingVertical: 10,
              backgroundColor: "#374151",
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>돌아가기</Text>
          </Pressable>
        </Card>
      </Screen>
    );
  }

  const isBusy = stage === "creating" || stage === "issuing" || stage === "uploading" || stage === "saving";

  return (
    <Screen title="뮤지션 승인 신청" onBackPress={() => router.back()}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 16 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: "#94a3b8", fontSize: 13 }}>
          승인 신청용 샘플 곡 1개를 업로드해 주세요. (mp3, 10MB 이하)
        </Text>

        {!applicationId && (
          <>
            <TextInput
              placeholder="아티스트명 (선택)"
              value={artistName}
              onChangeText={setArtistName}
              style={{
                borderWidth: 1,
                borderColor: "#374151",
                borderRadius: 8,
                padding: 12,
                color: "#fff",
              }}
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              placeholder="간단 소개 (선택)"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              style={{
                borderWidth: 1,
                borderColor: "#374151",
                borderRadius: 8,
                padding: 12,
                color: "#fff",
                minHeight: 80,
              }}
              placeholderTextColor="#94a3b8"
            />
          </>
        )}

        <Card>
          <Text style={{ fontWeight: "600", marginBottom: 8 }}>샘플 오디오 (필수)</Text>
          <Pressable
            onPress={pickFile}
            disabled={isBusy}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: "#374151",
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff" }}>
              {sampleFile ? sampleFile.name : "파일 선택"}
            </Text>
          </Pressable>
        </Card>

        {errorMsg ? (
          <Text style={{ color: "#f87171", fontSize: 13 }}>{errorMsg}</Text>
        ) : null}

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={isBusy || !sampleFile}
          style={{
            paddingVertical: 14,
            backgroundColor: isBusy || !sampleFile ? "#64748b" : "#2563eb",
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            {stage === "creating"
              ? "신청서 생성 중..."
              : stage === "issuing"
                ? "업로드 준비 중..."
                : stage === "uploading"
                  ? "업로드 중..."
                  : stage === "saving"
                    ? "저장 중..."
                    : "승인 신청 제출"}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
