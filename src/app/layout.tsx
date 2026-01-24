import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Leonard Waugh | Senior Full-Stack Developer",
  description: "Senior Web Developer with 25+ years building and optimizing web applications. Expert in Angular, React, API design, and cloud architecture.",
  keywords: ["Full-Stack Developer", "React", "Angular", "TypeScript", "DevOps", "Portfolio"],
  authors: [{ name: "Leonard Waugh" }],
  openGraph: {
    title: "Leonard Waugh | Senior Full-Stack Developer",
    description: "Senior Web Developer with 25+ years building and optimizing web applications.",
    type: "website",
    locale: "en_US",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(11, 16, 40, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              color: '#EAF0FF',
            },
          }}
        />
      </body>
    </html>
  );
}
