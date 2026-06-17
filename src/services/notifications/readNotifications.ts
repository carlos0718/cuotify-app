import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@cuotify_read_notifications';

export async function getReadIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export async function markAsRead(id: string): Promise<void> {
  try {
    const readIds = await getReadIds();
    readIds.add(id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds]));
  } catch {}
}

export async function markAllAsRead(ids: string[]): Promise<void> {
  try {
    const readIds = await getReadIds();
    ids.forEach((id) => readIds.add(id));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds]));
  } catch {}
}
