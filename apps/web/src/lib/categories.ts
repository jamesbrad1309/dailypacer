/**
 * Category colours to pick from: mid-tone, so a dot of one reads on both
 * the light and the dark theme. Stored on the category as the hex value;
 * `key` names it for screen readers (`finance.categoriesPage.colors.<key>`).
 */
export const CATEGORY_COLORS = [
  { key: "red", hex: "#e5484d" },
  { key: "orange", hex: "#f76b15" },
  { key: "amber", hex: "#d6a10b" },
  { key: "green", hex: "#30a46c" },
  { key: "teal", hex: "#12a594" },
  { key: "blue", hex: "#3e63dd" },
  { key: "purple", hex: "#8e4ec6" },
  { key: "pink", hex: "#d6409f" },
  { key: "gray", hex: "#8b8d98" },
] as const;

interface TreeNode {
  id: string;
  parentId: string | null;
}

/**
 * Categories in picking order: each top-level one followed by its
 * subcategories ("Food", "  ↳ Eating out", "  ↳ Groceries"), keeping the
 * order they came in otherwise. A subcategory whose parent isn't in the
 * list (archived) is shown at the top level, so it never disappears.
 */
export function categoryTree<T extends TreeNode>(
  categories: readonly T[],
): { category: T; depth: 0 | 1 }[] {
  const ids = new Set(categories.map((c) => c.id));
  const isTop = (c: T) => !c.parentId || !ids.has(c.parentId);
  return categories
    .filter(isTop)
    .flatMap((parent) => [
      { category: parent, depth: 0 as const },
      ...categories
        .filter((c) => c.parentId === parent.id)
        .map((child) => ({ category: child, depth: 1 as const })),
    ]);
}

/** An <option> label that shows nesting: "Eating out" under its parent reads "  ↳ Eating out". */
export function treeLabel(depth: 0 | 1, label: string): string {
  return depth === 0 ? label : `  ↳ ${label}`;
}
