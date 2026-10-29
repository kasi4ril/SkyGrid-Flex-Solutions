import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Customer Self-Service & PAYGo Portal | SkyGrid Flex Solutions',
  description: 'Monitor real-time solar generation, LiFePO4 battery health, token status, and lease-to-own repayments.',
};

export default function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#0B241B] text-[#F8FAF7] antialiased">
        {children}
      </body>
    </html>
  );
}
