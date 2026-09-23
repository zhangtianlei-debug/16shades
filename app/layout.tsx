import type { Metadata } from 'next';
import Script from 'next/script';
import { prototypeHistoryBootstrap } from './prototype/history-bridge';
import { WechatShare } from '@/components/wechat-share';
import './globals.css';
import './i18n/i18n.css';
import { LanguageProvider } from './i18n/provider';
import { languageBootstrap } from './i18n/bootstrap';

export const metadata: Metadata = {
  title: '16暗面｜SIXTEEN SHADES',
  description: '16道日常情境题，解锁你在分歧、利益和规则面前更自然的暗面角色。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <Script id="shadow16-wechat-entry" strategy="beforeInteractive">{"window.shadow16WechatEntryUrl = window.location.href.split('#')[0];"}</Script>
        <Script id="shadow16-language" strategy="beforeInteractive">{languageBootstrap}</Script>
        <Script id="shadow16-prototype-history" strategy="beforeInteractive">
          {prototypeHistoryBootstrap}
        </Script>
        <Script src="/analytics.js" strategy="afterInteractive" />
      </head>
      <body>
        <LanguageProvider>
          {children}
          <WechatShare />
        </LanguageProvider>
      </body>
    </html>
  );
}
