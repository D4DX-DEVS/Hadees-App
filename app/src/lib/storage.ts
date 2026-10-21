import AsyncStorage from '@react-native-async-storage/async-storage';

/** JSON wrapper around AsyncStorage (localStorage on web). Never throws. */
export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? ({ ...fallbackShape(fallback), ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function fallbackShape<T>(f: T) {
  return Array.isArray(f) || typeof f !== 'object' || f === null ? {} : f;
}

export async function loadList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function save(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / unavailable: keep in-memory state only
  }
}
