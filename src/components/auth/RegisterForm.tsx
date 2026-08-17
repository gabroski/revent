"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { registerAction, type ActionState } from "@/modules/auth/actions";
import { passwordStrength } from "@/modules/auth/schemas";
import styles from "@/app/[locale]/auth/auth.module.scss";

const initial: ActionState = { status: "idle" };

export function RegisterForm({ locale }: { locale: Locale }) {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [state, action, pending] = useActionState(
    registerAction.bind(null, locale),
    initial,
  );

  const strength = passwordStrength(password);
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  if (state.status === "success") {
    return (
      <div className={styles.notice}>
        <p>{t(state.message)}</p>
        <p>
          <Link className={styles.link} href={`/${locale}/auth/login`}>
            {t("toLogin")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} action={action} noValidate>
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
          autoComplete="name"
          required
        />
        {fields.displayName && (
          <span className={styles.fieldError}>{t(fields.displayName)}</span>
        )}
      </div>

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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className={styles.meter} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={
                i < strength
                  ? styles[`segmentOn${strength}` as keyof typeof styles]
                  : styles.segment
              }
            />
          ))}
        </div>
        <span className={styles.meterLabel}>
          {password ? t(`strength${strength}`) : t("passwordHint")}
        </span>
        {fields.password && (
          <span className={styles.fieldError}>{t(fields.password)}</span>
        )}
      </div>

      <label className={styles.checkRow}>
        <input className={styles.checkbox} type="checkbox" name="terms" value="on" />
        <span>{t("terms")}</span>
      </label>
      {fields.terms && <span className={styles.fieldError}>{t(fields.terms)}</span>}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? t("creating") : t("createAccount")}
      </button>
    </form>
  );
}
