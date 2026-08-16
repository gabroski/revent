import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Noto_Sans_Georgian } from "next/font/google";
import { routing } from "@/i18n/routing";
import "@/styles/globals.scss";

// Must cover Mkhedruli. A Latin-only face here is a bug, not a style choice.
const font = Noto_Sans_Georgian({
  subsets: ["georgian", "latin"],
  variable: "--font-body",
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
    <html lang={locale} className={font.variable}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
