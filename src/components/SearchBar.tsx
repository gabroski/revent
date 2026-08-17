"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/i18n/routing";
import { toSearchParams, type EventFilters } from "@/modules/discovery/filters";
import {
  EMPTY_SUGGESTIONS,
  MIN_QUERY_LENGTH,
  flattenSuggestions,
  totalSuggestions,
  type SuggestionGroups,
} from "@/modules/discovery/suggest";
import styles from "./SearchBar.module.scss";

type Props = {
  locale: Locale;
  /** Where filter changes navigate. Omit on the homepage, which has no list. */
  basePath: string;
  filters?: EventFilters;
  /** Shown beside the label once results are on the page. */
  resultCount?: number;
  autoFocus?: boolean;
};

export function SearchBar({
  locale,
  basePath,
  filters,
  resultCount,
  autoFocus,
}: Props) {
  const router = useRouter();
  const t = useTranslations("search");

  const [value, setValue] = useState(filters?.q ?? "");
  // Only fetched results live in state. Whether to show them is derived from the
  // current query, so a too-short query never needs a setState to clear them.
  const [fetched, setFetched] = useState<SuggestionGroups>(EMPTY_SUGGESTIONS);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const trimmed = value.trim();
  const longEnough = trimmed.length >= MIN_QUERY_LENGTH;
  const groups = longEnough ? fetched : EMPTY_SUGGESTIONS;
  const options = flattenSuggestions(groups);
  const hasSuggestions = totalSuggestions(groups) > 0;
  const committed = filters?.q ?? "";

  // Fetch suggestions as the user types. Aborting in-flight requests keeps a
  // slow earlier response from overwriting a newer one.
  useEffect(() => {
    if (!longEnough) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/suggest?q=${encodeURIComponent(value)}&locale=${locale}`,
          { signal: controller.signal },
        );
        if (res.ok) setFetched(await res.json());
      } catch {
        // Aborted or offline: leave the previous suggestions in place.
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, longEnough, locale]);

  // Commit the query to the URL, so results stay shareable and reloadable.
  useEffect(() => {
    if (value === committed) return;
    const timer = setTimeout(() => {
      const qs = toSearchParams({
        ...(filters ?? { when: "any", freeOnly: false }),
        q: value || undefined,
        cursor: undefined,
        citySlug: undefined,
      }).toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    }, 320);
    return () => clearTimeout(timer);
  }, [value, committed, filters, basePath, router]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function go(index: number) {
    const option = options[index];
    if (option) {
      setOpen(false);
      router.push(option.href);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!hasSuggestions) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + step + options.length) % options.length);
      return;
    }

    if (event.key === "Enter") {
      // Enter with a highlighted suggestion jumps to it; otherwise the typed
      // query stands on its own and the list below is already filtering.
      if (activeIndex >= 0) {
        event.preventDefault();
        go(activeIndex);
      } else {
        setOpen(false);
      }
    }
  }

  function clear() {
    setValue("");
    setFetched(EMPTY_SUGGESTIONS);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  const groupOrder: [keyof SuggestionGroups, string][] = [
    ["events", "groupEvents"],
    ["venues", "groupVenues"],
    ["categories", "groupCategories"],
  ];
  let flatIndex = -1;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={`${listboxId}-input`}>
          {t("label")}
        </label>
        {typeof resultCount === "number" && committed && (
          <span className={styles.count}>{t("count", { count: resultCount })}</span>
        )}
      </div>

      <div className={styles.field}>
        <span className={styles.prompt} aria-hidden="true">
          /
        </span>
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          className={styles.input}
          type="search"
          role="combobox"
          aria-expanded={open && hasSuggestions}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
          }
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={t("placeholder")}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {value && (
          <button type="button" className={styles.clear} onClick={clear} aria-label={t("clear")}>
            ✕
          </button>
        )}
      </div>

      {/* Announced as a phrase, not a bare number, and only when settled. */}
      <span className={styles.srOnly} role="status" aria-live="polite">
        {typeof resultCount === "number" && committed
          ? t("count", { count: resultCount })
          : ""}
      </span>

      {open && longEnough && (
        <div className={styles.panel} id={listboxId} role="listbox">
          {!hasSuggestions ? (
            <p className={styles.hint}>{t("noMatches", { query: trimmed })}</p>
          ) : (
            groupOrder.map(([key, labelKey]) =>
              groups[key].length === 0 ? null : (
                <div key={key}>
                  <div className={styles.groupLabel}>{t(labelKey)}</div>
                  {groups[key].map((option) => {
                    flatIndex += 1;
                    const index = flatIndex;
                    return (
                      <button
                        key={`${option.kind}-${option.href}`}
                        type="button"
                        id={`${listboxId}-opt-${index}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={
                          index === activeIndex ? styles.optionActive : styles.option
                        }
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => go(index)}
                      >
                        <span className={styles.optionLabel}>{option.label}</span>
                        {option.detail && (
                          <span className={styles.optionDetail}>{option.detail}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ),
            )
          )}
        </div>
      )}
    </div>
  );
}
