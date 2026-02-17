import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { toAppError } from "../../src/lib/errors";

type SignupKind = "viewer" | "musician";
type ProfileSaveState = "idle" | "saving" | "done";

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [favoriteGenre, setFavoriteGenre] = useState("");
  const [signupKind, setSignupKind] = useState<SignupKind>("viewer");
  const [bio, setBio] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [sampleSongUrl, setSampleSongUrl] = useState("");
  const [sampleSongAudioPath, setSampleSongAudioPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileState, setProfileState] = useState<ProfileSaveState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSessionUserId(data.session?.user.id ?? null);
    };

    void syncSession();
    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setSessionUserId(session?.user.id ?? null);
    });

    return () => {
      alive = false;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  const canSignupAccount =
    !loading &&
    email.trim().length > 0 &&
    password.length >= 6;

  const parsedAge = useMemo(() => {
    const num = Number(age);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : null;
  }, [age]);

  const canSaveProfile =
    profileState !== "saving" &&
    !!sessionUserId &&
    nickname.trim().length > 0 &&
    (!!parsedAge || age.trim().length === 0) &&
    (signupKind !== "musician" || bio.trim().length > 0);

  const onSignupAccount = async () => {
    if (!canSignupAccount) return;
    setLoading(true);
    setMessage("");

    try {
      const result = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (result.error) {
        setMessage(toAppError(result.error).userMessage);
        return;
      }

      setMessage("계정 생성이 완료되었어요. 이메일 인증 후 로그인하고 프로필을 완성해 주세요.");
    } catch (error) {
      setMessage(toAppError(error).userMessage);
    } finally {
      setLoading(false);
    }
  };

  const onSaveProfile = async () => {
    if (!canSaveProfile || !sessionUserId) return;
    setProfileState("saving");
    setMessage("");

    try {
      const profilePayload = {
        id: sessionUserId,
        role: "viewer" as const,
        display_name: nickname.trim(),
        nickname: nickname.trim(),
        age: parsedAge,
        gender: gender.trim() || null,
        favorite_genre: favoriteGenre.trim() || null,
      };

      const profileUpsert = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" });

      if (profileUpsert.error) {
        setMessage(toAppError(profileUpsert.error).userMessage);
        setProfileState("idle");
        return;
      }

      if (signupKind === "musician") {
        const pendingCheck = await supabase
          .from("musician_applications")
          .select("id")
          .eq("user_id", sessionUserId)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle();

        if (pendingCheck.error) {
          setMessage(toAppError(pendingCheck.error).userMessage);
          setProfileState("idle");
          return;
        }

        if (!pendingCheck.data) {
          const appInsert = await supabase.from("musician_applications").insert({
            user_id: sessionUserId,
            bio: bio.trim(),
            portfolio_url: portfolioUrl.trim() || null,
            sample_song_url: sampleSongUrl.trim() || null,
            sample_song_audio_path: sampleSongAudioPath.trim() || null,
            status: "pending",
          });

          if (appInsert.error) {
            setMessage(toAppError(appInsert.error).userMessage);
            setProfileState("idle");
            return;
          }
        }

        setMessage("뮤지션 신청이 저장되었어요. 승인 전에는 업로드 기능을 사용할 수 없어요.");
      } else {
        setMessage("프로필 저장이 완료되었어요. 사연자 기능을 바로 사용할 수 있어요.");
      }

      setProfileState("done");
    } catch (error) {
      setMessage(toAppError(error).userMessage);
      setProfileState("idle");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>회원가입</Text>

      {!sessionUserId ? (
        <>
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
          <Pressable
            onPress={onSignupAccount}
            disabled={!canSignupAccount}
            style={{
              backgroundColor: canSignupAccount ? "#111827" : "#9ca3af",
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>{loading ? "가입 중..." : "계정 만들기"}</Text>
          </Pressable>
          <Text style={{ color: "#6b7280" }}>
            계정 생성 후 로그인하면 프로필/회원 유형을 저장할 수 있어요.
          </Text>
        </>
      ) : (
        <>
          <Text style={{ color: "#6b7280" }}>프로필을 완성하면 탭 화면에 진입할 수 있어요.</Text>
          <TextInput
            placeholder="닉네임"
            value={nickname}
            onChangeText={setNickname}
            style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
          />
          <TextInput
            placeholder="나이(선택)"
            keyboardType="number-pad"
            value={age}
            onChangeText={setAge}
            style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
          />
          <TextInput
            placeholder="성별(선택)"
            value={gender}
            onChangeText={setGender}
            style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
          />
          <TextInput
            placeholder="선호 장르(선택)"
            value={favoriteGenre}
            onChangeText={setFavoriteGenre}
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

          {signupKind === "musician" ? (
            <>
              <TextInput
                placeholder="자기소개(bio)"
                value={bio}
                onChangeText={setBio}
                style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
              />
              <TextInput
                placeholder="포트폴리오 URL(선택)"
                autoCapitalize="none"
                value={portfolioUrl}
                onChangeText={setPortfolioUrl}
                style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
              />
              <TextInput
                placeholder="샘플 곡 URL(선택)"
                autoCapitalize="none"
                value={sampleSongUrl}
                onChangeText={setSampleSongUrl}
                style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
              />
              <TextInput
                placeholder="샘플 곡 Storage 경로(선택)"
                autoCapitalize="none"
                value={sampleSongAudioPath}
                onChangeText={setSampleSongAudioPath}
                style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
              />
            </>
          ) : null}

          <Pressable
            onPress={onSaveProfile}
            disabled={!canSaveProfile}
            style={{
              backgroundColor: canSaveProfile ? "#111827" : "#9ca3af",
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>
              {profileState === "saving" ? "저장 중..." : "프로필 저장"}
            </Text>
          </Pressable>
        </>
      )}

      <Link href="/(auth)/login" asChild>
        <Pressable style={{ paddingVertical: 10 }}>
          <Text style={{ color: "#2563eb" }}>로그인으로 이동</Text>
        </Pressable>
      </Link>

      {message ? <Text>{message}</Text> : null}
    </View>
  );
}
