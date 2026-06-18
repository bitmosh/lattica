import type { TileSectionEntry, TileSectionRegistry } from "./types";

const entries: TileSectionEntry[] = [];
const listeners: Array<(entries: TileSectionEntry[]) => void> = [];

export const tileSectionRegistry: TileSectionRegistry = {
  list() {
    return [...entries];
  },

  getById(id: string) {
    return entries.find((e) => e.id === id);
  },

  filterByCategory(query: Partial<TileSectionEntry>) {
    return entries.filter((e) => {
      for (const key of Object.keys(query) as Array<keyof TileSectionEntry>) {
        if (e[key] !== (query as TileSectionEntry)[key]) return false;
      }
      return true;
    });
  },

  validateShape(entry: unknown): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (typeof entry !== "object" || entry === null) {
      return { valid: false, errors: ["entry must be an object"] };
    }
    const e = entry as Record<string, unknown>;
    for (const field of [
      "id",
      "label",
      "category",
      "defaultWidth",
      "defaultHeight",
      "collapsible",
      "defaultVisible",
      "defaultExpanded",
    ]) {
      if (e[field] === undefined) {
        errors.push(`missing required field: ${field}`);
      }
    }
    if (e["kind"] === "webview" && !e["webviewUrl"]) {
      errors.push(`entry "${String(e["id"])}" has kind="webview" but webviewUrl is absent`);
    }
    return { valid: errors.length === 0, errors: errors.length ? errors : undefined };
  },

  register(entry: TileSectionEntry): void {
    const { valid, errors } = tileSectionRegistry.validateShape(entry);
    if (!valid) {
      throw new Error(
        `tileSectionRegistry.register: invalid entry — ${errors?.join("; ")}`,
      );
    }
    entries.push(entry);
    listeners.forEach((l) => l([...entries]));
  },

  subscribe(listener: (entries: TileSectionEntry[]) => void): () => void {
    listeners.push(listener);
    return () => {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  },
};
