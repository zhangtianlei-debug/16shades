'use client';

import { useMemo, useState } from 'react';
import { Check, Clipboard, Download, PencilLine } from 'lucide-react';
import { useI18n } from '@/app/i18n/provider';
import type { CandidateResult } from './scoring';
import { collaborationSuggestions, type Locale } from './collaboration-note-data';
import './collaboration-note.css';

const copy = {
  kicker: { zh: '个人合作说明书', en: 'MY COLLABORATION NOTE' },
  title: { zh: '把希望别人怎样和你协作，说清楚。', en: 'Say clearly how you hope others will work with you.' },
  intro: { zh: '根据测试结果自动推荐。四句话都可以直接改成你自己的表达。', en: 'Automatically recommended from your test result. Edit every line in your own words.' },
  result: { zh: '我的合作说明书', en: 'My Collaboration Note' },
  edit: { zh: '编辑每一句', en: 'Edit every line' },
  editLead: { zh: '点选一句建议，会直接填入对应内容。编辑内容保留在当前页面。', en: 'Choose a suggestion to fill its field directly. Edits stay on this page.' },
  copy: { zh: '复制文字', en: 'Copy text' }, copied: { zh: '已复制', en: 'Copied' }, png: { zh: '导出 PNG', en: 'Export PNG' },
  placeholder: { zh: '用自己的话写下来…', en: 'Put it in your own words…' }, generated: { zh: '根据本次测试结果自动推荐', en: 'Automatically recommended from this test result' },
};
function c(key: keyof typeof copy, locale: Locale) { return copy[key][locale]; }
function wrap(ctx: CanvasRenderingContext2D, value: string, width: number) { const output: string[] = []; let line = ''; for (const char of Array.from(value)) { if (line && ctx.measureText(line + char).width > width) { output.push(line); line = char; } else line += char; } if (line) output.push(line); return output; }
function download(url: string) { const anchor = document.createElement('a'); anchor.href = url; anchor.download = '16-shades-my-collaboration-note.png'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); }
function plain(locale: Locale, rows: Array<{ label: string; value: string }>) { return [c('result', locale), c('generated', locale), '', ...rows.flatMap((row) => [`${row.label}`, row.value, ''])].join('\n'); }
function image(locale: Locale, rows: Array<{ label: string; value: string }>) {
  const width = 1600, padding = 120, contentWidth = width - padding * 2, probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('Canvas unavailable');
  probe.font = '400 36px system-ui, sans-serif'; const blocks = rows.map((row) => ({ ...row, lines: wrap(probe, row.value || c('placeholder', locale), contentWidth - 64) }));
  const height = Math.max(1500, 370 + blocks.reduce((sum, block) => sum + 145 + block.lines.length * 50, 0));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
  ctx.fillStyle = '#f3eff4'; ctx.fillRect(0, 0, width, height); ctx.fillStyle = '#3a2648'; ctx.fillRect(0, 0, width, 18);
  ctx.fillStyle = '#382b40'; ctx.font = '600 32px system-ui, sans-serif'; ctx.fillText(locale === 'zh' ? '16暗影' : '16 SHADES', padding, 100); ctx.font = '600 76px system-ui, sans-serif'; ctx.fillText(c('result', locale), padding, 212); ctx.fillStyle = '#716778'; ctx.font = '400 30px system-ui, sans-serif'; ctx.fillText(c('generated', locale), padding, 270);
  let y = 370; blocks.forEach((block) => { const boxHeight = 90 + block.lines.length * 50; ctx.fillStyle = '#fff'; ctx.fillRect(padding, y - 42, contentWidth, boxHeight); ctx.fillStyle = '#745d7d'; ctx.font = '600 27px system-ui, sans-serif'; ctx.fillText(block.label, padding + 34, y); y += 58; ctx.fillStyle = '#3c3044'; ctx.font = '400 36px system-ui, sans-serif'; block.lines.forEach((line) => { ctx.fillText(line, padding + 34, y); y += 50; }); y += 72; });
  return canvas.toDataURL('image/png');
}

export function CollaborationNote({ result, characterId: _characterId }: { result: CandidateResult; characterId: string }) {
  const { locale } = useI18n();
  const suggestions = useMemo(() => collaborationSuggestions(result, locale), [result, locale]);
  const [drafts, setDrafts] = useState<Record<string, string>>({}); const [copied, setCopied] = useState(false);
  const rows = suggestions.map((item) => ({ ...item, value: drafts[item.id] ?? item.value }));
  const update = (id: string, value: string) => setDrafts((current) => ({ ...current, [id]: value }));
  const copyText = async () => { await navigator.clipboard?.writeText(plain(locale, rows)); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <section className="collaboration-note">
    <header className="collaboration-note-opening"><p>{c('kicker', locale)}</p><h2>{c('title', locale)}</h2><div>{c('intro', locale)}</div></header>
    <section className="collaboration-result" aria-label={c('result', locale)}>{rows.map((item, index) => <article key={item.id}><span>0{index + 1}</span><h3>{item.label}</h3><p>{item.value}</p></article>)}</section>
    <section className="collaboration-editor"><div className="collaboration-editor-heading"><div><p><PencilLine size={16} /> {c('edit', locale)}</p><h3>{c('editLead', locale)}</h3></div><div><button type="button" onClick={copyText}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? c('copied', locale) : c('copy', locale)}</button><button type="button" onClick={() => download(image(locale, rows))}><Download size={16} />{c('png', locale)}</button></div></div>{rows.map((item, index) => <article className="collaboration-edit-row" key={item.id}><span>0{index + 1}</span><div><h4>{item.label}</h4><div className="collaboration-chips">{item.chips.map((chip) => <button type="button" key={chip} onClick={() => update(item.id, chip)}>{chip}</button>)}</div><textarea value={item.value} maxLength={240} onChange={(event) => update(item.id, event.target.value)} placeholder={c('placeholder', locale)} /></div></article>)}</section>
  </section>;
}
