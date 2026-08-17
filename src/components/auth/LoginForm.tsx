"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { loginAction, type ActionState } from "@/modules/auth/actions";
import styles from "@/app/[locale]/auth/auth.module.scss";

const initial: ActionState = { status: "idle" };

export function LoginForm({ locale }: { locale: Locale }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(
    loginAction.bind(null, locale),
    initial,
  );

  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <form className={styles.form} action={action} noValidate>
      {state.status === "error" && !Object.keys(fields).length && (
        <p className={styles.noticeError}>{t(state.message)}</p>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          {t("email")}
        </label>
        <input
          className={fields.email ? styles.inputError : styles.input}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {fields.email && <span className={styles.fieldError}>{t(fields.email)}</span>}
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          {t("password")}
        </label>
        <input
          className={fields.password ? styles.inputError : styles.input}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {fields.password && (
          <span className={styles.fieldError}>{t(fields.password)}</span>
        )}
      </div>

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}
