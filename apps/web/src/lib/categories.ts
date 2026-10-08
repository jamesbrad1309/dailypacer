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
