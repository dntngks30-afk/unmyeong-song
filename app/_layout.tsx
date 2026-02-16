import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack initialRouteName="(tabs)">
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: "임시 Top10 투표" }} />
    </Stack>
  );
}
