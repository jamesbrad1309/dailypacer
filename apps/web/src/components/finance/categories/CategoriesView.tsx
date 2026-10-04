import { useMutation, useQuery } from "@apollo/client/react";
import { ArrowRight, Pencil, Plus, Trash2, Wand2 } from "lucide-react";
import { type FormEvent, useDeferredValue, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryDialog } from "#components/finance/categories/CategoryDialog";
import { ListSkeleton } from "#components/layout/Skeletons";
import { Button } from "#components/ui/button";
import { Card } from "#components/ui/card";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import {
  APPLY_PAYEE_RULES_MUTATION,
  CREATE_PAYEE_RULE_MUTATION,
  DELETE_PAYEE_RULE_MUTATION,
  MANAGE_CATEGORIES_QUERY,
  PAYEE_RULES_QUERY,
  PAYEE_RULE_MATCH_COUNT_QUERY,
  TRANSACTIONS_REFETCH,
  UPDATE_PAYEE_RULE_MUTATION,
} from "#graphql/finance";
import type { Category, PayeeRule } from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { categoryTree, treeLabel } from "#lib/categories";
import { toast } from "#lib/toast";
import { cn } from "#lib/utils";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * The user's categories, nested one level and grouped by kind, with their
 * own colours and emoji; archived ones below. Then payee rules: patterns
 * that file a payee into a category automatically.
 */
export function CategoriesView() {
  const { t } = useTranslation();
  const { data, loading, error } = useQuery<{ categories: Category[] }>(MANAGE_CATEGORIES_QUERY);
  const [dialog, setDialog] = useState<{ category?: Category } | null>(null);

  if (loading && !data) return <ListSkeleton rows={6} />;
  if (error) return <p className="text-destructive">{error.message}</p>;
  const all = data?.categories ?? [];
  const active = all.filter((c) => !c.archivedAt);
  const archived = all.filter((c) => c.archivedAt);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{t("finance.categoriesPage.title")}</h2>
          <Button size="sm" className="ml-auto" onClick={() => setDialog({})}>
            <Plus className="size-4" /> {t("finance.categoriesPage.newCategory")}
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {(["expense", "income"] as const).map((kind) => (
            <CategoryList
              key={kind}
              title={t(`finance.categoriesPage.${kind}Plural`)}
              categories={active.filter((c) => c.kind === kind)}
              onEdit={(category) => setDialog({ category })}
            />
          ))}
        </div>
        {archived.length > 0 && (
          <CategoryList
            title={t("finance.categoriesPage.archived")}
            categories={archived}
            onEdit={(category) => setDialog({ category })}
            muted
          />
        )}
      </section>

      <PayeeRules categories={active} />

      <CategoryDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        category={dialog?.category}
        all={all}
      />
    </div>
  );
}

function CategoryList({
  title,
  categories,
  onEdit,
  muted,
}: {
  title: string;
  categories: Category[];
  onEdit: (category: Category) => void;
  muted?: boolean;
}) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  return (
    <Card className={cn("overflow-hidden", muted && "opacity-75")}>
      <h3 className="border-b px-4 py-2.5 text-sm font-medium">{title}</h3>
      <ul className="divide-y">
        {categoryTree(categories).map(({ category, depth }) => (
          <li
            key={category.id}
            className={cn("flex items-center gap-3 py-2 pr-2", depth ? "pl-10" : "pl-4")}
          >
            <span aria-hidden className="w-5 text-center">
              {category.icon}
            </span>
            {category.color && (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">{categoryName(category)}</span>
            {category.aliases.length > 0 && (
              <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:block">
                {category.aliases.join(", ")}
              </span>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={t("finance.categoriesPage.editCategory", {
                name: categoryName(category),
              })}
              onClick={() => onEdit(category)}
            >
              <Pencil className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface RuleForm {
  pattern: string;
  categoryId: string;
  error: string | null;
}

type RuleAction =
  | { type: "pattern"; pattern: string }
  | { type: "category"; categoryId: string }
  | { type: "error"; message: string | null }
  | { type: "added" };

function ruleReducer(state: RuleForm, action: RuleAction): RuleForm {
  switch (action.type) {
    case "pattern":
      return { ...state, pattern: action.pattern, error: null };
    case "category":
      return { ...state, categoryId: action.categoryId, error: null };
    case "error":
      return { ...state, error: action.message };
    case "added":
      return { pattern: "", categoryId: state.categoryId, error: null };
  }
}

/**
 * Payee rules, tried in order before payee history when quick log or a CSV
 * import files a transaction. Adding one shows how many transactions in
 * "To review" it would file; "Apply rules" files them.
 */
function PayeeRules({ categories }: { categories: Category[] }) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const { data } = useQuery<{ payeeRules: PayeeRule[] }>(PAYEE_RULES_QUERY);
  const rules = data?.payeeRules ?? [];
  const [form, dispatch] = useReducer(ruleReducer, { pattern: "", categoryId: "", error: null });
  const pattern = useDeferredValue(form.pattern.trim());
  const { data: countData } = useQuery<{ payeeRuleMatchCount: number }>(
    PAYEE_RULE_MATCH_COUNT_QUERY,
    { variables: { pattern }, skip: pattern.replace(/\*/g, "").length < 2 },
  );
  const options = { refetchQueries: ["PayeeRules"], awaitRefetchQueries: true };
  const [createRule, creating] = useMutation(CREATE_PAYEE_RULE_MUTATION, options);
  const [updateRule] = useMutation(UPDATE_PAYEE_RULE_MUTATION, options);
  const [deleteRule] = useMutation(DELETE_PAYEE_RULE_MUTATION, options);
  const [applyRules, applying] = useMutation<{ applyPayeeRules: number }>(
    APPLY_PAYEE_RULES_MUTATION,
    { refetchQueries: [...TRANSACTIONS_REFETCH, "PayeeRuleMatchCount"] },
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    if (form.pattern.replace(/\*/g, "").trim().length < 2) {
      return dispatch({ type: "error", message: t("finance.rules.patternTooShort") });
    }
    if (!form.categoryId) {
      return dispatch({ type: "error", message: t("finance.rules.chooseCategory") });
    }
    try {
      await createRule({
        variables: { input: { pattern: form.pattern.trim(), categoryId: form.categoryId } },
      });
      dispatch({ type: "added" });
    } catch (err) {
      dispatch({ type: "error", message: err instanceof Error ? err.message : null });
    }
  }

  async function apply() {
    const result = await applyRules();
    toast(t("finance.rules.applied", { count: result.data?.applyPayeeRules ?? 0 }));
  }

  const choices = categoryTree(categories);
  const matchCount =
    pattern.replace(/\*/g, "").length >= 2 ? countData?.payeeRuleMatchCount : undefined;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="payee-rules">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 id="payee-rules" className="text-lg font-semibold">
            {t("finance.rules.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("finance.rules.hint")}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={rules.length === 0 || applying.loading}
          onClick={apply}
        >
          <Wand2 className="size-4" /> {t("finance.rules.apply")}
        </Button>
      </div>

      <Card className="overflow-hidden">
        {rules.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t("finance.rules.empty")}
          </p>
        ) : (
          <ol className="divide-y">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {rule.pattern}
                </code>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                <select
                  aria-label={t("finance.rules.categoryFor", { pattern: rule.pattern })}
                  className={cn(selectClass, "h-8 w-auto min-w-40 flex-1")}
                  value={rule.category.id}
                  onChange={(e) =>
                    updateRule({
                      variables: {
                        id: rule.id,
                        input: { pattern: rule.pattern, categoryId: e.target.value },
                      },
                    })
                  }
                >
                  {choices.map(({ category, depth }) => (
                    <option key={category.id} value={category.id}>
                      {treeLabel(depth, `${category.icon ?? ""} ${categoryName(category)}`.trim())}
                    </option>
                  ))}
                </select>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label={t("finance.rules.delete", { pattern: rule.pattern })}
                  onClick={() => deleteRule({ variables: { id: rule.id } })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ol>
        )}

        <form
          onSubmit={add}
          className="flex flex-wrap items-end gap-2 border-t bg-muted/30 px-4 py-3"
        >
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <Label htmlFor="rule-pattern">{t("finance.rules.pattern")}</Label>
            <Input
              id="rule-pattern"
              value={form.pattern}
              maxLength={100}
              placeholder="TESCO*"
              aria-describedby="rule-pattern-hint"
              className="font-mono"
              onChange={(e) => dispatch({ type: "pattern", pattern: e.target.value })}
            />
          </div>
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <Label htmlFor="rule-category">{t("finance.rules.category")}</Label>
            <select
              id="rule-category"
              className={selectClass}
              value={form.categoryId}
              onChange={(e) => dispatch({ type: "category", categoryId: e.target.value })}
            >
              <option value="" disabled>
                {t("common.choose")}
              </option>
              {choices.map(({ category, depth }) => (
                <option key={category.id} value={category.id}>
                  {treeLabel(depth, `${category.icon ?? ""} ${categoryName(category)}`.trim())}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={creating.loading}>
            <Plus className="size-4" /> {t("finance.rules.add")}
          </Button>
          <p
            id="rule-pattern-hint"
            className="w-full text-xs text-muted-foreground"
            aria-live="polite"
          >
            {matchCount !== undefined
              ? t("finance.rules.matches", { count: matchCount })
              : t("finance.rules.patternHint")}
          </p>
          {form.error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {form.error}
            </p>
          )}
        </form>
      </Card>
    </section>
  );
}
