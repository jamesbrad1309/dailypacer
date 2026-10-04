import { useMutation, useQuery } from "@apollo/client/react";
import { Plus, Scissors, Trash2, X } from "lucide-react";
import { type FormEvent, type ReactNode, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoneyInput } from "#components/finance/MoneyInput";
import { Button } from "#components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#components/ui/dialog";
import { Input } from "#components/ui/input";
import { Label } from "#components/ui/label";
import {
  ACCOUNTS_QUERY,
  CATEGORIES_QUERY,
  CREATE_TRANSACTION_MUTATION,
  SET_TRANSACTION_SPLITS_MUTATION,
  TRANSACTIONS_REFETCH,
  UPDATE_TRANSACTION_MUTATION,
} from "#graphql/finance";
import type { AccountsData, Category, Transaction } from "#graphql/types";
import { useCategoryName } from "#hooks/useCategoryName";
import { categoryTree, treeLabel } from "#lib/categories";
import { todayIsoDate } from "#lib/dates";
import { formatMoney, parseMoneyInput, toMoneyInput } from "#lib/money";
import { formatTags, parseTags } from "#lib/tags";
import { cn } from "#lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this one; without it the form adds a new transaction. */
  transaction?: Transaction;
  /** Deletion is the list's job (it's undoable there). */
  onDelete?: () => void;
}

/** One part of a split, as typed: a category and a positive amount (the sign follows money in/out). */
interface SplitDraft {
  key: number;
  categoryId: string;
  amount: string;
}

interface Draft {
  income: boolean;
  amount: string;
  date: string;
  accountId: string;
  categoryId: string;
  payee: string;
  note: string;
  tags: string;
  pending: boolean;
  /** Split across categories: `parts` replace the single category. */
  split: boolean;
  parts: SplitDraft[];
  error: string | null;
}

type DraftAction =
  | { [K in keyof Draft]: { type: "set"; field: K; value: Draft[K] } }[keyof Draft]
  | { type: "reset"; draft: Draft }
  | { type: "kind"; income: boolean }
  | { type: "split"; on: boolean }
  | { type: "part"; key: number; field: "categoryId" | "amount"; value: string }
  | { type: "addPart" }
  | { type: "removePart"; key: number };

let nextPartKey = 1;
const emptyPart = (categoryId = "", amount = ""): SplitDraft => ({
  key: nextPartKey++,
  categoryId,
  amount,
});

function draftReducer(draft: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case "set":
      return { ...draft, [action.field]: action.value };
    case "reset":
      return action.draft;
    case "kind":
      // Categories are per kind, so switching clears every category picked.
      return {
        ...draft,
        income: action.income,
        categoryId: "",
        parts: draft.parts.map((p) => ({ ...p, categoryId: "" })),
      };
    case "split":
      // Starting a split carries the single category over as the first part.
      return {
        ...draft,
        split: action.on,
        parts: action.on
          ? draft.parts.length >= 2
            ? draft.parts
            : [emptyPart(draft.categoryId, draft.amount), emptyPart()]
          : draft.parts,
      };
    case "part":
      return {
        ...draft,
        parts: draft.parts.map((p) =>
          p.key === action.key ? { ...p, [action.field]: action.value } : p,
        ),
      };
    case "addPart":
      return { ...draft, parts: [...draft.parts, emptyPart()] };
    case "removePart":
      return { ...draft, parts: draft.parts.filter((p) => p.key !== action.key) };
  }
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50";

/**
 * The full form: any date, any account, payee, note and tags, and splitting
 * one transaction across categories (a supermarket receipt covering food
 * and household). Quick log covers the everyday case; this is for
 * corrections, splits and the odd back-dated entry.
 */
export function TransactionForm({ open, onOpenChange, transaction, onDelete }: Props) {
  const { t } = useTranslation();
  const categoryName = useCategoryName();
  const { data: accountsData } = useQuery<AccountsData>(ACCOUNTS_QUERY);
  const { data: categoriesData } = useQuery<{ categories: Category[] }>(CATEGORIES_QUERY);
  const accounts = accountsData?.accounts ?? [];
  const categories = categoriesData?.categories ?? [];

  const initial = (): Draft => {
    const txCurrency = transaction?.account.currency ?? "GBP";
    return {
      income: (transaction?.amountMinor ?? -1) > 0,
      amount: toMoneyInput(transaction ? Math.abs(transaction.amountMinor) : null, txCurrency),
      date: transaction?.date ?? todayIsoDate(),
      accountId: transaction?.account.id ?? accounts.find((a) => a.isDefault)?.id ?? "",
      categoryId: transaction?.category?.id ?? "",
      payee: transaction?.payee ?? "",
      note: transaction?.note ?? "",
      tags: formatTags(transaction?.tags ?? []),
      pending: transaction?.status === "PENDING",
      split: (transaction?.splits.length ?? 0) > 0,
      parts: (transaction?.splits ?? []).map((s) =>
        emptyPart(s.category.id, toMoneyInput(Math.abs(s.amountMinor), txCurrency)),
      ),
      error: null,
    };
  };
  const [draft, dispatch] = useReducer(draftReducer, undefined, initial);
  const error = draft.error;
  const setError = (message: string | null) =>
    dispatch({ type: "set", field: "error", value: message });

  // Reopening starts from the transaction as it is now.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) dispatch({ type: "reset", draft: initial() });
  }

  const options = { refetchQueries: TRANSACTIONS_REFETCH, awaitRefetchQueries: true };
  const [create, created] = useMutation<{ createTransaction: Transaction }>(
    CREATE_TRANSACTION_MUTATION,
    options,
  );
  const [update, updated] = useMutation(UPDATE_TRANSACTION_MUTATION, options);
  const [setSplits, splitting] = useMutation(SET_TRANSACTION_SPLITS_MUTATION, options);
  const saving = created.loading || updated.loading || splitting.loading;

  // Amounts are in the chosen account's currency.
  const currency = accounts.find((a) => a.id === draft.accountId)?.currency ?? "GBP";
  // Transfers and adjustments are generated: only their words are editable.
  const locked = transaction?.isTransfer || transaction?.source === "adjustment";
  const kind = draft.income ? "income" : "expense";
  const set = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    dispatch({ type: "set", field, value } as DraftAction);
  const sign = draft.income ? 1 : -1;
  const amount = parseMoneyInput(draft.amount, currency);
  const partsMinor = draft.parts.map((p) => parseMoneyInput(p.amount, currency) ?? 0);
  const unassigned = (amount ?? 0) - partsMinor.reduce((sum, n) => sum + n, 0);
  const choices = categoryTree(categories.filter((c) => c.kind === kind));

  /** The parts as the API takes them, or an error message. */
  function splitParts(): { categoryId: string; amountMinor: number }[] | string {
    if (draft.parts.length < 2) return t("finance.transactions.split.needTwo");
    if (draft.parts.some((p, i) => !p.categoryId || partsMinor[i] <= 0)) {
      return t("finance.transactions.split.incomplete");
    }
    if (unassigned !== 0) return t("finance.transactions.split.mustAddUp");
    return draft.parts.map((p, i) => ({
      categoryId: p.categoryId,
      amountMinor: sign * partsMinor[i],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!locked && !amount) return setError(t("finance.transactions.form.enterAmount"));
    if (!draft.accountId) return setError(t("finance.transactions.form.chooseAccount"));
    const parts = !locked && draft.split ? splitParts() : null;
    if (typeof parts === "string") return setError(parts);

    const words = {
      payee: draft.payee.trim() || null,
      note: draft.note.trim() || null,
      tags: parseTags(draft.tags),
      status: draft.pending ? "PENDING" : "CLEARED",
    };
    const input = locked
      ? words
      : {
          ...words,
          amountMinor: sign * (amount ?? 0),
          date: draft.date,
          accountId: draft.accountId,
          // Split: the parts say where it went (a category here would undo the split).
          ...(parts ? {} : { categoryId: draft.categoryId || null }),
        };
    const wasSplit = (transaction?.splits.length ?? 0) > 0;
    try {
      let id = transaction?.id;
      if (transaction) {
        // A split's amount can't change while split: undo it first, then re-split below.
        if (
          wasSplit &&
          parts &&
          "amountMinor" in input &&
          input.amountMinor !== transaction.amountMinor
        ) {
          await setSplits({ variables: { id: transaction.id, splits: [] } });
        }
        await update({ variables: { id: transaction.id, input } });
      } else {
        const result = await create({ variables: { input } });
        id = result.data?.createTransaction.id;
      }
      if (parts && id) await setSplits({ variables: { id, splits: parts } });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.couldntSave"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>
              {transaction
                ? t("finance.transactions.form.editTitle")
                : t("finance.transactions.form.addTitle")}
            </DialogTitle>
          </DialogHeader>

          {locked && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {transaction?.isTransfer
                ? t("finance.transactions.form.lockedTransfer")
                : t("finance.transactions.form.lockedAdjustment")}
            </p>
          )}

          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">{t("finance.transactions.form.moneyInOrOut")}</legend>
            {[
              { income: false, label: t("finance.transactions.form.expense") },
              { income: true, label: t("finance.transactions.form.income") },
            ].map((option) => (
              <Button
                key={option.label}
                type="button"
                disabled={locked}
                variant={draft.income === option.income ? "default" : "outline"}
                aria-pressed={draft.income === option.income}
                onClick={() => dispatch({ type: "kind", income: option.income })}
              >
                {option.label}
              </Button>
            ))}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("finance.transactions.form.amount")} id="tx-amount">
              <MoneyInput
                currency={currency}
                id="tx-amount"
                autoFocus={!transaction}
                disabled={locked}
                value={draft.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </Field>
            <Field label={t("finance.transactions.form.date")} id="tx-date">
              <Input
                id="tx-date"
                type="date"
                disabled={locked}
                max={todayIsoDate()}
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label={t("finance.transactions.form.account")} id="tx-account">
              <select
                id="tx-account"
                className={selectClass}
                disabled={locked}
                value={draft.accountId}
                onChange={(e) => set("accountId", e.target.value)}
              >
                <option value="" disabled>
                  {t("common.choose")}
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            {draft.split ? (
              <div className="flex flex-col justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => dispatch({ type: "split", on: false })}
                >
                  <X className="size-4" /> {t("finance.transactions.split.undo")}
                </Button>
              </div>
            ) : (
              <Field label={t("finance.transactions.form.category")} id="tx-category">
                <div className="flex gap-1.5">
                  <select
                    id="tx-category"
                    className={selectClass}
                    disabled={locked}
                    value={draft.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                  >
                    <option value="">
                      {locked ? categoryName(transaction?.category) : t("finance.toReview")}
                    </option>
                    {choices.map(({ category: c, depth }) => (
                      <option key={c.id} value={c.id}>
                        {treeLabel(depth, `${c.icon ?? ""} ${categoryName(c)}`.trim())}
                      </option>
                    ))}
                  </select>
                  {!locked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      aria-label={t("finance.transactions.split.start")}
                      title={t("finance.transactions.split.start")}
                      onClick={() => dispatch({ type: "split", on: true })}
                    >
                      <Scissors className="size-4" />
                    </Button>
                  )}
                </div>
              </Field>
            )}
            {draft.split && (
              <fieldset className="flex flex-col gap-2 rounded-md border p-3 sm:col-span-2">
                <legend className="px-1 text-sm font-medium">
                  {t("finance.transactions.split.title")}
                </legend>
                <p className="text-xs text-muted-foreground">
                  {t("finance.transactions.split.hint")}
                </p>
                {draft.parts.map((part, index) => (
                  <div key={part.key} className="flex items-center gap-1.5">
                    <select
                      aria-label={t("finance.transactions.split.partCategory", { n: index + 1 })}
                      className={selectClass}
                      value={part.categoryId}
                      onChange={(e) =>
                        dispatch({
                          type: "part",
                          key: part.key,
                          field: "categoryId",
                          value: e.target.value,
                        })
                      }
                    >
                      <option value="" disabled>
                        {t("common.choose")}
                      </option>
                      {choices.map(({ category: c, depth }) => (
                        <option key={c.id} value={c.id}>
                          {treeLabel(depth, `${c.icon ?? ""} ${categoryName(c)}`.trim())}
                        </option>
                      ))}
                    </select>
                    <div className="w-32 shrink-0">
                      <MoneyInput
                        currency={currency}
                        aria-label={t("finance.transactions.split.partAmount", { n: index + 1 })}
                        value={part.amount}
                        onChange={(e) =>
                          dispatch({
                            type: "part",
                            key: part.key,
                            field: "amount",
                            value: e.target.value,
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={t("finance.transactions.split.removePart", { n: index + 1 })}
                      disabled={draft.parts.length <= 2}
                      onClick={() => dispatch({ type: "removePart", key: part.key })}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={draft.parts.length >= 20}
                    onClick={() => dispatch({ type: "addPart" })}
                  >
                    <Plus className="size-4" /> {t("finance.transactions.split.addPart")}
                  </Button>
                  <p
                    aria-live="polite"
                    className={cn(
                      "text-xs tabular-nums",
                      unassigned === 0 ? "text-status-good" : "text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {unassigned === 0
                      ? t("finance.transactions.split.balanced")
                      : unassigned > 0
                        ? t("finance.transactions.split.left", {
                            amount: formatMoney(unassigned, currency),
                          })
                        : t("finance.transactions.split.over", {
                            amount: formatMoney(-unassigned, currency),
                          })}
                  </p>
                </div>
              </fieldset>
            )}
            <Field label={t("finance.transactions.form.payee")} id="tx-payee" optional>
              <Input
                id="tx-payee"
                autoComplete="off"
                value={draft.payee}
                onChange={(e) => set("payee", e.target.value)}
              />
            </Field>
            <Field label={t("finance.transactions.form.note")} id="tx-note" optional>
              <Input
                id="tx-note"
                autoComplete="off"
                value={draft.note}
                onChange={(e) => set("note", e.target.value)}
              />
            </Field>
            <Field
              label={t("finance.transactions.form.tags")}
              id="tx-tags"
              optional
              className="sm:col-span-2"
            >
              <Input
                id="tx-tags"
                autoComplete="off"
                placeholder={t("finance.transactions.form.tagsPlaceholder")}
                value={draft.tags}
                onChange={(e) => set("tags", e.target.value)}
              />
            </Field>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.pending}
              onChange={(e) => set("pending", e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <span>
              {t("finance.transactions.form.pending")}
              <span className="block text-xs text-muted-foreground">
                {t("finance.transactions.form.pendingHint")}
              </span>
            </span>
          </label>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className={cn(onDelete && "sm:justify-between")}>
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  onOpenChange(false);
                  onDelete();
                }}
              >
                <Trash2 className="size-4" /> {t("common.delete")}
              </Button>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {transaction ? t("common.save") : t("common.add")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  optional,
  className,
  children,
}: {
  label: string;
  id: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="flex items-baseline gap-1.5">
        {label}
        {optional && (
          <span className="text-xs font-normal text-muted-foreground">{t("common.optional")}</span>
        )}
      </Label>
      {children}
    </div>
  );
}
