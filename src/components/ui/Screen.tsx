import { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DARK = "#0f0f14";
const BG = "#14141f";

type TopBarProps = {
  title: string;
  subcopy?: string;
  onMenuPress?: () => void;
  onBackPress?: () => void;
};

export function TopBar({ title, subcopy, onMenuPress, onBackPress }: TopBarProps) {
  return (
    <View style={styles.topBar}>
      {onBackPress ? (
        <Pressable onPress={onBackPress} hitSlop={12} style={styles.menuBtn}>
          <Text style={styles.menuText}>←</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.topBarTitle}>{title}</Text>
        {subcopy ? <Text style={styles.topBarSubcopy}>{subcopy}</Text> : null}
      </View>
      {!onBackPress && onMenuPress ? (
        <Pressable onPress={onMenuPress} hitSlop={12} style={styles.menuBtn}>
          <Text style={styles.menuText}>≡</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StarPattern() {
  const dots = Array.from({ length: 60 }, (_, i) => ({
    left: (i * 17 + 3) % 98,
    top: (i * 23 + 7) % 95,
    size: (i % 3) + 1,
  }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d, i) => (
        <View
          key={i}
          style={[
            styles.starDot,
            {
              left: `${d.left}%`,
              top: `${d.top}%`,
              width: d.size,
              height: d.size,
              borderRadius: d.size / 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

type ScreenProps = {
  title?: string;
  subcopy?: string;
  onMenuPress?: () => void;
  onBackPress?: () => void;
  children: ReactNode;
  noTopBar?: boolean;
};

export function Screen({ title, subcopy, onMenuPress, onBackPress, children, noTopBar }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.starBg} />
      <StarPattern />
      {!noTopBar && title ? (
        <TopBar title={title} subcopy={subcopy} onMenuPress={onMenuPress} onBackPress={onBackPress} />
      ) : null}
      <View style={[styles.content, { paddingBottom: insets.bottom + (Platform.OS === "ios" ? 0 : 16) }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DARK },
  starBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
  },
  starDot: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topBarTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  topBarSubcopy: { fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  menuBtn: { padding: 8 },
  menuText: { fontSize: 20, color: "#fff", fontWeight: "300" },
  content: { flex: 1, paddingHorizontal: 20 },
});
