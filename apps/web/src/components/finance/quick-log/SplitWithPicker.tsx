import { useMutation } from "@apollo/client/react";
import { Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoneyInput } from "#components/finance/MoneyInput";
import { Button } from "#components/ui/button";
import { Input } from "#components/ui/input";
import { CREATE_ACCOUNT_MUTATION } from "#graphql/finance";
import { formatMoney } from "#lib/money";
import { type SplitDraft, splitShares } from "#lib/split-with";
import { cn } from "#lib/utils";

interface Person {
  id: string;
  name: string;
}

/**
 * "Split with…" under the quick-log amount: pick the people (IOU accounts)
 * on the bill, share it evenly or type each share. Your share is logged as
 * the expense; theirs is added to what they owe you.
 */
export function SplitWithPicker({
  draft,
  onChange,
  onClose,
  people,
  totalMinor,
  currency,
}: {
  draft: SplitDraft;
  onChange: (draft: SplitDraft) => void;
  onClose: () => void;
  /** IOU accounts in the bill's currency. */
  people: Person[];
  /** The whole bill; null until an amount is typed. */
  totalMinor: number | null;
  currency: string;
}) {
  const { t } = useTranslation();
  const [newName, setNewName] = useState("");
  const [createAccount, creating] = useMutation<{ createAccount: Person }>(
    CREATE_ACCOUNT_MUTATION,
    { refetchQueries: ["QuickLogContext", "Accounts"] },
  );
  const money = (minor: number) => formatMoney(minor, currency);
  const result = totalMinor ? splitShares(draft, totalMinor, currency) : null;
  const toggle = (id: string) =>
    onChange({
      ...draft,
      people: draft.people.includes(id)
        ? draft.people.filter((p) => p !== id)
        : [...draft.people, id],
    });

  /** A new person: an IOU account with nothing owed yet, picked straight away. */
  async function addPerson(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const { data } = await createAccount({
      variables: {
        input: { type: "IOU", name, currency, currentBalanceMinor: 0, owedByMe: false },
      },
    });
    if (data) onChange({ ...draft, people: [...draft.people, data.createAccount.id] });
    setNewName("");
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-md border p-3">
      <legend className="flex w-full items-center justify-between px-1 text-xs font-medium">
        {t("finance.splitWith.title")}
        <button
          type="button"
          onClick={onClose}
          aria-label={t("finance.splitWith.cancel")}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </legend>

      <div className="flex flex-wrap gap-1.5">
        {people.map((person) => {
          const on = draft.people.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(person.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {person.name}
            </button>
          );
        })}
        {/* Not a nested form: the sheet is already one. Enter adds the person. */}
        <span className="flex items-center gap-1">
          <Input
            value={newName}
            maxLength={80}
            placeholder={t("finance.splitWith.newPerson")}
            aria-label={t("finance.splitWith.newPerson")}
            className="h-7 w-32 text-xs"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void addPerson(e);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            disabled={!newName.trim() || creating.loading}
            aria-label={t("finance.splitWith.addPerson")}
            onClick={(e) => void addPerson(e)}
          >
            <Plus className="size-3.5" />
          </Button>
        </span>
      </div>

      {draft.people.length > 0 && (
        <>
          <div className="flex gap-1 text-xs">
            {([false, true] as const).map((custom) => (
              <button
                key={String(custom)}
                type="button"
                aria-pressed={draft.custom === custom}
                onClick={() => onChange({ ...draft, custom })}
                className={cn(
                  "rounded px-2 py-0.5",
                  draft.custom === custom ? "bg-muted font-medium" : "text-muted-foreground",
                )}
              >
                {custom ? t("finance.splitWith.custom") : t("finance.splitWith.evenly")}
              </button>
            ))}
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {draft.people.map((id) => {
              const name = people.find((p) => p.id === id)?.name ?? "";
              const share = result?.shares.find((s) => s.accountId === id)?.amountMinor ?? 0;
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{t("finance.splitWith.owes", { name })}</span>
                  {draft.custom ? (
                    <MoneyInput
                      currency={currency}
                      className="h-7 w-24 text-right"
                      aria-label={t("finance.splitWith.shareOf", { name })}
                      value={draft.amounts[id] ?? ""}
                      onChange={(e) =>
                        onChange({ ...draft, amounts: { ...draft.amounts, [id]: e.target.value } })
                      }
                    />
                  ) : (
                    <span className="tabular-nums">{totalMinor ? money(share) : "–"}</span>
                  )}
                </li>
              );
            })}
            <li className="flex items-center justify-between gap-2 border-t pt-1 font-medium">
              <span>{t("finance.splitWith.yours")}</span>
              <span className="tabular-nums">{result ? money(result.mineMinor) : "–"}</span>
            </li>
          </ul>
          {result?.problem && result.problem !== "noPeople" && (
            <p className="text-xs text-destructive">{t(`finance.splitWith.${result.problem}`)}</p>
          )}
        </>
      )}
    </fieldset>
  );
}
