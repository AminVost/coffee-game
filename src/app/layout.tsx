import type { Metadata, Viewport } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { MotionProvider } from "@/components/motion-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: { default: "Coffee Game ستارخان", template: "%s | Coffee Game ستارخان" },
  description: "سامانه رزرو، قرعه‌کشی و مدیریت مسابقات FC 26 و تخته‌نرد",
  applicationName: "Coffee Game Satarkhan",
  appleWebApp: { capable: true, title: "Coffee Game" }
};

export const viewport: Viewport = {
  themeColor: "#07100c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <MotionProvider>
            <PwaRegister />
            {children}
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
