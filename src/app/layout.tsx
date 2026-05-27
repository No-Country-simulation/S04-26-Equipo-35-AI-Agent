import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@src/styles/tailwind.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dashboard Prototipo ConversaAI",
  description: "Panel de conversación y analítica ConversaAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`} data-scroll-behavior="smooth">
      <body className={`${inter.className} h-full overflow-hidden antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
