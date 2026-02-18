/**
 * Redirect: /admin → /(tabs)/admin
 * PR-NEXT-01: Admin UI moved to (tabs)/admin
 */
import { Redirect } from "expo-router";

export default function AdminRedirect() {
  return <Redirect href="/(tabs)/admin" />;
}
