/**
 * content:// safe file reader for Android (fetch(uri) fails on content://)
 * Uses expo-file-system for reliable byte loading.
 */
import * as FileSystem from "expo-file-system";

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
