import { Direction } from "@/lib/interfaces";
import { AppState, storageKey, validateState } from "@/lib/state";

export function loadFromLocalStorage(direction: Direction): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(direction));
    if (!raw) return null;
    return validateState(JSON.parse(raw), direction);
  } catch {
    return null;
  }
}

export function saveToLocalStorage(direction: Direction, state: AppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(direction), JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
