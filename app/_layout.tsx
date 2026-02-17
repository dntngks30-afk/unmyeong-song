import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack initialRouteName="index">
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="show/[id]" options={{ title: "트랙 상세" }} />
      <Stack.Screen name="story/write" options={{ title: "사연 작성" }} />
      <Stack.Screen name="story/[id]" options={{ title: "사연 상세" }} />
      <Stack.Screen name="submission/new" options={{ title: "곡 제출" }} />
    </Stack>
  );
}
