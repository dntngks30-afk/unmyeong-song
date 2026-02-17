import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { getStory } from "../../../src/services/stories";
import { supabase } from "../../../src/lib/supabase";

type State = "loading" | "ready" | "not_found" | "error";

export default function StoryDetailScreen() {
  const router = useRouter();
  const { storyId, fromSubmit } = useLocalSearchParams<{ storyId: string; fromSubmit?: string }>();
  const [state, setState] = useState<State>("loading");
  const [title, setTitle] = useState("사연");
  const [content, setContent] = useState("내용 없음");

  useEffect(() => {
    if (!storyId) {
      setState("not_found");
      return;
    }
    let alive = true;
    const fn = async () => {
      const { data: session } = await supabase.auth.getSession();
      const result = await getStory(storyId, session.session?.access_token);
      if (!alive) return;
      if (result.ok) {
        setTitle(result.data.title);
        setContent(result.data.content);
        setState("ready");
      } else {
        setState(result.reason === "not_found" ? "not_found" : "error");
      }
    };
    void fn();
    return () => {
      alive = false;
    };
  }, [storyId]);

  return (
    <Screen title="사연 상세" onBackPress={() => router.back()}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {state === "loading" && (
          <Card>
            <Text style={{ color: "#666", textAlign: "center" }}>불러오는 중...</Text>
          </Card>
        )}

        {(state === "not_found" || state === "error") && (
          <Card>
            <Text style={{ color: "#666", textAlign: "center" }}>
              {state === "not_found" ? "사연을 찾을 수 없어요." : "사연을 불러올 수 없어요. 준비중입니다."}
            </Text>
          </Card>
        )}

        {state === "ready" && (
          <>
            {fromSubmit === "1" && (
              <Text style={{ color: "#22c55e", fontSize: 13, marginBottom: 12 }}>제출된 사연입니다</Text>
            )}
            <Card style={{ marginBottom: 16 }}>
              <Text style={{ fontWeight: "600", fontSize: 18 }}>{title}</Text>
              <Text style={{ color: "#666", marginTop: 8 }}>{content}</Text>
            </Card>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 8 }}>
              댓글 기능은 준비 중입니다.
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
