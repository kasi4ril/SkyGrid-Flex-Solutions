import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SkyGrid Flex Solutions | Premium AI-Powered PAYGo Solar Energy Platform',
  description:
    'Discover reliable solar energy for your home or business with flexible payment plans, intelligent energy monitoring, and support you can trust.',
  keywords: [
    'PAYGo solar',
    'African solar energy',
    'Growatt hybrid inverter',
    'LiFePO4 battery',
    'Nigerian solar financing',
    'Clean energy',
  ],
  openGraph: {
    title: 'SkyGrid Flex Solutions | Premium PAYGo Solar Platform',
    description:
      'Power Your Life. Pay at Your Pace. Clean, reliable solar energy with 36-month lease-to-own and 24/7 AI telemetry.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B241B',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
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
