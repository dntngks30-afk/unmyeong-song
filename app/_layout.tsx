import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { supabase } from "../src/lib/supabase";

type BootState = "loading" | "ready" | "error";

type AuthSnapshot = {
  hasSession: boolean;
  hasProfile: boolean;
  errorMessage?: string;
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [bootState, setBootState] = useState<BootState>("loading");
  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot>({
    hasSession: false,
    hasProfile: false,
  });

  const firstSegment = useMemo(() => (segments.length > 0 ? segments[0] : null), [segments]);
  const isAuthRoute = firstSegment === "(auth)";

  useEffect(() => {
    let alive = true;

    const checkProfileExists = async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return Boolean(data?.id);
    };

    const refreshSnapshot = async () => {
      try {
        setBootState("loading");
        const sessionResult = await supabase.auth.getSession();
        const session = sessionResult.data.session;

        if (!alive) return;

        if (!session) {
          setAuthSnapshot({ hasSession: false, hasProfile: false });
          setBootState("ready");
          return;
        }

        const hasProfile = await checkProfileExists(session.user.id);
        if (!alive) return;

        setAuthSnapshot({ hasSession: true, hasProfile });
        setBootState("ready");
      } catch (error) {
        if (!alive) return;
        setAuthSnapshot({
          hasSession: false,
          hasProfile: false,
          errorMessage: error instanceof Error ? error.message : "Unknown auth bootstrap error",
        });
        setBootState("error");
      }
    };

    void refreshSnapshot();

    const subscription = supabase.auth.onAuthStateChange(() => {
      void refreshSnapshot();
    });

    return () => {
      alive = false;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (bootState !== "ready") return;

    if (!authSnapshot.hasSession) {
      if (!isAuthRoute) {
        router.replace("/(auth)/login");
      }
      return;
    }

    if (!authSnapshot.hasProfile) {
      if (!(isAuthRoute && segments.includes("signup"))) {
        router.replace("/(auth)/signup");
      }
      return;
    }

    if (isAuthRoute) {
      router.replace("/(tabs)/home");
    }
  }, [authSnapshot.hasProfile, authSnapshot.hasSession, bootState, isAuthRoute, router, segments]);

  if (bootState === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <ActivityIndicator />
        <Text>세션 확인 중...</Text>
      </View>
    );
  }

  if (bootState === "error") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16, gap: 8 }}>
        <Text style={{ fontWeight: "600" }}>인증 초기화에 실패했어요.</Text>
        <Text>{authSnapshot.errorMessage ?? "잠시 후 다시 시도해 주세요."}</Text>
      </View>
    );
  }

  return (
    <Stack initialRouteName="(auth)">
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: "임시 Top10 투표" }} />
      <Stack.Screen name="show/[id]" options={{ title: "트랙 상세" }} />
      <Stack.Screen name="story/write" options={{ title: "사연 작성" }} />
      <Stack.Screen name="story/[id]" options={{ title: "사연 상세" }} />
      <Stack.Screen name="submission/new" options={{ title: "곡 제출" }} />
    </Stack>
  );
}
