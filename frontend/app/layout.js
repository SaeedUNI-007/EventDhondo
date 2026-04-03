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
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #eee' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
            <img src="/Logo.png" alt="Logo" style={{ height: 36 }} />
            <span style={{ fontWeight: 700 }}>EventDhundo</span>
          </a>

          {/* top-right nav cleared per request (no Dashboard / Events / Notifications / bell) */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* intentionally left empty to move navigation to sidebars */}
          </nav>
        </header>

        {children}
      </body>
    </html>
  );
}