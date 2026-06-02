import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Feature Extractor",
  description: "Extract digital features, connectivity, and UI flows from video.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              video-feature-extractor
            </Link>
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-neutral-500 hover:underline"
            >
              API
            </a>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
