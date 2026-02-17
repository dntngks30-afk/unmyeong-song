import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { supabase } from "../../src/lib/supabase";

export default function TabsLayout() {
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let alive = true;
    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setHasSession(Boolean(data.session));
      setIsSessionReady(true);
    };
    void syncSession();

    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setHasSession(Boolean(session));
      setIsSessionReady(true);
    });

    return () => {
      alive = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  if (!isSessionReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!hasSession) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
          tabBarLabel: "홈",
        }}
      />
      <Tabs.Screen
        name="story"
        options={{
          title: "사연",
          tabBarLabel: "사연",
        }}
      />
      <Tabs.Screen
        name="show"
        options={{
          title: "쇼",
          tabBarLabel: "쇼",
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: "마이",
          tabBarLabel: "마이",
        }}
      />
    </Tabs>
  );
}
