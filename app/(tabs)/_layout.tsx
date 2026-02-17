import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { supabase } from "../../src/lib/supabase";

const TAB_ICONS: Record<string, string> = { home: "🏠", story: "📝", show: "🎵", my: "👤" };

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const symbol = TAB_ICONS[name] ?? "•";
  return (
    <Text style={{ fontSize: 20, color, opacity: focused ? 1 : 0.6, fontWeight: focused ? "600" : "400" }}>
      {symbol}
    </Text>
  );
}

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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#14141f" },
        tabBarActiveTintColor: "#60a5fa",
        tabBarInactiveTintColor: "rgba(255,255,255,0.5)",
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
          tabBarLabel: "홈",
          tabBarIcon: ({ focused, color }) => <TabIcon name="home" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="story"
        options={{
          title: "사연",
          tabBarLabel: "사연",
          tabBarIcon: ({ focused, color }) => <TabIcon name="story" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="show"
        options={{
          title: "쇼",
          tabBarLabel: "쇼",
          tabBarIcon: ({ focused, color }) => <TabIcon name="show" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: "마이",
          tabBarLabel: "마이",
          tabBarIcon: ({ focused, color }) => <TabIcon name="my" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
