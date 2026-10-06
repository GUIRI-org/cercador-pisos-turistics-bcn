import type { Metadata } from "next";
import "@/styles/bootstrap.scss";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ParallaxContainer } from "./components/ParallaxContainer";

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
        url: `${basePath}/og-image.png`,
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
    images: [`${basePath}/og-image.png`],
  },
  icons: {
    icon: [
      { url: `${basePath}/icon0.svg`, type: "image/svg+xml" },
      { url: `${basePath}/icon1.png`, type: "image/png" },
    ],
    apple: [{ url: `${basePath}/apple-icon.png` }],
  },
  appleWebApp: {
    title: "Apartament - El Guir",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ParallaxContainer>{children}</ParallaxContainer>
      </body>
    </html>
  );
}
