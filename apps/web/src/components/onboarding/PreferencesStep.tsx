import { useMutation, useQuery } from "@apollo/client/react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#components/ui/button";
import {
  ADD_CURRENCY_MUTATION,
  CURRENCY_SETTINGS_QUERY,
  SET_MAIN_CURRENCY_MUTATION,
} from "#graphql/finance";
import { currentLanguage, LANGUAGES, type Language, setLanguage } from "#i18n/i18n";
import { allCurrencyCodes, currencyName } from "#lib/money";
import { toast } from "#lib/toast";
import { cn } from "#lib/utils";

interface CurrencySettings {
  currencySettings: { currencies: { code: string; isMain: boolean }[] };
}

/** Language (applies at once) and the main currency (saved on Continue). */
export function PreferencesStep({
  onDone,
  footer,
}: {
  onDone: () => void;
  footer: (actions: ReactNode) => ReactNode;
}) {
  const { t } = useTranslation();
  const { data } = useQuery<CurrencySettings>(CURRENCY_SETTINGS_QUERY);
  const currencies = data?.currencySettings.currencies ?? [];
  const main = currencies.find((c) => c.isMain)?.code ?? "GBP";
  const [chosen, setChosen] = useState<string | null>(null);
  const currency = chosen ?? main;
  const refetch = { refetchQueries: ["CurrencySettings", "Accounts"] };
  const [addCurrency] = useMutation(ADD_CURRENCY_MUTATION, refetch);
  const [setMain, { loading }] = useMutation(SET_MAIN_CURRENCY_MUTATION, refetch);
  const options = allCurrencyCodes()
    .map((code) => ({ code, name: currencyName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function save() {
    try {
      if (currency !== main) {
        if (!currencies.some((c) => c.code === currency)) {
          await addCurrency({ variables: { code: currency } });
        }
        await setMain({ variables: { code: currency } });
      }
      onDone();
    } catch {
      toast(t("onboarding.error"));
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold">{t("onboarding.preferences.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.preferences.body")}</p>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">{t("onboarding.preferences.language")}</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(Object.keys(LANGUAGES) as Language[]).map((language) => (
            <button
              key={language}
              type="button"
              lang={language}
              aria-pressed={currentLanguage() === language}
              onClick={() => setLanguage(language)}
              className={cn(
                "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
                currentLanguage() === language
                  ? "border-foreground bg-foreground/5 font-medium"
                  : "hover:bg-accent",
              )}
            >
              {LANGUAGES[language].label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-1.5">
        <label htmlFor="main-currency" className="text-sm font-medium">
          {t("onboarding.preferences.currency")}
        </label>
        <select
          id="main-currency"
          value={currency}
          onChange={(e) => setChosen(e.target.value)}
          aria-describedby="main-currency-hint"
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {options.map(({ code, name }) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
        </select>
        <p id="main-currency-hint" className="text-xs text-muted-foreground">
          {t("onboarding.preferences.currencyHint")}
        </p>
      </div>

      {footer(
        <Button onClick={save} disabled={loading || !data}>
          {loading ? t("onboarding.saving") : t("onboarding.continue")}
        </Button>,
      )}
    </>
  );
}
