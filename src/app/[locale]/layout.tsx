import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Noto_Sans_Georgian, Noto_Serif_Georgian, Space_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import "@/styles/globals.scss";

// Every face that carries user content must cover Mkhedruli. A Latin-only face
// on a title is a bug, not a style choice.
const body = Noto_Sans_Georgian({
  subsets: ["georgian", "latin"],
  variable: "--font-body",
  display: "swap",
});

// Display: Georgian set large in a serif is the one typographic asset specific
// to this market. Used for headlines and event titles only.
const display = Noto_Serif_Georgian({
  subsets: ["georgian", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

// Utility: times, prices, counts, labels. Latin-only by design — it never
// renders user content, only data.
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Revent",
  description: "Events at restaurants, bars and clubs across Georgia.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html
      lang={locale}
      className={`${body.variable} ${display.variable} ${mono.variable}`}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
