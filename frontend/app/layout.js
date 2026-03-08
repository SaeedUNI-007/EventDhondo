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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable}`}>
        {children}
      </body>
    </html>
  );
}