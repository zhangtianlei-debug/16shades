'use client';

import { useEffect } from 'react';
import { characters } from '@/app/data';
import { useI18n } from '@/app/i18n/provider';
import { characterArtworkSrc } from '@/app/prototype/character-artwork';
import { aboutSearchTitle } from '@/app/search/titles.mjs';
import { SharedHeader } from '@/components/shared-header';
import { siteContact } from '@/app/site-contact';
import './about.css';

export default function AboutPage() {
  const { locale, t, href, asset } = useI18n();

  useEffect(() => {
    document.title = aboutSearchTitle(locale);
  }, [locale]);

  return (
    <main className="about-page">
      <SharedHeader current="about" />

      <section className="about-hero" aria-labelledby="about-title">
        <p className="about-kicker">ABOUT / 16 SHADES</p>
        <h1 id="about-title">{t('每个人，')}<em>{t('都不止一面。')}</em></h1>
        <p className="about-subtitle">{t('用16种策略画像，读懂日常选择里的另一面。')}<br />{t('也让形成这些画像的规则，有迹可循。')}</p>
        <div className="about-jumps" aria-label={t('本页内容')}>
          <a href="#project">{t('认识这个项目')} <span aria-hidden="true">↓</span></a>
          <a href="#openness">{t('开放资料')} <span aria-hidden="true">↓</span></a>
        </div>

        <div className="about-cast-region" aria-label={t('16个人物剪影，向左或向右滑动后点击查看人物资料')}>
          <ul className="about-cast">
            {characters.map((character) => {
              return (
                <li key={character.id}>
                  <a className="about-cast-item" href={href(`/prototype/types/${character.slug}`)} aria-label={t(`查看人物资料：${character.name}`)}>
                    {/* oxlint-disable-next-line next/no-img-element -- Local SVG silhouettes must remain unmodified artwork. */}
                    <img src={asset(characterArtworkSrc(character.id))} alt="" draggable={false} />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="about-cast-caption">16 CHARACTERS / {t('每个人物都是一组策略参照，不是对任何人的判定。')}</p>
      </section>

      <section className="about-project" id="project" aria-labelledby="project-title">
        <div>
          <p className="about-section-kicker">01 / {t('关于这个项目')}</p>
          <h2 id="project-title">{t('一个人物，')}<br />{t('是一面镜子。')}</h2>
        </div>
        <div className="about-prose">
          <p>{t('16暗影把你面对分歧、利益和规则时的选择，整理成16个人物。你可以觉得像，也可以保留意见。')}</p>
          <p>{t('先回答16道情境题，看看与你接近的人物。想了解更多，可以再答32题，或直接翻看人物介绍。')}</p>
        </div>
      </section>

      <section className="about-principles" aria-label={t('项目原则')}>
        <div><strong>{t('看见倾向')}</strong><p>{t('描述你在意什么、怎样行动，也说明哪些地方还不确定。')}</p></div>
        <div><strong>{t('不替你定性')}</strong><p>{t('类型不是好坏判决，也不用于心理诊断。')}</p></div>
        <div><strong>{t('免费，无广告')}</strong><p>{t('答题和完整解读无需注册。账号只用于保存和回看结果。')}</p></div>
      </section>

      <section className="about-openness" id="openness" aria-labelledby="openness-title">
        <div className="about-section-top">
          <div>
            <p className="about-section-kicker">02 / {t('开放资料')}</p>
            <h2 id="openness-title">{t('让规则，也站到光里。')}</h2>
          </div>
          <span className="about-status">{t('双语资料与网站代码已开放')}</span>
        </div>
        <p className="about-intro">{t('分类框架、160题、当前网站固定48题、计分参考实现与接入文档现已开放。你可以下载双语资料，查看代码，或在许可范围内继续创作。')}</p>
        <div className="about-materials">
          <Material number="01" title="分类框架与题库" detail="四条策略轴、16型映射与160道候选题。当前网站使用固定48题。" meta="中文 / English" />
          <Material number="02" title="计分规则与接入示例" detail="明确缺答、平分与边界，提供可以运行的参考实现与完整示例。" meta="JavaScript / Python" />
          <Material number="03" title="复验方法与引用资料" detail="保留版本身份、人工案例和期望输出，让同一输入能够重复核对。" meta="可重复验证" />
        </div>
        <div className="about-release">
          <span>{t('开放资料 v1.0.0 · 中文 / English · 含版本与复验说明')}</span>
          <div className="about-release-links">
            <a className="about-download" href="/open/16shades-open-1.0.0.zip" download>{t('下载双语资料包')}</a>
            <a href="https://github.com/zhangtianlei-debug/16shades-open" target="_blank" rel="noreferrer">{t('资料与参考实现')} ↗</a>
            <a href="https://github.com/zhangtianlei-debug/16shades" target="_blank" rel="noreferrer">{t('网站源码')} ↗</a>
          </div>
        </div>
      </section>

      <section className="about-licensing" id="licensing" aria-labelledby="licensing-title">
        <p className="about-section-kicker">03 / {t('许可与署名')}</p>
        <h2 id="licensing-title">{t('使用与许可')}</h2>
        <p className="about-intro">{t('代码与内容分别许可，允许在遵守各自条款的前提下使用、修改和再分发，包括商业使用。具体适用文件与第三方声明见各仓库。')}</p>
        <div className="about-permissions">
          <Permission title="网站自有代码与参考实现" status="MIT" detail="保留版权声明与许可全文。第三方依赖遵循各自许可证。" />
          <Permission title="分类说明、题库与文档" status="CC BY 4.0" detail="注明来源与许可链接，标注改动；不得暗示获得官方认可。" />
          <Permission title="人物、动画与品牌" status="单独管理" detail="人物图、动画、漫画与品牌不包含在上述开放许可中；使用以素材说明及单独授权为准。" />
        </div>
        <p className="about-license-note">{t('工程复验不等于心理测量验证；不同语言、不同随机表单的统计等值尚未验证。开放材料的使用范围，以对应版本的许可文件为准。')}</p>
        <p className="about-license-links"><a href="https://github.com/zhangtianlei-debug/16shades-open/blob/main/LICENSE.md" target="_blank" rel="noreferrer">{t('完整许可与适用范围')} ↗</a></p>
        <p className="about-attribution">{t('署名示例：来源：16暗影 / 16 Shades（shades16.com），开放资料 v1.0.0，CC BY 4.0；如有修改，请说明修改内容。')}</p>
      </section>

      <footer className="about-footer">
        <span>{t('运营者')}：{siteContact.operator}</span>
        <a href={href('/prototype')}>{t('首页')}</a>
        <a href={href('/explore')}>{t('内容目录')}</a>
        <a href={href('/privacy')}>{t('隐私政策与设置')}</a>
        <a href={`mailto:${siteContact.email}`}>{t('联系邮箱')}：{siteContact.email}</a>
        <a href={siteContact.icp.href} target="_blank" rel="noreferrer">{siteContact.icp.label}</a>
      </footer>
    </main>
  );
}

function Material({ number, title, detail, meta }: { number: string; title: string; detail: string; meta: string }) {
  const { t } = useI18n();
  return <article className="about-material">
    <span className="about-number" aria-hidden="true">{number}</span>
    <div><h3>{t(title)}</h3><p>{t(detail)}</p></div>
    <span className="about-meta">{t(meta)}</span>
  </article>;
}

function Permission({ title, status, detail }: { title: string; status: string; detail: string }) {
  const { t } = useI18n();
  return <article className="about-permission">
    <strong>{t(title)}</strong><span>{t(status)}</span><p>{t(detail)}</p>
  </article>;
}
