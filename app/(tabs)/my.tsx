// contracts: docs/contracts/ux-flows.md (공통 상태머신, 제출 업로드 플로우), docs/contracts/api.md (entitlement)
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Button, Text, View } from "react-native";
import { supabase } from "../../src/lib/supabase";
import { toAppError } from "../../src/lib/errors";

type ScreenState = "loading" | "empty" | "error" | "ready";
type UserRole = "viewer" | "artist" | "admin" | null;
type ApplicationStatus = "pending" | "approved" | "rejected" | null;

function StateSkeleton({
  title,
  state,
}: {
  title: string;
  state: ScreenState;
}) {
  if (state === "loading") return <Text>{title} 정보를 불러오는 중...</Text>;
  if (state === "empty") return <Text>{title}에 표시할 정보가 없어요.</Text>;
  if (state === "error") return <Text>{title} 정보를 불러오지 못했어요.</Text>;
  return <Text>{title} 화면 준비 완료 (ready)</Text>;
}

export default function MyTabScreen() {
  const router = useRouter();
  const [state, setState] = useState<ScreenState>("loading");
  const [role, setRole] = useState<UserRole>(null);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;

    const loadMyState = async () => {
      try {
        setState("loading");
        const sessionResult = await supabase.auth.getSession();
        const userId = sessionResult.data.session?.user.id;
        if (!userId) {
          if (!alive) return;
          setRole(null);
          setApplicationStatus(null);
          setState("empty");
          return;
        }

        const profileResult = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        if (profileResult.error) {
          throw profileResult.error;
        }

        const nextRole = (profileResult.data?.role ?? "viewer") as UserRole;

        const appResult = await supabase
          .from("musician_applications")
          .select("status")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextStatus = appResult.error
          ? null
          : ((appResult.data?.status ?? null) as ApplicationStatus);

        if (!alive) return;
        setRole(nextRole);
        setApplicationStatus(nextStatus);
        setState("ready");
      } catch (error) {
        if (!alive) return;
        setMessage(toAppError(error).userMessage);
        setState("error");
      }
    };

    void loadMyState();
    const sub = supabase.auth.onAuthStateChange(() => {
      void loadMyState();
    });
    return () => {
      alive = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const canSubmitSong = useMemo(() => role === "artist", [role]);
  const pendingNotice =
    role !== "artist" && applicationStatus === "pending"
      ? "뮤지션 승인 대기 중입니다. 승인 후 업로드를 사용할 수 있어요."
      : null;

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>마이 탭</Text>
      <Text>오디오 업로드 후 제출을 완료하세요.</Text>
      <Text>현재 역할: {role ?? "미로그인"}</Text>
      {pendingNotice ? <Text>{pendingNotice}</Text> : null}
      {message ? <Text>{message}</Text> : null}
      <Button
        title={canSubmitSong ? "노래 제출하기" : "노래 제출하기 (승인 후 가능)"}
        onPress={() => router.push("/submission/new")}
        disabled={!canSubmitSong}
      />
      <StateSkeleton title="마이" state={state} />
    </View>
  );
}
