import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Content Studio — LinkedIn drafts",
  description:
    "Turn trends into LinkedIn-ready posts. You copy & paste; nothing auto-posts.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
        <header className="sticky top-0 z-40 border-b border-zinc-200/90 bg-white/85 backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-950/85">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-bold tracking-tight text-white shadow-md shadow-sky-500/25"
              aria-hidden
            >
              CS
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Content Studio
                </span>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  LinkedIn draft assistant
                </span>
              </div>
              <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-500 sm:text-xs">
                Trends → your voice → you paste. Nothing auto-posts.
              </p>
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-zinc-200/80 bg-white/60 py-8 text-center dark:border-zinc-800/80 dark:bg-zinc-950/40">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Content Studio · assistive workflow · your keys, your content
          </p>
        </footer>
      </body>
    </html>
  );
}
