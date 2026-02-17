// contracts: docs/contracts/ux-flows.md (공통 상태머신, 제출 업로드 플로우), docs/contracts/api.md (entitlement)
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Button, ScrollView, Text, View } from "react-native";
import { supabase } from "../../src/lib/supabase";
import { toAppError } from "../../src/lib/errors";
import { getMyStoryList } from "../../features/story/api/queries";
import type { Story } from "../../features/story/model/types";

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
  const [myStories, setMyStories] = useState<Story[]>([]);
  const [myStoriesState, setMyStoriesState] = useState<ScreenState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;

    const loadMyState = async () => {
      try {
        setState("loading");
        setMyStoriesState("loading");
        const sessionResult = await supabase.auth.getSession();
        const accessToken = sessionResult.data.session?.access_token;
        const userId = sessionResult.data.session?.user.id;
        if (!userId) {
          if (!alive) return;
          setRole(null);
          setApplicationStatus(null);
          setState("empty");
          setMyStories([]);
          setMyStoriesState("empty");
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

        if (accessToken) {
          const myStoriesResult = await getMyStoryList({
            userId,
            accessToken,
            limit: 20,
          });
          if (!alive) return;
          if (!myStoriesResult.ok) {
            setMyStories([]);
            setMyStoriesState("error");
          } else if (myStoriesResult.state === "empty") {
            setMyStories([]);
            setMyStoriesState("empty");
          } else {
            setMyStories(myStoriesResult.data);
            setMyStoriesState("ready");
          }
        } else {
          setMyStories([]);
          setMyStoriesState("empty");
        }

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

  const canSubmitSong = useMemo(
    () => role === "admin" || (role === "artist" && (applicationStatus === "approved" || applicationStatus === null)),
    [applicationStatus, role],
  );
  const pendingNotice =
    applicationStatus === "pending"
      ? "뮤지션 승인 대기 중입니다. 승인 후 업로드를 사용할 수 있어요."
      : null;
  const canWriteStory = role === "viewer" || role === "artist" || role === "admin";

  const logout = async () => {
    const result = await supabase.auth.signOut();
    if (result.error) {
      setMessage(toAppError(result.error).userMessage);
      return;
    }
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
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
      <Button title="사연 작성하기" onPress={() => router.push("/story/write")} disabled={!canWriteStory} />
      {role === "admin" ? <Button title="관리자 검수(준비중)" onPress={() => setMessage("관리자 메뉴는 준비 중이에요.")} /> : null}
      <Button title="로그아웃" onPress={() => void logout()} />
      <StateSkeleton title="마이" state={state} />
      <Text style={{ fontSize: 16, fontWeight: "600" }}>내가 쓴 사연</Text>
      {myStoriesState === "loading" ? <Text>내 사연을 불러오는 중...</Text> : null}
      {myStoriesState === "empty" ? <Text>아직 작성한 사연이 없어요.</Text> : null}
      {myStoriesState === "error" ? <Text>내 사연을 불러오지 못했어요.</Text> : null}
      {myStoriesState === "ready"
        ? myStories.map((story) => (
            <View key={story.id} style={{ borderWidth: 1, borderColor: "#e5e5e5", borderRadius: 8, padding: 10, gap: 4 }}>
              <Text style={{ fontWeight: "600" }}>{story.title}</Text>
              <Text numberOfLines={2}>{story.content}</Text>
              <Text style={{ color: "#737373" }}>{new Date(story.createdAt).toLocaleString()}</Text>
            </View>
          ))
        : null}
    </ScrollView>
  );
}
