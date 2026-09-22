'use client';
import { useEffect } from 'react';
import { useI18n } from '@/app/i18n/provider';
import { SharedHeader } from '@/components/shared-header';


import { ArrowLeft, ArrowRight } from 'lucide-react';
import { siteContact } from '../site-contact';
import './openness.css';

const sections = [
  ['attitude', '我们的态度'],
  ['core', '题库、算法与分类逻辑'],
  ['personal', '人物与个人使用'],
  ['commercial', '商业使用与品牌'],
  ['status', '开放进展'],
] as const;

export default function OpennessPage() {
  const { t, tn, href } = useI18n();
  useEffect(() => { document.title = t('开放与使用说明｜16暗影'); }, [t]);

  return (
    <main className="openness-page" id="openness-top">
      <SharedHeader current="about" />
      <div className="openness-layout">
        <nav className="openness-breadcrumb" aria-label={t("当前位置")}>
          <a href={href("/prototype")}>{t("首页")}</a>
          <span>/</span>
          <a href={href("/prototype#about")}>{t("关于16暗影")}</a>
          <span>/</span>
          <span aria-current="page">{t("开放与使用说明")}</span>
        </nav>
        <div className="openness-heading">
          <p className="openness-label">{t("关于这个项目")}</p>
          <h1>{t("开放与使用说明")}</h1>
          <p>{t("关于我们愿意分享什么，以及如何尊重彼此的创作。")}</p>
        </div>
        <div className="openness-body">
          <nav className="openness-directory" aria-label={t("本页目录")}>
            <span>{t("本页内容")}</span>
            {(sections.map(([id, label]) => (
              <a key={id} href={href(`#${id}`)}>
                {tn(label)}
              </a>
            )))}
          </nav>
          <article className="openness-article">
            <section id="attitude" aria-labelledby="attitude-title">
              <span className="openness-number" aria-hidden="true">
                01
              </span>
              <h2 id="attitude-title">{t("我们愿意把思路分享出来。")}</h2>
              <p>
                {t("16暗影希望成为一个能被理解、被讨论，也能不断完善的项目。我们愿意公开形成画像的基本思路，让对它感兴趣的人可以看清规则，提出不同意见，或在此基础上继续探索。 ")}</p>
              <p>{t("开放是我们对这个项目的态度，也是一种长期的工作方式。")}</p>
            </section>
            <section id="core" aria-labelledby="core-title">
              <span className="openness-number" aria-hidden="true">
                02
              </span>
              <h2 id="core-title">{t("题库、算法与分类逻辑")}</h2>
              <p>
                {t("我们计划开放题库、计分算法、分类逻辑及必要说明，让这些内容可以被阅读、研究、复现和改进。 ")}</p>
              <p>
                {t("具体开放范围、可使用的方式和需要保留的署名，将随相应资料与许可证一同说明。使用时，请以对应版本的正式许可为准。 ")}</p>
            </section>
            <section id="personal" aria-labelledby="personal-title">
              <span className="openness-number" aria-hidden="true">
                03
              </span>
              <h2 id="personal-title">{t("人物与个人使用")}</h2>
              <p>
                {t("我们希望你可以免费将喜欢的人物用于个人头像、壁纸等非商业的个人表达。具体使用范围，会在正式素材说明中列明。 ")}</p>
              <p>
                {t("人物形象、动画及其他原创视觉内容的权利由创作者持有。开放使用不意味着转让这些权利；后续的新造型与动画，也会单独明确权属与使用规则。 ")}</p>
            </section>
            <section id="commercial" aria-labelledby="commercial-title">
              <span className="openness-number" aria-hidden="true">
                04
              </span>
              <h2 id="commercial-title">{t("商业使用与品牌")}</h2>
              <p>
                {t("如果要将人物或相关视觉内容用于品牌宣传、商业产品、付费服务或商品，请事先取得相应授权。 ")}</p>
              <p>
                {t("题库或代码的开放许可，不自动包含人物形象、动画、Logo、“16暗影／十六暗影”名称或其他品牌标识的商业使用授权，也不意味着获得项目的官方认可。 ")}</p>
              <p>
                {t("有关具体使用的沟通，可以通过 ")}<a href={href(`mailto:${siteContact.email}`)}>{t("关于页面中的联系邮箱")}</a>
                {t("进行。 ")}</p>
            </section>
            <section id="status" aria-labelledby="status-title">
              <span className="openness-number" aria-hidden="true">
                05
              </span>
              <h2 id="status-title">{t("开放进展")}</h2>
              <p>
                {t("相关资料与使用规则正在整理。正式开放后，我们会在本页补充公开地址、版本信息和对应的许可文本。 ")}</p>
              <div className="openness-status">
                <span className="openness-status-dot" aria-hidden="true" />
                <div>
                  <strong>{t("资料整理中")}</strong>
                  <p>
                    {t("本页表达开放方向，具体权利义务以届时发布的正式许可或双方约定为准。 ")}</p>
                </div>
              </div>
            </section>
            <footer className="openness-bottom">
              <a href={href("/prototype#about")}>
                <ArrowLeft size={15} /> {t(" 返回关于16暗影 ")}</a>
              <a href={href("/prototype")}>
                {t("回到首页 ")}<ArrowRight size={15} />
              </a>
            </footer>
          </article>
        </div>
      </div>
    </main>
  );
}
