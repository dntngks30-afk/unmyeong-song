import { Tabs } from "expo-router";

export default function TabsLayout() {
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
