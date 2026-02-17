import { ActivityIndicator, Text, View } from "react-native";

export default function RootEntryScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
      <ActivityIndicator />
      <Text>인증 상태를 확인하는 중...</Text>
    </View>
  );
}
