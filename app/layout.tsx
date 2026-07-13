import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ServiceWorkerRegister } from "./sw-register";

export const metadata: Metadata = {
  title: "Rues (ឫស)",
  description: "Rues — meaning 'root' in Khmer. Track developers and their projects, linked together, exportable to Obsidian.",
  applicationName: "Rues",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rues"
  },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon-192.png" }]
  },
  openGraph: {
    title: "Rues (ឫស)",
    description: "Rues — meaning 'root' in Khmer. Track developers and their projects, linked together, exportable to Obsidian.",
    type: "website"
  }
};

export const viewport: Viewport = {
  themeColor: "#0D1117",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('devtrack-theme');if(t){document.documentElement.dataset.theme=t;}else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches){document.documentElement.dataset.theme='light';}}catch(e){}})();`
          }}
        />
      </head>
      <body className="bg-[var(--bg)] text-[var(--text)]">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
