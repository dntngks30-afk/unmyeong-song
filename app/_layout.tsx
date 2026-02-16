import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack initialRouteName="(tabs)">
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: "임시 Top10 투표" }} />
      <Stack.Screen name="story/write" options={{ title: "사연 작성" }} />
      <Stack.Screen name="story/[id]" options={{ title: "사연 상세" }} />
      <Stack.Screen name="submission/new" options={{ title: "곡 제출" }} />
    </Stack>
  );
}
