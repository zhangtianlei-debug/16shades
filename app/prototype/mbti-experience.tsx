'use client';
import { useI18n } from '@/app/i18n/provider';


import { ArrowRight, BookOpen, Share2, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { useMemo } from 'react';
import { IdentityCard } from './identity-card';
import { characterArtworkSrc } from './character-artwork';
import {
  MBTI_TYPES,
  combinationSamples,
  communicationRoles,
  getCombination,
  getCommunicationRole,
  getShareCardCopy,
  officialSeeds,
  readMbti,
  type MbtiType,
} from './social-content';

type Role = (typeof communicationRoles)[number];
type Combo = (typeof combinationSamples)[number];
type Seed = (typeof officialSeeds)[number];

function roleFor(id: string): Role {
  return getCommunicationRole(id);
}

function CharacterPortrait({
  role,
  compact = false,
}: {
  role: Role;
  compact?: boolean;
}) {
  const { t, asset } = useI18n();

  return (
    <Image
      className={
        compact ? 'mbti-portrait mbti-portrait--compact' : 'mbti-portrait'
      }
      src={asset(characterArtworkSrc(role.id))}
      alt={t(`${role.name}人物形象`)}
      width={compact ? 92 : 280}
      height={compact ? 92 : 280}
      loading="lazy"
      unoptimized
    />
  );
}

function Identity({ role, mbti }: { role: Role; mbti: MbtiType | null }) {
  const { tn } = useI18n();

  return (
    <div className="mbti-identity">
      <span>{tn(role.id)}</span>
      <strong>{tn(role.name)}</strong>
      <i aria-hidden="true">×</i>
      <b>{tn(mbti ?? 'MBTI 待选')}</b>
    </div>
  );
}

export function MbtiExperience({
  roleId,
  mbti,
  personalized,
  hasResult,
  onChangeMbti,
  onBrowse,
  onShare,
  onOpenKnowledge,
  onReturn,
}: {
  roleId: string;
  mbti: MbtiType | null;
  personalized: boolean;
  hasResult: boolean;
  onChangeMbti: (value: MbtiType | null) => void;
  onBrowse: (roleId: string, mbti: MbtiType | null) => void;
  onShare: (roleId: string, mbti: MbtiType | null) => void;
  onOpenKnowledge: () => void;
  onReturn: () => void;
}) {
  const { t, tn } = useI18n();

  const activeRoleId = roleId;
  const activeRole = useMemo(() => roleFor(activeRoleId), [activeRoleId]);
  const combo = useMemo(
    () => (mbti ? getCombination(activeRoleId, mbti) : undefined),
    [activeRoleId, mbti],
  );
  const heading = personalized
    ? '熟悉的我，也有另一面。'
    : '这两个身份，会怎样碰面？';

  return (
    <section
      className="mbti-experience"
      aria-labelledby="mbti-experience-title"
    >
      <header className="mbti-heading">
        <p className="mbti-kicker">
          {tn(personalized ? '你的双身份' : '组合灵感')}
        </p>
        <h2 id="mbti-experience-title">{tn(heading)}</h2>
        <p>
          {tn(personalized
            ? '已带入你的测评人物，也可以换一个试试。'
            : '从你感兴趣的角色开始，看看组合灵感。')}
        </p>
      </header>

      <form
        className="mbti-controls"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="mbti-role-select">
          <span>{t("想组合的 16 暗影人物")}</span>
          <select
            value={activeRoleId}
            onChange={(event) => onBrowse(event.target.value, mbti)}
          >
            {(communicationRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {tn(role.name)}
              </option>
            )))}
          </select>
        </label>
        <fieldset className="mbti-type-picker">
          <legend>{t("为人物选择 MBTI")}</legend>
          <div className="mbti-picker-row">
            <select
              aria-label={t("为人物选择 MBTI")}
              value={mbti ?? ''}
              onChange={(event) => onChangeMbti(readMbti(event.target.value))}
            >
              <option value="" disabled>{t("请选择 MBTI")}</option>
              {(MBTI_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tn(type)}
                </option>
              )))}
            </select>
          </div>
        </fieldset>
        <p className="mbti-privacy-note">
          {t("自选MBTI不参与测评计分，也暂不随账号保存。 ")}</p>
        <div className="mbti-actions">
          {(mbti && (
            <>
              <button
                className="proto-outline mbti-action"
                type="button"
                onClick={onReturn}
              >
                {tn(hasResult ? '回看画像' : '回到测试')}{tn(' ')}
                <ArrowRight size={16} />
              </button>
              <button
                className="proto-primary mbti-action"
                type="button"
                onClick={() => onShare(activeRoleId, mbti)}
              >
                <Share2 size={16} /> {t(" 分享双身份 ")}</button>
            </>
          ))}
        </div>
      </form>

      <div className={`mbti-stage${mbti ? ' mbti-stage--card' : ''}`}>
        {(mbti ? (
          <IdentityCard roleId={activeRoleId} mbti={mbti} previewOnly />
        ) : (
          <div className="mbti-portrait-wrap">
            <span className="mbti-mark" aria-hidden="true">
              {tn(mbti ?? 'TYPE')}
            </span>
            <span className="mbti-mark-orbit" aria-hidden="true" />
            <CharacterPortrait role={activeRole} />
          </div>
        ))}
        <div className="mbti-stage-copy">
          {(!mbti && (
            <>
              <Identity role={activeRole} mbti={mbti} />
              <p className="mbti-tagline">{tn(activeRole.tagline)}</p>
            </>
          ))}
          {(combo && (
            <article className="mbti-combo-card">
              <p className="mbti-scene">{tn(combo.scene)}</p>
              <details className="mbti-combo-details">
                <summary>
                  {t("为什么这样连 ")}<ArrowRight size={15} />
                </summary>
                <p>{tn(combo.rationale)}</p>
              </details>
              <details className="mbti-combo-details">
                <summary>
                  {t("这个联想的边界 ")}<ArrowRight size={15} />
                </summary>
                <p>{tn(combo.boundary)}</p>
              </details>
              <button
                className="mbti-wiki-link"
                type="button"
                onClick={onOpenKnowledge}
              >
                <BookOpen size={16} /> {t(" 去 Wiki 看角色与联动说明 ")}</button>
            </article>
          ))}
        </div>
      </div>

      <section
        className="mbti-sample-section"
        aria-labelledby="mbti-samples-title"
      >
        <div className="mbti-sample-heading">
          <div>
            <p className="mbti-kicker">{t("创作素材")}</p>
            <h3 id="mbti-samples-title">{t("12 组组合灵感")}</h3>
          </div>
          <p>{t("点开只会切换到组合阅读，不会覆盖你的结果。")}</p>
        </div>
        <div className="mbti-sample-grid">
          {(combinationSamples.map((sample: Combo) => {
            const sampleRole = roleFor(sample.roleId);
            return (
              <button
                className="mbti-sample"
                key={sample.id}
                onClick={() => onBrowse(sample.roleId, sample.mbti)}
                type="button"
              >
                <CharacterPortrait role={sampleRole} compact />
                <span>
                  <small>
                    {tn(sample.mbti)} × {tn(sampleRole.name)}
                  </small>
                  <strong>{tn(sample.title)}</strong>
                  <em>{tn(getShareCardCopy(sample.roleId, sample.mbti).line)}</em>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            );
          }))}
        </div>
      </section>
    </section>
  );
}

export function OfficialPlay({
  onBrowse,
  onOpenType,
}: {
  onBrowse: (roleId: string, mbti: MbtiType | null) => void;
  onOpenType: (id: string) => void;
}) {
  const { t, tn } = useI18n();

  return (
    <section className="play-experience" aria-labelledby="official-play-title">
      <header className="play-heading">
        <p className="play-kicker">
          <Sparkles size={15} /> {t(" 官方玩法 ")}</p>
        <h2 id="official-play-title">{t("先从一句话，走进一个小场景")}</h2>
        <p>{t("六张可随手阅读、转发或继续展开的人物创作卡。")}</p>
      </header>
      <div className="play-seed-grid">
        {(officialSeeds.map((seed: Seed) => {
          const roles = seed.roleIds.map(roleFor);
          return (
            <article className="play-seed" key={seed.id}>
              <div className={`play-art play-art--${roles.length}`}>
                {(roles.map((role) => (
                  <button
                    aria-label={t(`查看${role.name}`)}
                    className="play-portrait-button"
                    key={role.id}
                    onClick={() => onOpenType(role.id)}
                    type="button"
                  >
                    <CharacterPortrait role={role} />
                  </button>
                )))}
              </div>
              <p className="play-category">{tn(seed.category)}</p>
              <h3>{tn(seed.title)}</h3>
              <p className="play-copy">{tn(seed.copy)}</p>
              <details className="play-details">
                <summary>
                  {t("展开场景 ")}<ArrowRight size={16} />
                </summary>
                <p>{tn(seed.copy)}</p>
                <p>{tn(seed.scene)}</p>
                <p className="play-caption">{tn(seed.caption)}</p>
                <div className="play-actions">
                  {(roles.map((role) => (
                    <button
                      className="proto-outline play-action"
                      key={role.id}
                      onClick={() =>
                        onBrowse(
                          role.id,
                          combinationSamples.find(
                            (sample) =>
                              sample.roleId === role.id &&
                              sample.title === seed.title,
                          )?.mbti ?? (seed.id === 'SEED-005' ? 'ENFP' : null),
                        )
                      }
                      type="button"
                    >
                      {t("看")}{tn(role.name)}{t("组合 ")}<ArrowRight size={15} />
                    </button>
                  )))}
                </div>
              </details>
            </article>
          );
        }))}
      </div>
    </section>
  );
}
