'use client';
import { useEffect } from 'react';
import { useI18n } from '@/app/i18n/provider';
import { T06_ARTWORK_REVISION } from '@/app/prototype/character-artwork';
import { siteContact } from '@/app/site-contact';

import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

import { SiteHeader } from '@/components/site-header';

const characterJpgSrc = (id: string) =>
  `/characters/${id}.jpg${id.toUpperCase() === 'T06' ? `?v=${T06_ARTWORK_REVISION}` : ''}`;

export default function WelcomePage() {
  const { t, asset, href } = useI18n();
  useEffect(() => { document.title = t('16暗面｜SIXTEEN SHADES'); }, [t]);

  return (
    <main className="app-shell">
      <SiteHeader />
      <section className="intro-layout">
        <div className="intro-copy">
          <div className="eyebrow"><Sparkles size={16} /> {t(" 16 道题 · 约 3 分钟")}</div>
          <h1>{t("事情失控时，")}<br /><em>{t("你会露哪面？")}</em></h1>
          <p className="intro-lead">
            {t("16 道日常情境题，拼出你在分歧、利益和规则面前最自然的反应，解锁你的专属暗面角色。 ")}</p>
          <div className="intro-actions">
            <a className="primary-link" href={href("/quiz/")}>
              {t("开始测试 ")}<ArrowRight size={18} />
            </a>
            <p><ShieldCheck size={16} /> {t(" 即测即出 · 答案只留在本机")}</p>
          </div>
        </div>

        <div className="portrait-stage" aria-label={t("部分角色预览")}>
          {(['t03', 't09', 't14'].map((id, index) => (
            <div className={`portrait portrait--${index + 1}`} key={id}>
              <img src={asset(characterJpgSrc(id))} alt={t("角色造型预览")} />
            </div>
          )))}
          <div className="stage-stamp">16<br /><span>SIXTEEN<br />SHADES</span></div>
        </div>

        <div className="intro-footnote">
          <strong>{t("怎么玩：")}</strong>{t("凭第一反应作答就好。拿不准，或者确实很看情况，放心选中间项。 ")}</div>
      </section>
      <footer style={{ textAlign: 'center', padding: '24px', fontSize: '14px' }}>
        <a href={href("/privacy")} target="_blank" rel="noopener">{t("隐私政策与设置")}</a>
        {' · '}
        <a href={siteContact.icp.href} target="_blank" rel="noreferrer">{siteContact.icp.label}</a>
      </footer>
    </main>
  );
}
