import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, disabled }: PrimaryButtonProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 16);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        {
          bottom,
          paddingBottom: bottom + 12,
        },
      ]}
    >
      <Text style={[styles.btnText, disabled && styles.btnTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  btnTextDisabled: { opacity: 0.6 },
});
