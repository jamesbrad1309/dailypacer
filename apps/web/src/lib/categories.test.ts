import { describe, expect, it } from "vitest";
import { categoryTree } from "#lib/categories";

const c = (id: string, parentId: string | null = null) => ({ id, parentId });

describe("categoryTree", () => {
  it("puts each subcategory right after its parent", () => {
    const tree = categoryTree([
      c("food"),
      c("bills"),
      c("eating-out", "food"),
      c("groceries", "food"),
    ]);
    expect(tree.map((n) => [n.category.id, n.depth])).toEqual([
      ["food", 0],
      ["eating-out", 1],
      ["groceries", 1],
      ["bills", 0],
    ]);
  });

  it("shows a subcategory at the top when its parent isn't in the list", () => {
    expect(categoryTree([c("coffee", "archived-parent")])).toEqual([
      { category: c("coffee", "archived-parent"), depth: 0 },
    ]);
  });
});
