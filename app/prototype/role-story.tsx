'use client';

import { useId, useState } from 'react';
import { useI18n } from '@/app/i18n/provider';
import { characters } from '@/app/data';
import { getCommunicationRole } from './social-content';
import './role-story.css';

const sentenceEndings = new Set(['。', '！', '？', '!', '?', '.']);
const closingMarks = new Set(['”', '’', '"', "'", '）', ')', '】', ']', '》', '〉', '」', '』', '〕', '}']);

function splitFirstSentence(text: string) {
  for (let index = 0; index < text.length; index += 1) {
    if (!sentenceEndings.has(text[index])) continue;
    let end = index + 1;
    while (closingMarks.has(text[end] ?? '')) end += 1;
    return {
      first: text.slice(0, end).trimEnd(),
      rest: text.slice(end).trimStart(),
    };
  }
  return { first: text, rest: '' };
}

export function RoleStory({ roleId, collapsible = true }: { roleId: string; collapsible?: boolean }) {
  const { t, tn } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const role = getCommunicationRole(roleId);
  const character = characters.find((entry) => entry.id === role.id);
  const explanation = t(role.explanation);
  const { first, rest } = splitFirstSentence(explanation);
  const canCollapse = collapsible;

  if (!character) return null;

  const extendedContent = (
    <>
      {canCollapse && rest && <p>{rest}</p>}
      <h3>{t("可能熟悉的三个时刻")}</h3>
      <ul>{role.scenes.map((scene) => <li key={scene}>{tn(scene)}</li>)}</ul>
      <h3>{t("同源的优势")}</h3>
      <p>{tn(role.strength)}</p>
      <h3>{t("过头的一步")}</h3>
      <p>{tn(role.turningPoint)}</p>
      <h3>{t("与邻近角色有什么不同")}</h3>
      <p>{tn(role.distinction)}</p>
    </>
  );

  return (
    <section className="proto-role-story">
      <h2 className="proto-role-story-title">{t(`再认识一下${character.name}`)}</h2>
      {canCollapse ? (
        <>
          <p className="proto-role-story-lead">
            {first}
            <button
              type="button"
              className="proto-role-story-toggle"
              aria-expanded={expanded}
              aria-controls={contentId}
              aria-label={t(expanded ? '收起人物介绍' : '展开人物介绍')}
              onClick={() => setExpanded((value) => !value)}
            >
              {t(expanded ? '收起' : '展开')}
            </button>
          </p>
          <div id={contentId} className="proto-role-story-content" hidden={!expanded}>
            {extendedContent}
          </div>
        </>
      ) : (
        <>
          <p>{explanation}</p>
          <div className="proto-role-story-content">{extendedContent}</div>
        </>
      )}
    </section>
  );
}
