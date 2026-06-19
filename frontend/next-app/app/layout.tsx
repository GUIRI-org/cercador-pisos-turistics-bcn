import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/bootstrap.scss";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elguiri.cat';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const canonicalUrl = `${siteUrl}${basePath}`;

export const metadata: Metadata = {
  metadataBase: new URL(canonicalUrl),
  title: "Cercador de pisos turístics Barcelona",
  description: "Identificar habitatges amb llicència turística a Barcelona. Cerca per adreça i consulta quins pisos de la teva escala tenen llicència turística.",
  openGraph: {
    title: "Cercador de pisos turístics Barcelona",
    description: "Identificar habitatges amb llicència turística a Barcelona. Cerca per adreça i consulta quins pisos de la teva escala tenen llicència turística.",
    url: canonicalUrl,
    siteName: "El Guiri",
    images: [
      {
        url: `${basePath}/.png`,
        width: 1200,
        height: 630,
        alt: "Barcelona Tourist Apartments – Cercador de pisos turístics",
        type: "image/png",
      },
    ],
    locale: "ca_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cercador de pisos turístics Barcelona",
    description: "Identificar habitatges amb llicència turística a Barcelona.",
    images: [`${basePath}/.png`],
  },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
