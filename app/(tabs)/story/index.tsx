import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { listStories, type Story } from "../../../src/services/stories";
import { supabase } from "../../../src/lib/supabase";

const CTA_HEIGHT = 46;
const CTA_MARGIN = 12;

type State = "loading" | "ready" | "empty" | "error";

export default function StoryListScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [stories, setStories] = useState<Story[]>([]);

  const ctaBottom = CTA_MARGIN;
  const scrollPadding = CTA_HEIGHT + CTA_MARGIN + 12;

  useEffect(() => {
    let alive = true;
    const fn = async () => {
      const { data: session } = await supabase.auth.getSession();
      const result = await listStories({ limit: 50, accessToken: session.session?.access_token });
      if (!alive) return;
      if (result.ok) {
        setStories(result.data);
        setState(result.data.length > 0 ? "ready" : "empty");
      } else {
        setState(result.reason === "error" ? "error" : "empty");
      }
    };
    void fn();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Screen title="사연" subcopy="당신의 이야기를 들려주세요">
      <ScrollView contentContainerStyle={{ paddingBottom: scrollPadding, gap: 12 }} showsVerticalScrollIndicator={false}>
        {state === "loading" && (
          <Card>
            <ActivityIndicator color="#60a5fa" />
            <Text style={{ color: "#666", marginTop: 8, textAlign: "center" }}>사연 목록 불러오는 중...</Text>
          </Card>
        )}

        {state === "empty" && (
          <Card>
            <Text style={{ color: "#666", textAlign: "center" }}>아직 사연이 없어요.</Text>
          </Card>
        )}

        {state === "error" && (
          <Card style={{ backgroundColor: "rgba(148,163,184,0.1)" }}>
            <Text style={{ color: "#94a3b8", textAlign: "center" }}>사연 목록을 불러올 수 없어요. 준비중입니다.</Text>
          </Card>
        )}

        {state === "ready" &&
          stories.map((s) => (
            <Pressable key={s.id} onPress={() => router.push(`/(tabs)/story/${s.id}`)}>
              <Card>
                <Text style={{ fontWeight: "600", fontSize: 15 }}>{s.title}</Text>
                <Text style={{ color: "#666", marginTop: 4 }} numberOfLines={2}>
                  {s.content}
                </Text>
              </Card>
            </Pressable>
          ))}
      </ScrollView>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: ctaBottom,
          alignItems: "center",
        }}
      >
        <Pressable
          onPress={() => router.push("/(tabs)/story/write")}
          style={{
            width: "80%",
            height: CTA_HEIGHT,
            backgroundColor: "#2563eb",
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>사연 쓰기</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
