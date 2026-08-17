"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { ActionState } from "@/modules/auth/actions";
import styles from "@/app/[locale]/auth/auth.module.scss";

const initial: ActionState = { status: "idle" };

type Field = {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
};

/**
 * Forgot-password and reset-password share a shape: a few fields, one action,
 * one confirmation message. One component rather than two near-identical files.
 */
export function SimpleAuthForm({
  action: serverAction,
  fields: formFields,
  submitLabel,
  pendingLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Field[];
  submitLabel: string;
  pendingLabel: string;
}) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(serverAction, initial);
  const errors = state.status === "error" ? (state.fields ?? {}) : {};

  if (state.status === "success") {
    return <p className={styles.notice}>{t(state.message)}</p>;
  }

  return (
    <form className={styles.form} action={action} noValidate>
      {state.status === "error" && !Object.keys(errors).length && (
        <p className={styles.noticeError}>{t(state.message)}</p>
      )}

      {formFields.map((field) => (
        <div className={styles.field} key={field.name}>
          <label className={styles.label} htmlFor={field.name}>
            {t(field.label)}
          </label>
          <input
            className={errors[field.name] ? styles.inputError : styles.input}
            id={field.name}
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            required
          />
          {errors[field.name] && (
            <span className={styles.fieldError}>{t(errors[field.name])}</span>
          )}
        </div>
      ))}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? t(pendingLabel) : t(submitLabel)}
      </button>
    </form>
  );
}
