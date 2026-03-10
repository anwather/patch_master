import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Patch Master - Azure Update Manager Scheduler",
  description:
    "Configure maintenance schedules and generate Terraform for Azure Update Manager",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
