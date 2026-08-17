"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { locales, type Locale } from "@/i18n/routing";
import { updateProfileAction, type ActionState } from "@/modules/auth/actions";
import styles from "@/app/[locale]/auth/auth.module.scss";

const initial: ActionState = { status: "idle" };

const LOCALE_LABEL: Record<Locale, string> = { ka: "ქართული", en: "English" };

export function ProfileForm({
  locale,
  displayName,
  preferredLocale,
}: {
  locale: Locale;
  displayName: string;
  preferredLocale: Locale;
}) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(
    updateProfileAction.bind(null, locale),
    initial,
  );

  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <form className={styles.form} action={action} noValidate>
      {state.status === "success" && <p className={styles.notice}>{t(state.message)}</p>}
      {state.status === "error" && !Object.keys(fields).length && (
        <p className={styles.noticeError}>{t(state.message)}</p>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="displayName">
          {t("name")}
        </label>
        <input
          className={fields.displayName ? styles.inputError : styles.input}
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          autoComplete="name"
          required
        />
        {fields.displayName && (
          <span className={styles.fieldError}>{t(fields.displayName)}</span>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="locale">
          {t("preferredLanguage")}
        </label>
        <select
          className={styles.input}
          id="locale"
          name="locale"
          defaultValue={preferredLocale}
        >
          {locales.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABEL[l]}
            </option>
          ))}
        </select>
      </div>

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? t("saving") : t("saveChanges")}
      </button>
    </form>
  );
}
