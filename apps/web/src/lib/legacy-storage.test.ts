import { describe, expect, it } from "vitest";
import { migrateLegacyStorage } from "./legacy-storage";

function memoryStorage(entries: Record<string, string>): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
  };
}

describe("migrateLegacyStorage", () => {
  it("moves lifeos.* keys to dailypacer.* and leaves other keys alone", () => {
    const storage = memoryStorage({
      "lifeos.theme": '"dark"',
      "lifeos.language": "vi",
      other: "1",
    });
    migrateLegacyStorage(storage);
    expect(storage.getItem("dailypacer.theme")).toBe('"dark"');
    expect(storage.getItem("dailypacer.language")).toBe("vi");
    expect(storage.getItem("lifeos.theme")).toBeNull();
    expect(storage.getItem("other")).toBe("1");
  });

  it("keeps a value already saved under the new key", () => {
    const storage = memoryStorage({ "lifeos.theme": '"dark"', "dailypacer.theme": '"light"' });
    migrateLegacyStorage(storage);
    expect(storage.getItem("dailypacer.theme")).toBe('"light"');
    expect(storage.getItem("lifeos.theme")).toBeNull();
  });
});
