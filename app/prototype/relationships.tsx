'use client';
import { useI18n } from '@/app/i18n/provider';

import Image from 'next/image';
import { translateText, type Locale } from '../i18n/core';
import {
  ArrowRight,
  ChevronDown,
  Heart,
  Handshake,
  Swords,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { characters, type Character } from '../data';
import { CharacterAvatar } from './character-avatar';
import { characterArtworkSrc } from './character-artwork';
import relationshipData from './relationship-data.json';
import './relationships.css';

export type RelationshipMode = 'cp' | 'alliance' | 'rivalry';
type Pair = (typeof relationshipData.relationships)[number];
const modes = [
  { id: 'cp', label: 'CP', Icon: Heart },
  { id: 'alliance', label: '盟友', Icon: Handshake },
  { id: 'rivalry', label: '对手', Icon: Swords },
] as const;
const labelOf = (mode: RelationshipMode) =>
  modes.find((item) => item.id === mode)!.label;
export const readRelationshipMode = (value: string | null): RelationshipMode =>
  value === 'alliance' || value === 'rivalry' ? value : 'cp';
const typeById = new Map(relationshipData.types.map((type) => [type.id, type]));
const characterById = new Map(
  characters.map((character) => [character.id, character]),
);
const getPair = (first: string, second: string) =>
  relationshipData.relationships.find(
    (pair) => pair.id === [first, second].sort().join('-'),
  );
const nameOf = (id: string) =>
  typeById.get(id)?.name ?? characterById.get(id)?.name ?? id;
const narrative = (pair: Pair, text: string, locale: Locale) =>
  translateText(text, locale).replace(
    /\b[AB]\b/g,
    (letter) =>
      `${translateText(nameOf(letter === 'A' ? pair.type_a : pair.type_b), locale)}${pair.type_a === pair.type_b ? ` ${letter}` : ''}`,
  );

function RelationshipModeSwitch({
  value,
  onChange,
  label,
}: {
  value: RelationshipMode;
  onChange: (mode: RelationshipMode) => void;
  label: string;
}) {
  const { t, tn, locale } = useI18n();

  return (
    <fieldset className="rel-mode-switch" aria-label={t(label)}>
      {(modes.map(({ id, label: title, Icon }, index) => (
        <button
          key={id}
          type="button"
          data-mode={id}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? 2
                  : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
            onChange(modes[next].id);
            event.currentTarget.parentElement
              ?.querySelectorAll('button')
              [next]?.focus();
          }}
        >
          <Icon size={15} aria-hidden="true" />
          {title === 'CP' && locale === 'en' ? 'Close bonds' : tn(title)}
        </button>
      )))}
    </fieldset>
  );
}

function Person({
  id,
  onOpenType,
}: {
  id: string;
  onOpenType: (id: string) => void;
}) {
  const { t, tn, asset } = useI18n();

  const character = characterById.get(id) as Character | undefined;
  return (
    <button
      type="button"
      className="rel-person"
      onClick={() => onOpenType(id)}
      aria-label={t(`查看${nameOf(id)}人物档案`)}
    >
      {(character ? (
        <Image
          src={asset(characterArtworkSrc(character.id))}
          alt={t("")}
          width={240}
          height={240}
          unoptimized
        />
      ) : (
        <CharacterAvatar id={id} alt={t("")} size={180} />
      ))}
      <span>{tn(nameOf(id))}</span>
    </button>
  );
}

function pickPreviewPairs(id: string) {
  const current = typeById.get(id);
  if (!current) return [];
  const others = relationshipData.types.filter((type) => type.id !== id);
  const axis = current.axes.split('');
  const ranked = others
    .map((type) => {
      const compared = type.axes.split('');
      return {
        type,
        priority:
          axis[0] === compared[0] && axis[2] !== compared[2]
            ? 0
            : axis[0] !== compared[0]
              ? 1
              : 2,
      };
    })
    .sort(
      (a, b) => a.priority - b.priority || a.type.id.localeCompare(b.type.id),
    );
  return [
    ranked.find((item) => item.priority === 0),
    ranked.find((item) => item.priority === 1),
  ].flatMap((item) => {
    const pair = item && getPair(id, item.type.id);
    return pair ? [pair] : [];
  });
}

export function RelationshipPreview({
  characterId,
  selectedModes,
  onModeChange,
  onOpenPair,
}: {
  characterId: string;
  selectedModes: Record<string, RelationshipMode>;
  onModeChange: (pairId: string, mode: RelationshipMode) => void;
  onOpenPair: (first: string, second: string, mode: RelationshipMode) => void;
}) {
  const { t, tn, locale } = useI18n();

  const [open, setOpen] = useState<string | null>(null);
  const pairs = useMemo(() => pickPreviewPairs(characterId), [characterId]);
  if (!pairs.length) return null;
  return (
    <section className="rel-preview" aria-label={t("人物关系预览")}>
      <p className="rel-eyebrow">{t("人物关系演绎")}</p>
      <h2>{t("换一个人，看看局面")}</h2>
      <div className="rel-preview-grid">
        {(pairs.map((pair) => {
          const other = pair.type_a === characterId ? pair.type_b : pair.type_a;
          const mode = selectedModes[pair.id] ?? 'cp';
          const expanded = open === pair.id;
          return (
            <article
              className="rel-preview-card"
              key={pair.id}
              aria-label={t(pair.name)}
            >
              <div className="rel-preview-heading">
                <div className="rel-preview-avatars">
                  <CharacterAvatar id={characterId} alt={t("")} size={42} />
                  <i>×</i>
                  <CharacterAvatar id={other} alt={t("")} size={42} />
                </div>
                <div>
                  <span className="rel-preview-name">{tn(pair.name)}</span>
                  <h3>
                    {tn(nameOf(characterId))} × {tn(nameOf(other))}
                  </h3>
                </div>
              </div>
              <RelationshipModeSwitch
                value={mode}
                onChange={(next) => onModeChange(pair.id, next)}
                label={`${pair.name}的情境`}
              />
              <div
                className="rel-preview-scenario"
                data-mode={mode}
                aria-live="polite"
                aria-atomic="true"
              >
                {(modes.map(({ id }) => (
                  <p key={id} aria-hidden={id !== mode}>
                    {tn(narrative(pair, pair[id], locale))}
                  </p>
                )))}
              </div>
              <div className="rel-preview-actions">
                <button
                  type="button"
                  className="rel-preview-open"
                  onClick={() => onOpenPair(characterId, other, mode)}
                >
                  {t("看")}{tn(labelOf(mode))}{t("故事 ")}<ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  className="rel-expand"
                  onClick={() => setOpen(expanded ? null : pair.id)}
                  aria-expanded={expanded}
                >
                  {tn(expanded ? '收起特点' : '关系特点')}
                  <ChevronDown size={14} />
                </button>
              </div>
              {(expanded && (
                <p className="rel-preview-detail">
                  {tn(narrative(pair, pair.basis, locale))}
                </p>
              ))}
            </article>
          );
        }))}
      </div>
    </section>
  );
}

export function Relationships({
  first,
  second,
  mode,
  onChange,
  onModeChange,
  onOpenType,
  onOpenKnowledge,
}: {
  first: string;
  second: string;
  mode: RelationshipMode;
  onChange: (first: string, second: string, mode: RelationshipMode) => void;
  onModeChange: (mode: RelationshipMode) => void;
  onOpenType: (id: string) => void;
  onOpenKnowledge: (slug: string) => void;
}) {
  const { t, tn, locale } = useI18n();

  const [detail, setDetail] = useState(false);
  const pair = getPair(first, second);
  if (!pair)
    return (
      <section className="rel-page">
        <p>{t("关系内容暂不可用。")}</p>
      </section>
    );
  const reversed = pair.type_a !== first || pair.type_b !== second;
  const aView = reversed ? pair.b_to_a : pair.a_to_b;
  const bView = reversed ? pair.a_to_b : pair.b_to_a;
  return (
    <section className="rel-page" aria-label={t("人物关系")}>
      <p className="rel-eyebrow">{t("人物关系演绎")}</p>
      <div className="rel-selectors">
        <label>
          {t("人物A ")}<select
            value={first}
            onChange={(event) => onChange(event.target.value, second, mode)}
          >
            {(relationshipData.types.map((type) => (
              <option value={type.id} key={type.id}>
                {tn(type.name)}
              </option>
            )))}
          </select>
        </label>
        <label>
          {t("人物B ")}<select
            value={second}
            onChange={(event) => onChange(first, event.target.value, mode)}
          >
            {(relationshipData.types.map((type) => (
              <option value={type.id} key={type.id}>
                {tn(type.name)}
              </option>
            )))}
          </select>
        </label>
      </div>
      <div className="rel-people">
        <Person id={first} onOpenType={onOpenType} />
        <div className="rel-times">×</div>
        <Person id={second} onOpenType={onOpenType} />
      </div>
      <h1>{tn(pair.name)}</h1>
      <p className="rel-hook">{tn(narrative(pair, pair.hook, locale))}</p>
      <p className="rel-note">
        {t("同一对人物，三种故事走向。情境和双方选择让关系展开。 ")}</p>
      <RelationshipModeSwitch
        value={mode}
        onChange={onModeChange}
        label="关系情境"
      />
      <article
        className="rel-branch"
        data-mode={mode}
        aria-live="polite"
        aria-atomic="true"
      >
        <p className="rel-branch-label">{mode === 'cp' && locale === 'en' ? 'Close bonds' : tn(labelOf(mode))}{locale === 'en' ? ' scenario' : '情境'}</p>
        <p>{tn(narrative(pair, pair[mode], locale))}</p>
      </article>
      <div className="rel-views">
        <article>
          <h2>
            {tn(nameOf(first))}
            {tn(first === second ? ' A' : '')}{t("看")}{tn(nameOf(second))}
            {tn(first === second ? ' B' : '')}
          </h2>
          <p>{tn(narrative(pair, aView, locale))}</p>
        </article>
        <article>
          <h2>
            {tn(nameOf(second))}
            {tn(first === second ? ' B' : '')}{t("看")}{tn(nameOf(first))}
            {tn(first === second ? ' A' : '')}
          </h2>
          <p>{tn(narrative(pair, bView, locale))}</p>
        </article>
      </div>
      {(first === second && (
        <p className="rel-same">
          {t("同型也有两个人：A／B只表示当前情境中的不同位置，不代表谁更像该类型。 ")}</p>
      ))}
      <button
        type="button"
        className="rel-detail-toggle"
        onClick={() => setDetail(!detail)}
        aria-expanded={detail}
      >
        {tn(detail ? '收起结构与转折' : '查看结构、转折与停火')}
      </button>
      {(detail && (
        <div className="rel-details">
          <p>
            <strong>{t("四轴结构：")}</strong>
            {tn(pair.structure_signature)}{t('。')}{tn(narrative(pair, pair.basis, locale))}
          </p>
          <p>
            <strong>{t("转折：")}</strong>
            {tn(narrative(pair, pair.turning_point, locale))}
          </p>
          <p>
            <strong>{t("停火：")}</strong>
            {tn(narrative(pair, pair.brake, locale))}
          </p>
        </div>
      ))}
      <button
        type="button"
        className="rel-method"
        onClick={() => onOpenKnowledge('relationships-method')}
      >
        {t("了解我们怎样阅读人物关系 → ")}</button>
    </section>
  );
}
