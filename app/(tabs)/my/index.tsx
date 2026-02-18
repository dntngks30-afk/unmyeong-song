import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Card } from "../../../src/components/ui/Card";
import { Screen } from "../../../src/components/ui/Screen";
import { getMySummary, getMyEntitlement } from "../../../src/services/my";
import { supabase } from "../../../src/lib/supabase";

type MySummary = { storiesCount: number | null; songsCount: number | null; votesCount: number | null } | null;
type MyEntitlement = { status: string; role?: string; isMusicianApproved?: boolean } | null;

export default function MyTabScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<MySummary>(null);
  const [entitlement, setEntitlement] = useState<MyEntitlement>(null);
  const [loaded, setLoaded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    Alert.alert("로그아웃", "로그아웃 할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            await supabase.auth.signOut();
            router.replace("/login");
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            Alert.alert("로그아웃 실패", msg);
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  }, [isLoggingOut, router]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const fn = async () => {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const [s, e] = await Promise.all([getMySummary(token), getMyEntitlement(token)]);
        if (!alive) return;
        setSummary(s);
        setEntitlement(e);
        setLoaded(true);
      };
      void fn();
      return () => {
        alive = false;
      };
    }, [])
  );

  const showMusicianApply =
    entitlement?.role === "artist" && entitlement?.isMusicianApproved === false;

  const items = [
    ...(entitlement?.status === "admin"
      ? [{ key: "admin" as const, label: "승인 관리", count: null as number | null, isAdmin: true as const }]
      : []),
    ...(showMusicianApply
      ? [{ key: "musician-apply" as const, label: "뮤지션 승인 신청", count: null as number | null, isAdmin: false as const }]
      : []),
    {
      key: "my-stories" as const,
      label: "내 사연",
      count: summary?.storiesCount,
      isAdmin: false as const,
    },
    {
      key: "my-submit" as const,
      label: "내 제출곡",
      count: summary?.songsCount,
      isAdmin: false as const,
    },
    {
      key: "my-votes" as const,
      label: "내 투표 기록",
      count: summary?.votesCount,
      isAdmin: false as const,
    },
    {
      key: "entitlement" as const,
      label: "entitlement",
      count: null,
      entitlement,
      isAdmin: false as const,
    },
  ];

  return (
    <Screen title="마이" subcopy="내 활동">
      <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 12 }} showsVerticalScrollIndicator={false}>
        {showMusicianApply && (
          <Pressable
            onPress={() => router.push("/(tabs)/my/apply")}
            style={({ pressed }) => ({
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Card style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", borderWidth: 1, borderColor: "#3b82f6" }}>
              <Text style={{ fontWeight: "600", fontSize: 15 }}>
                승인 신청(샘플 업로드)이 필요해요
              </Text>
              <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                샘플 1곡을 업로드하고 승인을 받으면 뮤지션 활동이 가능해요.
              </Text>
              <View
                style={{
                  marginTop: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  backgroundColor: "#3b82f6",
                  borderRadius: 8,
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  승인 신청하기
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
        {items.map((item) => {
          const isPlaceholder =
            item.key === "entitlement" ? entitlement === null : summary === null || item.count === null;
          const badge = item.key === "admin"
            ? "관리자 전용"
            : item.key === "musician-apply"
              ? "샘플 1곡 업로드"
              : isPlaceholder
              ? "준비중(스키마 확정 후 연동)"
              : item.key === "entitlement" && item.entitlement
                ? item.entitlement.status
                : typeof item.count === "number"
                  ? `${item.count}건`
                  : loaded
                    ? "0건"
                    : "-";

          const content = (
            <>
              <Text style={{ fontWeight: "600" }}>{item.label}</Text>
              <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{badge}</Text>
            </>
          );

          if (item.key === "admin") {
            return (
              <Pressable key={item.key} onPress={() => router.push("/(tabs)/admin")}>
                <Card>{content}</Card>
              </Pressable>
            );
          }
          if (item.key === "musician-apply") {
            return (
              <Pressable key={item.key} onPress={() => router.push("/(tabs)/my/apply")}>
                <Card>{content}</Card>
              </Pressable>
            );
          }

          return (
            <Card key={item.key}>{content}</Card>
          );
        })}

        <Pressable
          onPress={handleLogout}
          disabled={isLoggingOut}
          style={{
            marginTop: 16,
            paddingVertical: 12,
            paddingHorizontal: 20,
            backgroundColor: "#374151",
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "500" }}>
            {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
