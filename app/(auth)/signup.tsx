import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { supabase } from "../../src/lib/supabase";
import { toAppError } from "../../src/lib/errors";

type SignupKind = "viewer" | "musician";
type SignupStep = "role" | "account" | "profile" | "detail";
type SignupErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "NETWORK"
  | "SESSION_MISSING"
  | "UNKNOWN";
type Gender = "male" | "female";

type SampleFile = {
  uri: string;
  name: string;
  mimeType: string;
};

const GENRE_OPTIONS = ["발라드", "힙합", "R&B", "록", "인디", "EDM", "재즈", "클래식", "OST", "트로트"] as const;

function mapSignupError(error: unknown): { code: SignupErrorCode; message: string } {
  const appError = toAppError(error);
  const raw = `${appError.message}\n${JSON.stringify(appError.details ?? {})}`.toLowerCase();
  if (raw.includes("email not confirmed")) {
    return { code: "EMAIL_NOT_CONFIRMED", message: "이메일 인증 후 로그인해 주세요." };
  }
  if (raw.includes("invalid login credentials")) {
    return { code: "INVALID_CREDENTIALS", message: "이메일 또는 비밀번호를 확인해 주세요." };
  }
  if (raw.includes("already registered") || raw.includes("user already registered")) {
    return { code: "INVALID_CREDENTIALS", message: "이미 가입된 이메일입니다. 로그인해 주세요." };
  }
  if (raw.includes("session")) {
    return { code: "SESSION_MISSING", message: "세션을 생성하지 못했어요." };
  }
  if (raw.includes("network") || raw.includes("fetch")) {
    return { code: "NETWORK", message: "네트워크 연결을 확인해 주세요." };
  }
  return { code: "UNKNOWN", message: "원인을 확인하지 못했어요. 입력값을 확인해 주세요." };
}

export default function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState<SignupStep>("role");
  const [signupKind, setSignupKind] = useState<SignupKind>("viewer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState<Date>(new Date(2000, 0, 1));
  const [gender, setGender] = useState<Gender | null>(null);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [artistName, setArtistName] = useState("");
  const [sampleSongUrl, setSampleSongUrl] = useState("");
  const [sampleFile, setSampleFile] = useState<SampleFile | null>(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [errorCode, setErrorCode] = useState<SignupErrorCode | null>(null);
  const [message, setMessage] = useState("");

  const parsedAge = useMemo(() => {
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      years -= 1;
    }
    return years > 0 ? years : null;
  }, [birthDate]);

  const accountValid =
    email.trim().length > 0 && password.length >= 6 && confirmPassword.length > 0 && password === confirmPassword;
  const profileValid = nickname.trim().length > 0 && !!parsedAge && !!gender;
  const detailValid =
    signupKind === "viewer"
      ? preferredGenres.length > 0
      : artistName.trim().length > 0 && (sampleSongUrl.trim().length > 0 || sampleFile !== null);

  useEffect(() => {
    let alive = true;
    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) {
        router.replace("/(tabs)/home");
        return;
      }
      setLoadingSession(false);
    };
    void syncSession();
    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session) {
        router.replace("/(tabs)/home");
        return;
      }
      setLoadingSession(false);
    });
    return () => {
      alive = false;
      sub.data.subscription.unsubscribe();
    };
  }, [router]);

  const toggleGenre = (genre: string) => {
    setPreferredGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  };

  const pickSampleFile = async () => {
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
    setSampleSongUrl("");
  };

  const onSubmit = async () => {
    if (loading || loadingSession || !accountValid || !profileValid || !detailValid) return;
    setLoading(true);
    setNeedsEmailConfirm(false);
    setErrorCode(null);
    setMessage("");

    try {
      const signupRes = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signupRes.error) {
        console.error("[auth][signup] signUp error", signupRes.error);
        const mapped = mapSignupError(signupRes.error);
        setErrorCode(mapped.code);
        setMessage(mapped.message);
        return;
      }

      const userId = signupRes.data.user?.id;
      if (!userId) {
        const mapped = mapSignupError(new Error("SESSION_MISSING"));
        setErrorCode(mapped.code);
        setMessage("가입은 완료됐지만 계정 정보를 확인하지 못했어요. 로그인으로 이동해 주세요.");
        return;
      }
      if (signupRes.data.session) {
        // 자동 로그인 상태를 유지하지 않고 로그인 화면 진입 UX로 통일한다.
        await supabase.auth.signOut();
      }
      setMessage("");
      Alert.alert("회원가입 완료", "가입을 환영합니다", [
        {
          text: "확인",
          onPress: () =>
            router.replace({
              pathname: "/(auth)/login",
              params: { email: email.trim() },
            }),
        },
      ]);
    } catch (error) {
      console.error("[auth][signup] unexpected", error);
      const mapped = mapSignupError(error);
      setErrorCode(mapped.code);
      setMessage(mapped.message);
      if (mapped.code === "EMAIL_NOT_CONFIRMED") {
        setNeedsEmailConfirm(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    if (!email.trim()) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });
    if (error) {
      setMessage(toAppError(error).userMessage);
      return;
    }
    setMessage("인증 이메일을 다시 보냈어요.");
  };

  const onChangeBirthDate = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== "ios") {
      setShowBirthDatePicker(false);
    }
    if (event.type === "dismissed") return;
    if (!selectedDate) return;
    setBirthDate(selectedDate);
  };

  const birthDateLabel = useMemo(() => {
    const year = birthDate.getFullYear();
    const month = String(birthDate.getMonth() + 1).padStart(2, "0");
    const day = String(birthDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, [birthDate]);

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>회원가입</Text>
      <Text style={{ color: "#6b7280" }}>
        1) 유형 선택 → 2) 계정 정보 → 3) 프로필(생년월일/성별) → 4) 세부정보
      </Text>

      {step === "role" ? (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setSignupKind("viewer")}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: signupKind === "viewer" ? "#111827" : "#d4d4d4",
                borderRadius: 8,
                padding: 12,
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
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text>뮤지션</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setStep("account")}
            style={{ backgroundColor: "#111827", paddingVertical: 12, borderRadius: 8, alignItems: "center" }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>다음</Text>
          </Pressable>
        </>
      ) : null}

      {step === "account" ? (
        <>
          <TextInput
            placeholder="이메일(아이디)"
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
          <TextInput
            placeholder="비밀번호 재확인"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
          />
          {confirmPassword.length > 0 && password !== confirmPassword ? (
            <Text style={{ color: "#b91c1c" }}>비밀번호가 일치하지 않아요.</Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setStep("role")}
              style={{ flex: 1, borderWidth: 1, borderColor: "#d4d4d4", paddingVertical: 12, borderRadius: 8, alignItems: "center" }}
            >
              <Text>이전</Text>
            </Pressable>
            <Pressable
              onPress={() => setStep("profile")}
              disabled={!accountValid}
              style={{
                flex: 1,
                backgroundColor: accountValid ? "#111827" : "#9ca3af",
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>다음</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {step === "profile" ? (
        <>
          <TextInput
            placeholder="닉네임"
            value={nickname}
            onChangeText={setNickname}
            style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
          />
          <Pressable
            onPress={() => setShowBirthDatePicker(true)}
            style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
          >
            <Text>생년월일: {birthDateLabel}</Text>
          </Pressable>
          {showBirthDatePicker ? (
            <DateTimePicker
              value={birthDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onChangeBirthDate}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
            />
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setGender("male")}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: gender === "male" ? "#111827" : "#d4d4d4",
                backgroundColor: gender === "male" ? "#111827" : "white",
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: gender === "male" ? "white" : "#111827" }}>남성</Text>
            </Pressable>
            <Pressable
              onPress={() => setGender("female")}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: gender === "female" ? "#111827" : "#d4d4d4",
                backgroundColor: gender === "female" ? "#111827" : "white",
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: gender === "female" ? "white" : "#111827" }}>여성</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setStep("account")}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: "#d4d4d4",
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text>이전</Text>
            </Pressable>
            <Pressable
              onPress={() => setStep("detail")}
              disabled={!profileValid}
              style={{
                flex: 1,
                backgroundColor: profileValid ? "#111827" : "#9ca3af",
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>다음</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {step === "detail" ? (
        <>
          {signupKind === "viewer" ? (
            <>
              <Text style={{ fontWeight: "600" }}>선호 음악 장르(복수 선택)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {GENRE_OPTIONS.map((genre) => {
                  const selected = preferredGenres.includes(genre);
                  return (
                    <Pressable
                      key={genre}
                      onPress={() => toggleGenre(genre)}
                      style={{
                        borderWidth: 1,
                        borderColor: selected ? "#111827" : "#d4d4d4",
                        backgroundColor: selected ? "#111827" : "white",
                        borderRadius: 16,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ color: selected ? "white" : "#111827" }}>{genre}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <TextInput
                placeholder="아티스트명(필수)"
                value={artistName}
                onChangeText={setArtistName}
                style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
              />
              <TextInput
                placeholder="샘플 곡 임시 URL(선택)"
                autoCapitalize="none"
                value={sampleSongUrl}
                onChangeText={setSampleSongUrl}
                style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12 }}
              />
              <Pressable
                onPress={() => void pickSampleFile()}
                style={{ borderWidth: 1, borderColor: "#d4d4d4", borderRadius: 8, padding: 12, alignItems: "center" }}
              >
                <Text>샘플 곡 파일 선택(mp3)</Text>
              </Pressable>
              {sampleFile ? <Text>선택 파일: {sampleFile.name}</Text> : null}
              <Text style={{ color: "#6b7280" }}>샘플 URL 또는 파일 업로드 중 하나는 필수예요.</Text>
            </>
          )}

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => setStep("profile")}
              style={{ flex: 1, borderWidth: 1, borderColor: "#d4d4d4", paddingVertical: 12, borderRadius: 8, alignItems: "center" }}
            >
              <Text>이전</Text>
            </Pressable>
            <Pressable
              onPress={() => void onSubmit()}
              disabled={!detailValid || loading}
              style={{
                flex: 1,
                backgroundColor: detailValid && !loading ? "#111827" : "#9ca3af",
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>{loading ? "가입 처리 중..." : "가입 완료"}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <Link href="/(auth)/login" asChild>
        <Pressable style={{ paddingVertical: 10 }}>
          <Text style={{ color: "#2563eb" }}>로그인으로 이동</Text>
        </Pressable>
      </Link>

      {needsEmailConfirm ? (
        <Pressable onPress={() => void resendConfirmation()} style={{ paddingVertical: 6 }}>
          <Text style={{ color: "#2563eb" }}>이메일 인증이 필요합니다. 인증 메일 다시 보내기</Text>
        </Pressable>
      ) : null}
      {errorCode ? <Text style={{ color: "#b91c1c" }}>에러 코드: {errorCode}</Text> : null}
      {message ? <Text>{message}</Text> : null}
    </View>
  );
}
