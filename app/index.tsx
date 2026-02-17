import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";

export default function RootEntryScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
      <ActivityIndicator />
      <Text>로그인 화면으로 이동 중...</Text>
    </View>
  );
}
