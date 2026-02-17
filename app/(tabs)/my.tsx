import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { Card } from "../../src/components/ui/Card";
import { Screen } from "../../src/components/ui/Screen";
import { getMySummary, getMyEntitlement } from "../../src/services/my";
import { supabase } from "../../src/lib/supabase";

type MySummary = { storiesCount: number | null; songsCount: number | null; votesCount: number | null } | null;
type MyEntitlement = { status: string } | null;

export default function MyTabScreen() {
  const [summary, setSummary] = useState<MySummary>(null);
  const [entitlement, setEntitlement] = useState<MyEntitlement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const fn = async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const [s, e] = await Promise.all([getMySummary(token), getMyEntitlement(token)]);
      if (!alive) return;
      setSummary(s);
      setEntitlement(e);
      setLoaded(true);
    };
    void fn();
    return () => {
      alive = false;
    };
  }, []);

  const items = [
    {
      key: "my-stories",
      label: "내 사연",
      count: summary?.storiesCount,
    },
    {
      key: "my-submit",
      label: "내 제출곡",
      count: summary?.songsCount,
    },
    {
      key: "my-votes",
      label: "내 투표 기록",
      count: summary?.votesCount,
    },
    {
      key: "entitlement",
      label: "entitlement",
      count: null,
      entitlement,
    },
  ];

  return (
    <Screen title="마이" subcopy="내 활동">
      <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 12 }} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const isPlaceholder =
            item.key === "entitlement" ? entitlement === null : summary === null || item.count === null;
          const badge = isPlaceholder
            ? "준비중(스키마 확정 후 연동)"
            : item.key === "entitlement" && item.entitlement
              ? item.entitlement.status
              : typeof item.count === "number"
                ? `${item.count}건`
                : loaded
                  ? "0건"
                  : "-";

          return (
            <Card key={item.key}>
              <Text style={{ fontWeight: "600" }}>{item.label}</Text>
              <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{badge}</Text>
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
