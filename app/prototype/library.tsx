'use client';
import { useI18n } from '@/app/i18n/provider';
import { useLayoutEffect, useRef } from 'react';
import { takeCharacterEntry } from './character-entry';
import './surface-motion.css';


import { ArrowRight, ChevronRight, Share2 } from 'lucide-react';
import Image from 'next/image';
import { characters, type Character } from '@/app/data';
import { AnimatedCharacter } from './animated-character';
import { characterArtworkSrc, familyClass } from './character-artwork';
import { axisContent } from './content';
import { axisKeys } from './scoring';
import { getCommunicationRole } from './social-content';
import { CharacterAbility } from './character-ability';
import { RoleStory } from './role-story';

// Illustrative situations, not assessment items or statements about a reader.
const principleExamples = {
  G: {
    situation: '一起做一个项目',
    left: '分成合适，方案由你定。',
    right: '分成可以少一点，最终方案由我定。',
  },
  M: {
    situation: '合作进度比预期慢',
    left: '我先安排信息和选项，让大家更容易接受我的方案。',
    right: '我直接说清期限，以及延期后会怎样调整分工。',
  },
  H: {
    situation: '对方已经补回了少付的款项',
    left: '款项补齐，这件事就到这里。',
    right: '款项补齐之外，我还希望对方为这次失误付出代价。',
  },
  N: {
    situation: '团队需要重新分工',
    left: '我们按事先约定、大家都理解的标准分配。',
    right: '这次先按我的判断分配，即使大家还没认同理由。',
  },
};

export { familyClass } from './character-artwork';
export function typeAxes(id: string) {
  const index = Number(id.slice(1)) - 1;
  return axisKeys.map((key, i) => ({
    key,
    positive: !!(index & [8, 4, 2, 1][i]),
    copy: axisContent[key],
  }));
}
export function TypeLibrary({
  openType,
  returnToTest,
}: {
  openType: (id: string) => void;
  returnToTest: () => void;
}) {
  const { t, tn, asset } = useI18n();

  return (
    <section className="proto-reading-page proto-library-page">
      <p className="proto-kicker">{t("THE SIXTEEN / 16型图鉴")}</p>
      <h1>
        {t("每个角色， ")}<br />
        <em>{t("都有自己的办法。")}</em>
      </h1>
      <p className="proto-reading-lead">
        {t("从感兴趣的人物开始，读懂他的选择、手段与行动逻辑。 ")}</p>
      <div className="proto-library-grid">
        {(characters.map((character) => (
          <button
            type="button"
            className={`proto-library-tile ${familyClass(character.id)}`}
            key={character.id}
            onClick={() => openType(character.id)}
            aria-label={t(`查看${character.name}的独立卡片`)}
          >
            <span className="proto-type-index">{tn(character.id)}</span>
            <Image
              src={asset(characterArtworkSrc(character.id))}
              alt={t(character.name)}
              width={512}
              height={512}
              unoptimized
            />
            <div>
              <h2>{tn(character.name)}</h2>
              <span>{tn(character.family)}</span>
              <ArrowRight size={19} />
            </div>
            <p>{tn(getCommunicationRole(character.id).tagline)}</p>
          </button>
        )))}
      </div>
      <button className="proto-primary" type="button" onClick={returnToTest}>
        {t("探索我的类型 ")}<ArrowRight size={18} />
      </button>
    </section>
  );
}
export function TypeCard({
  character,
  openType,
  openLibrary,
  openPrinciples,
  returnToTest,
  share,
}: {
  character: Character;
  openType: (id: string) => void;
  openLibrary: () => void;
  openPrinciples: () => void;
  returnToTest: () => void;
  share: () => void;
}) {
  const { t, tn } = useI18n();
  const storyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!takeCharacterEntry(character.id)) return;
    titleRef.current?.focus({ preventScroll: true });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = storyRef.current?.animate?.(
      [{ opacity: .92, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    return () => animation?.cancel();
  }, [character.id]);

  const index = Number(character.id.slice(1)) - 1;
  const next = characters[(index + 1) % 16];
  const communication = getCommunicationRole(character.id);
  return (
    <section
      className={`proto-reading-page proto-type-page ${familyClass(character.id)}`}
    >
      <nav className="proto-breadcrumb" aria-label={t("页面位置")}>
        <button type="button" onClick={openLibrary}>
          {t("16型图鉴 ")}</button>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{tn(character.name)}</span>
      </nav>
      <article className="proto-profile-card">
        <div className="proto-profile-portrait">
          <span className="proto-type-index">
            {tn(character.id)} / {tn(character.family)}
          </span>
          <div className="proto-portrait-stage">
            <AnimatedCharacter
              key={character.id}
              id={character.id}
              name={character.name}
              mode="result"
            />
          </div>
          <span className="proto-portrait-signature">
            {tn(character.structure.split('').join(' · '))}
          </span>
        </div>
        <div className="proto-profile-story" ref={storyRef}>
          <p className="proto-kicker">{t("人物卡 / ")}{tn(character.family)}</p>
          <h1 ref={titleRef} tabIndex={-1}>{tn(character.name)}</h1>
          <p className="proto-social-tagline">{tn(communication.tagline)}</p>
          <p className="proto-profile-quote">“{tn(communication.quote)}”</p>
          <div className="proto-profile-poles">
            {(typeAxes(character.id).map(({ key, positive, copy }) => (
              <span key={key}>{tn(positive ? copy.right : copy.left)}</span>
            )))}
          </div>
          <div className="proto-profile-actions">
            <button
              type="button"
              className="proto-primary"
              onClick={returnToTest}
            >
              {t("探索我的类型 ")}<ArrowRight size={17} />
            </button>
            <button type="button" className="proto-outline" onClick={share}>
              <Share2 size={16} />
              {t("分享人物 ")}</button>
          </div>
        </div>
      </article>
      <RoleStory key={`story-${character.id}`} roleId={character.id} />
      <div className="proto-type-explanation">
        <div>
          <p className="proto-kicker">{t("01 / 读懂这个组合")}</p>
          <h2>
            {t("四个视角， ")}<br />
            {t("看见他的行动逻辑。 ")}</h2>
          <p>
            {t("人物把策略推到鲜明的一端。读懂这些组合，也能帮助你观察日常选择中的分寸。 ")}</p>
        </div>
        <div className="proto-type-axis-cards">
          {(typeAxes(character.id).map(({ key, positive, copy }) => (
            <section key={key}>
              <span>{tn(copy.title)}</span>
              <h3>{tn(positive ? copy.right : copy.left)}</h3>
              <p>
                {tn((positive ? copy.positive : copy.negative).replaceAll(
                  '你',
                  '他',
                ))}
              </p>
            </section>
          )))}
        </div>
      </div>
      <section className="proto-type-reflection">
        <p className="proto-kicker">{t("02 / 留给自己的观察")}</p>
        <h2>{t("让策略服务于你在意的事。")}</h2>
        <p>
          {t("回想一次合作或分歧：你最想保住什么，用什么方式推进，又在什么时候愿意结束？把行动放回具体情境，往往比单看名字更有意思。 ")}</p>
        <button
          className="proto-text-button"
          onClick={openPrinciples}
          type="button"
        >
          {t("看看16型如何组成 ")}<ArrowRight size={16} />
        </button>
      </section>
      <CharacterAbility key={character.id} character={character} />
      <div className="proto-type-page-end">
        <button
          className="proto-text-button"
          type="button"
          onClick={openLibrary}
        >
          {t("浏览全部16型 ")}<ArrowRight size={16} />
        </button>
        <button
          className="proto-outline"
          type="button"
          onClick={() => openType(next.id)}
        >
          {t("下一位：")}{tn(next.name)}
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
export function Principles({
  openLibrary,
  returnToTest,
}: {
  openLibrary: () => void;
  returnToTest: () => void;
}) {
  const { t, tn } = useI18n();

  return (
    <section className="proto-reading-page proto-principles-page">
      <p className="proto-kicker">{t("BEHIND THE SIXTEEN / 原理分析")}</p>
      <h1>
        {t("四个视角， ")}<br />
        <em>{t("读懂不同的选择。")}</em>
      </h1>
      <p className="proto-reading-lead">
        {t("16暗影从日常的合作、分歧与取舍出发，把选择倾向组织成四条连续的轴，再用16个人物帮助理解和记忆。 ")}</p>
      <div className="proto-principle-axes">
        {(axisKeys.map((axis, index) => {
          const copy = axisContent[axis];
          const example = principleExamples[axis];
          return (
            <section key={axis}>
              <span className="proto-principle-number">0{tn(index + 1)}</span>
              <div>
                <h2>{tn(copy.title)}</h2>
                <div className="proto-principle-poles">
                  <strong>{tn(copy.left)}</strong>
                  <i aria-hidden="true" />
                  <strong>{tn(copy.right)}</strong>
                </div>
                <p>{tn(copy.reminder)}</p>
                <blockquote className="proto-principle-example">
                  <span>{t("例如 · ")}{tn(example.situation)}</span>
                  <p>“{tn(example.left)}”</p>
                  <p>“{tn(example.right)}”</p>
                </blockquote>
              </div>
            </section>
          );
        }))}
      </div>
      <section className="proto-principle-block">
        <p className="proto-kicker">{t("从四条轴，到16型")}</p>
        <div className="proto-sixteen-formula">
          <span>2</span>
          <i>×</i>
          <span>2</span>
          <i>×</i>
          <span>2</span>
          <i>×</i>
          <span>2</span>
          <i>=</i>
          <strong>16</strong>
        </div>
        <p>
          {t("每条轴提供两个方向，四个方向组合成一种类型。实际倾向可以落在轴上的任何位置；类型名是帮助你理解这一组合的入口。 ")}</p>
        <button
          className="proto-text-button"
          type="button"
          onClick={openLibrary}
        >
          {t("把组合放进人物里看看 ")}<ArrowRight size={16} />
        </button>
      </section>
      <section className="proto-principle-block">
        <p className="proto-kicker">{t("测试怎样形成结果")}</p>
        <div className="proto-method-steps">
          <div>
            <span>01</span>
            <h3>{t("先回答16题")}</h3>
            <p>{t("用五档符合度回应日常情境，先看本次匹配最高的角色与其他候选。")}</p>
          </div>
          <div>
            <span>02</span>
            <h3>{t("比较匹配占比")}</h3>
            <p>
              {t("四条轴先分别形成两端倾向读数，再将各型对应的四个读数相乘，得到16型的相对匹配分。 ")}</p>
          </div>
          <div>
            <span>03</span>
            <h3>{t("再探索32题")}</h3>
            <p>
              {t("更多情境共同参与计算，帮助进一步区分接近的类型，并更新当前画像。 ")}</p>
          </div>
        </div>
        <p className="proto-method-caption">
          {t("匹配占比表示本次回答与各型的相对贴合程度，用来比较候选。它来自可复现的组合规则；测量准确性需要通过后续研究检验。并列类型会同时标明，展示顺序按固定编号排列。 ")}</p>
      </section>
      <section className="proto-principle-block">
        <p className="proto-kicker">{t("持续完善的开放框架")}</p>
        <h2>{t("规则清楚，理解可以越来越深。")}</h2>
        <p>
          {t("当前使用1.0.0-draft.1候选题库与连续计分，并增加独立的网站匹配展示规则。我们通过题意核对、工程对照与真实使用反馈逐步完善它。 ")}</p>
        <p>
          {t("普通测试的逐题答案只参与当前会话计算。账号的保存目标是最新结果摘要，让你可以再次回到这幅画像。 ")}</p>
        <button type="button" className="proto-primary" onClick={returnToTest}>
          {t("从一个日常选择开始 ")}<ArrowRight size={18} />
        </button>
      </section>
    </section>
  );
}
