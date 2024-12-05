import { UserProvider } from '@auth0/nextjs-auth0/client';
import { ThemeProvider } from 'next-themes';
import { Alex_Brush } from "next/font/google";
import "./globals.css";

const alexBrush = Alex_Brush({
  weight: "400",
  variable: "--font-alex-brush",
  subsets: ["latin"],
});

export const metadata = {
  title: "Shorts",
  description: "TODO !",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${alexBrush.variable} antialiased`}
      >
        <UserProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </UserProvider>
      </body>
    </html>
  );
}