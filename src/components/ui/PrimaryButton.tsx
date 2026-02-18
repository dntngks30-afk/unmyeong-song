import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
  /** 푸터 내부 등 고정 레이아웃에서 사용. position absolute 미사용, 55% 폭 */
  inline?: boolean;
};

export function PrimaryButton({ label, onPress, disabled, compact, inline }: PrimaryButtonProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 16);

  if (inline) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.btnBase,
          styles.btnInline,
          compact && styles.btnCompact,
          disabled && styles.btnDisabled,
        ]}
      >
        <Text style={[styles.btnText, compact && styles.btnTextCompact, disabled && styles.btnTextDisabled]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        compact && styles.btnCompact,
        {
          bottom,
          paddingBottom: bottom + (compact ? 6 : 12),
        },
      ]}
    >
      <Text style={[styles.btnText, compact && styles.btnTextCompact, disabled && styles.btnTextDisabled]}>
        {label}
      </Text>
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
  btnBase: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnInline: {
    width: "55%",
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  btnCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  btnTextCompact: { fontSize: 14, fontWeight: "600" },
  btnTextDisabled: { opacity: 0.6 },
});
