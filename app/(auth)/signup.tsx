import { useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { supabase } from "../../src/lib/supabase";
import { toAppError } from "../../src/lib/errors";
import { normalizeEmail, validateEmailFormat, emailDebugPreview } from "../../src/lib/auth/email";

type SignupKind = "viewer" | "musician";
type SignupStep = "role" | "account" | "profile" | "detail";
type SignupErrorCode =
  | "INVALID_EMAIL"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_CONFIRMED"
  | "NETWORK"
  | "SESSION_MISSING"
  | "UNKNOWN";

type Gender = "male" | "female";

const GENRE_OPTIONS = ["발라드", "힙합", "R&B", "록", "인디", "EDM", "재즈", "클래식", "OST", "트로트"] as const;

function mapSignupError(error: unknown): { code: SignupErrorCode; message: string } {
  const appError = toAppError(error);
  const raw = `${appError.message}\n${JSON.stringify(appError.details ?? {})}`.toLowerCase();
  if (raw.includes("invalid format") || raw.includes("invalid email") || raw.includes("validate email")) {
    return { code: "INVALID_EMAIL", message: "올바른 이메일 형식을 입력해 주세요." };
  }
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
  const emailPreservedRef = useRef<string>("");
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
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
    signupKind === "viewer" ? preferredGenres.length > 0 : artistName.trim().length > 0;

  const toggleGenre = (genre: string) => {
    setPreferredGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
  };

  const onSubmit = async () => {
    if (loading || !accountValid || !profileValid || !detailValid) return;
    setLoading(true);
    setNeedsEmailConfirm(false);
    setErrorCode(null);
    setMessage("");

    const rawEmail = emailPreservedRef.current || email;
    const emailNorm = normalizeEmail(rawEmail);
    const rawPreview = emailDebugPreview(rawEmail);
    const normPreview = emailDebugPreview(emailNorm);
    console.log(
      "[auth][signup] rawEmail=",
      rawPreview,
      "normalized=",
      normPreview,
      "hasAt=",
      emailNorm.includes("@")
    );
    if (!emailNorm.includes("@") || !validateEmailFormat(emailNorm)) {
      setErrorCode("INVALID_EMAIL");
      setMessage("올바른 이메일 형식을 입력해 주세요.");
      setLoading(false);
      return;
    }

    try {
      const signupRes = await supabase.auth.signUp({
        email: emailNorm,
        password,
      });

      const isAlreadyRegistered =
        signupRes.error &&
        `${signupRes.error.message}`.toLowerCase().includes("already registered");

      if (signupRes.error && isAlreadyRegistered) {
        setLoading(false);
        Alert.alert(
          "이미 가입된 이메일",
          "이미 가입된 이메일입니다. 로그인해 주세요.",
          [{ text: "확인", onPress: () => router.replace("/login") }]
        );
        return;
      }

      if (signupRes.error) {
        console.error("[auth][signup] signUp error", signupRes.error);
        const mapped = mapSignupError(signupRes.error);
        setErrorCode(mapped.code);
        setMessage(mapped.message);
        setLoading(false);
        return;
      }

      const userId = signupRes.data.user?.id;
      if (signupKind === "musician" && userId) {
        await supabase.from("profiles").update({ role: "artist" }).eq("id", userId);
      }

      await supabase.auth.signOut();
      setMessage("");
      setErrorCode(null);
      const completionMsg =
        signupKind === "musician"
          ? "가입이 완료되었습니다. 음원심사 후 뮤지션 활동이 가능합니다."
          : "가입을 환영합니다. 지금 로그인해 주세요.";
      Alert.alert("가입이 완료되었습니다", completionMsg, [
        {
          text: "확인",
          onPress: () => router.replace("/login"),
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
    const emailNorm = normalizeEmail(email);
    if (!emailNorm) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: emailNorm,
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
            onChangeText={(t) => {
              console.log("[signup][email-input] len=", t.length, "hasAt=", t.includes("@"), "preview=", t.slice(0, 20));
              setEmail(t);
            }}
            onBlur={() => {
              const n = normalizeEmail(email);
              if (n !== email) setEmail(n);
              emailPreservedRef.current = n || email;
            }}
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
              onPress={() => {
                const n = normalizeEmail(email);
                emailPreservedRef.current = n || email;
                setStep("profile");
              }}
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

      <Link href="/login" asChild>
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
