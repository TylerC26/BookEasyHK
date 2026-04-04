import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BookEasy HK | 智能預約系統',
  description: '專為香港小商戶而設的智能預約平台。繁體中文介面，WhatsApp 自動提醒，客人毋須下載 App。',
  keywords: '預約系統, 網上預約, 美容院預約, Hong Kong booking, appointment scheduling',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Sans+TC:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
