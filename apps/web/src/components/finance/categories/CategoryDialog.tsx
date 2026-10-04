import { useMutation } from "@apollo/client/react";
import { Archive, ArchiveRestore, Check } from "lucide-react";
import { type FormEvent, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import {
  CATEGORIES_REFETCH,
  CREATE_CATEGORY_MUTATION,
  UPDATE_CATEGORY_MUTATION,
} from "#graphql/finance";
import type { Category } from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { CATEGORY_COLORS } from "#lib/categories";
import { cn } from "#lib/utils";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this category; a new one when left out. */
  category?: Category;
  /** Every category of the user's, for picking a parent and spotting children. */
  all: Category[];
}

interface State {
  name: string;
  icon: string;
  color: string | null;
  kind: "expense" | "income";
  /** "" for top-level. */
  parentId: string;
  /** Comma-separated, as typed. */
  aliases: string;
  error: string | null;
}

type Action =
  | { [K in keyof State]: { type: "set"; field: K; value: State[K] } }[keyof State]
  | { type: "kind"; kind: State["kind"] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "kind":
      // A parent must be the same kind, so switching kind clears it.
      return { ...state, kind: action.kind, parentId: "" };
  }
}

function initialState(category: Category | undefined): State {
  return {
    name: category?.name ?? "",
    icon: category?.icon ?? "",
    color: category?.color ?? null,
    kind: category?.kind === "income" ? "income" : "expense",
    parentId: category?.parentId ?? "",
    aliases: category?.aliases.join(", ") ?? "",
    error: null,
  };
}

/**
 * A category's name, emoji, colour, parent and quick-log aliases, and
 * archiving it. Categories nest one level: a parent is a top-level category
 * of the same kind, and one with subcategories stays top-level.
 */
export function CategoryDialog({ open, onOpenChange, category, all }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CategoryForm
          key={category?.id ?? "new"}
          category={category}
          all={all}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function CategoryForm({
  category,
  all,
  onDone,
}: {
  category?: Category;
  all: Category[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const [state, dispatch] = useReducer(reducer, category, initialState);
  const set = <K extends keyof State>(field: K, value: State[K]) =>
    dispatch({ type: "set", field, value } as Action);
  const options = { refetchQueries: CATEGORIES_REFETCH, awaitRefetchQueries: true };
  const [createCategory, creating] = useMutation(CREATE_CATEGORY_MUTATION, options);
  const [updateCategory, updating] = useMutation(UPDATE_CATEGORY_MUTATION, options);

  const hasChildren = category ? all.some((c) => c.parentId === category.id) : false;
  const parents = all.filter(
    (c) => !c.parentId && !c.archivedAt && c.kind === state.kind && c.id !== category?.id,
  );
  const seeded = Boolean(category?.key);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!state.name.trim()) return set("error", t("finance.categoriesPage.nameRequired"));
    const fields = {
      name: state.name.trim(),
      icon: state.icon.trim() || null,
      color: state.color,
      parentId: state.parentId || null,
      aliases: state.aliases
        .split(",")
        .map((alias) => alias.trim().toLowerCase())
        .filter(Boolean),
    };
    try {
      if (category) {
        await updateCategory({ variables: { id: category.id, input: fields } });
      } else {
        await createCategory({ variables: { input: { ...fields, kind: state.kind } } });
      }
      onDone();
    } catch (err) {
      set("error", err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  async function toggleArchived() {
    if (!category) return;
    try {
      await updateCategory({
        variables: { id: category.id, input: { archived: !category.archivedAt } },
      });
      onDone();
    } catch (err) {
      set("error", err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  return (
    <DialogContent>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <DialogHeader>
          <DialogTitle>
            {category
              ? t("finance.categoriesPage.editTitle", { name: categoryName(category) })
              : t("finance.categoriesPage.newTitle")}
          </DialogTitle>
          <DialogDescription>{t("finance.categoriesPage.dialogHint")}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[4.5rem_1fr] gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-icon">{t("finance.categoriesPage.icon")}</Label>
            <Input
              id="category-icon"
              value={state.icon}
              maxLength={16}
              placeholder="🍽️"
              className="text-center"
              onChange={(e) => set("icon", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">{t("finance.categoriesPage.name")}</Label>
            <Input
              id="category-name"
              value={state.name}
              maxLength={60}
              placeholder={t("finance.categoriesPage.namePlaceholder")}
              onChange={(e) => set("name", e.target.value)}
            />
            {seeded && (
              <p className="text-xs text-muted-foreground">
                {t("finance.categoriesPage.seededHint")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p id="category-color" className="text-sm font-medium">
            {t("finance.categoriesPage.color")}
          </p>
          <div role="radiogroup" aria-labelledby="category-color" className="flex flex-wrap gap-2">
            <ColorSwatch
              label={t("finance.categoriesPage.noColor")}
              selected={state.color === null}
              onSelect={() => set("color", null)}
            />
            {CATEGORY_COLORS.map((color) => (
              <ColorSwatch
                key={color.key}
                hex={color.hex}
                label={t(`finance.categoriesPage.colors.${color.key}`)}
                selected={state.color?.toLowerCase() === color.hex}
                onSelect={() => set("color", color.hex)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-kind">{t("finance.categoriesPage.kind")}</Label>
            <select
              id="category-kind"
              className={selectClass}
              value={state.kind}
              disabled={Boolean(category)}
              onChange={(e) => dispatch({ type: "kind", kind: e.target.value as State["kind"] })}
            >
              <option value="expense">{t("finance.categoriesPage.expense")}</option>
              <option value="income">{t("finance.categoriesPage.income")}</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-parent">{t("finance.categoriesPage.parent")}</Label>
            <select
              id="category-parent"
              className={selectClass}
              aria-describedby={hasChildren ? "category-parent-hint" : undefined}
              value={state.parentId}
              disabled={hasChildren}
              onChange={(e) => set("parentId", e.target.value)}
            >
              <option value="">{t("finance.categoriesPage.topLevel")}</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.icon} {categoryName(parent)}
                </option>
              ))}
            </select>
            {hasChildren && (
              <p id="category-parent-hint" className="text-xs text-muted-foreground">
                {t("finance.categoriesPage.hasChildren")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="category-aliases">{t("finance.categoriesPage.aliases")}</Label>
          <Input
            id="category-aliases"
            value={state.aliases}
            aria-describedby="category-aliases-hint"
            placeholder={t("finance.categoriesPage.aliasesPlaceholder")}
            onChange={(e) => set("aliases", e.target.value)}
          />
          <p id="category-aliases-hint" className="text-xs text-muted-foreground">
            {t("finance.categoriesPage.aliasesHint")}
          </p>
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          {category ? (
            <Button
              type="button"
              variant="ghost"
              disabled={updating.loading}
              onClick={toggleArchived}
            >
              {category.archivedAt ? (
                <>
                  <ArchiveRestore className="size-4" /> {t("common.restore")}
                </>
              ) : (
                <>
                  <Archive className="size-4" /> {t("common.archive")}
                </>
              )}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onDone}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={creating.loading || updating.loading}>
              {category ? t("common.save") : t("finance.categoriesPage.create")}
            </Button>
          </div>
        </DialogFooter>
        {category && !category.archivedAt && hasChildren && (
          <p className="text-xs text-muted-foreground">
            {t("finance.categoriesPage.archiveChildren")}
          </p>
        )}
      </form>
    </DialogContent>
  );
}

/** A native radio (visually hidden) with the colour as its face, so arrow keys move between swatches. */
function ColorSwatch({
  hex,
  label,
  selected,
  onSelect,
}: {
  hex?: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label title={label} className="relative cursor-pointer">
      <input
        type="radio"
        name="category-color"
        className="peer sr-only"
        checked={selected}
        onChange={onSelect}
        aria-label={label}
      />
      <span
        aria-hidden
        className={cn(
          "flex size-8 items-center justify-center rounded-full border peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          selected && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
          !hex &&
            "bg-[repeating-linear-gradient(45deg,transparent_0_4px,var(--color-muted)_4px_8px)]",
        )}
        style={hex ? { backgroundColor: hex } : undefined}
      >
        {selected && <Check className={cn("size-4", hex ? "text-white" : "text-foreground")} />}
      </span>
    </label>
  );
}
