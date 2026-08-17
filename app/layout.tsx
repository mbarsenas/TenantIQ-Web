import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://tenantiq365.com"),
  title: {
    default: "TenantIQ | Microsoft 365 Tenant Intelligence",
    template: "%s | TenantIQ",
  },
  description:
    "TenantIQ provides automated, read-only Microsoft 365 tenant assessments with prioritized findings, risk insights, and actionable recommendations.",
  applicationName: "TenantIQ",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "TenantIQ",
    title: "TenantIQ | Microsoft 365 Tenant Intelligence",
    description:
      "Automated, read-only Microsoft 365 tenant assessments with prioritized findings, risk insights, and actionable recommendations.",
  },
  twitter: {
    card: "summary",
    title: "TenantIQ | Microsoft 365 Tenant Intelligence",
    description:
      "Automated, read-only Microsoft 365 tenant assessments with prioritized findings and actionable recommendations.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}><head><script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4250808865543637" crossOrigin="anonymous" /></head><body className="min-h-full flex flex-col">{children}</body></html>;
}
