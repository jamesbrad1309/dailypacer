import { useMutation, useQuery } from "@apollo/client/react";
import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, FormError } from "#components/auth/AuthLayout";
import { Button } from "#components/ui/button";
import { ACCOUNTS_QUERY, CREATE_ACCOUNT_MUTATION, CURRENCY_SETTINGS_QUERY } from "#graphql/finance";
import type { AccountType } from "#graphql/types";
import { ACCOUNT_TYPES } from "#lib/account-types";
import { todayIsoDate } from "#lib/dates";
import { formatMoney, moneyPlaceholder, parseMoneyInput } from "#lib/money";

/** The kinds people spend from; loans and IOUs can be added later from Money. */
const STARTER_TYPES: AccountType[] = ["CURRENT", "SAVINGS", "CREDIT_CARD", "CASH"];

interface Accounts {
  accounts: {
    id: string;
    name: string;
    type: AccountType;
    currency: string;
    balanceMinor: number;
  }[];
}

/** Add one or more accounts with today's balance, in the main currency. */
export function AccountsStep({
  onDone,
  footer,
}: {
  onDone: () => void;
  footer: (actions: ReactNode) => ReactNode;
}) {
  const { t } = useTranslation();
  const { data } = useQuery<Accounts>(ACCOUNTS_QUERY);
  const { data: currencyData } = useQuery<{
    currencySettings: { currencies: { code: string; isMain: boolean }[] };
  }>(CURRENCY_SETTINGS_QUERY);
  const currency = currencyData?.currencySettings.currencies.find((c) => c.isMain)?.code ?? "GBP";
  const [createAccount, { loading }] = useMutation(CREATE_ACCOUNT_MUTATION, {
    refetchQueries: ["Accounts", "NetWorth"],
    awaitRefetchQueries: true,
  });
  const [type, setType] = useState<AccountType>("CURRENT");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const accounts = data?.accounts ?? [];

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("account-name") ?? "").trim();
    const balance = parseMoneyInput(String(form.get("account-balance") ?? "0") || "0", currency);
    if (!name) return setError(t("onboarding.accounts.nameRequired"));
    if (balance === null) return setError(t("onboarding.accounts.balanceInvalid"));
    setError(null);
    try {
      await createAccount({
        variables: {
          input: {
            name,
            type,
            currency,
            currentBalanceMinor: balance,
            openingBalanceDate: todayIsoDate(),
          },
        },
      });
      formRef.current?.reset();
    } catch {
      setError(t("onboarding.error"));
    }
  }

  const owed = ACCOUNT_TYPES[type].owed;

  return (
    <>
      <h2 className="text-lg font-semibold">{t("onboarding.accounts.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.accounts.body")}</p>

      <ul className="mt-4 divide-y rounded-lg border" aria-label={t("onboarding.accounts.added")}>
        {accounts.length === 0 && (
          <li className="px-3 py-3 text-sm text-muted-foreground">
            {t("onboarding.accounts.none")}
          </li>
        )}
        {accounts.map((account) => (
          <li
            key={account.id}
            className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span>
              <span className="font-medium">{account.name}</span>{" "}
              <span className="text-muted-foreground">
                · {t(`finance.accountTypes.${account.type}.label`)}
              </span>
            </span>
            <span className="tabular-nums">
              {formatMoney(account.balanceMinor, account.currency)}
            </span>
          </li>
        ))}
      </ul>

      <form
        ref={formRef}
        onSubmit={add}
        noValidate
        className="mt-4 grid gap-3 rounded-lg bg-muted/40 p-3"
      >
        <FormError message={error} />
        <fieldset>
          <legend className="text-sm font-medium">{t("onboarding.accounts.type")}</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {STARTER_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={type === option}
                onClick={() => setType(option)}
                className="rounded-full border px-3 py-1 text-sm aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
              >
                {t(`finance.accountTypes.${option}.label`)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="account-name"
            label={t("onboarding.accounts.name")}
            placeholder={t(`finance.accountTypes.${type}.namePlaceholder`)}
          />
          <Field
            id="account-balance"
            label={owed ? t("onboarding.accounts.owedBalance") : t("onboarding.accounts.balance")}
            inputMode="decimal"
            placeholder={moneyPlaceholder(currency)}
          />
        </div>
        <Button type="submit" variant="outline" disabled={loading} className="justify-self-start">
          {loading ? t("onboarding.accounts.adding") : t("onboarding.accounts.add")}
        </Button>
      </form>

      {footer(<Button onClick={onDone}>{t("onboarding.continue")}</Button>)}
    </>
  );
}
