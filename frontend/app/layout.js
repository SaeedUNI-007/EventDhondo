import "./globals.css";
import { Manrope, Sora } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata = {
  title: "EventDhundo | Campus Discovery",
  description: "Centralized campus event discovery platform",
  icons: {
    icon: '/Logo.png',
    shortcut: '/Logo.png',
    apple: '/Logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${manrope.variable} ${sora.variable}`}>
        {children}
      </body>
    </html>
  );
}