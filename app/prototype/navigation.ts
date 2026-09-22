import { localizedHref } from '../i18n/routing.mjs';
export type PrototypeView =
  | 'home'
  | 'quiz'
  | 'result'
  | 'example'
  | 'types'
  | 'resources'
  | 'type'
  | 'principles'
  | 'knowledge'
  | 'relationships'
  | 'combo'
  | 'shared'
  | 'play';

const typeId = /^t(0[1-9]|1[0-6])$/i;

export function characterPath(id: string) {
  if (!typeId.test(id)) throw new Error('Unknown character');
  return localizedHref(`/prototype/types/${id.toLowerCase()}`);
}

const mbtiCode = /^(?:[IE][NS][TF][JP])$/i;
export function combinationPath(id: string, mbti: string) {
  if (!typeId.test(id) || !mbtiCode.test(mbti)) throw new Error('Unknown combination');
  return localizedHref(`/prototype/combinations/${mbti.toLowerCase()}/${id.toLowerCase()}`);
}

export function prototypePath(view: PrototypeView, id?: string) {
  if (view === 'type' && id) return characterPath(id);
  const params = new URLSearchParams();
  if (view !== 'home') params.set('view', view);
  if (id && typeId.test(id)) params.set('type', id.toLowerCase());
  const search = params.toString();
  return localizedHref(`/prototype${search ? `?${search}` : ''}`);
}

// Canonical character pages and earlier query links use the same in-page state.
export function prototypeSearch(location: {
  pathname: string;
  search: string;
}) {
  const combination = location.pathname.replace(/^\/en(?=\/|$)/, '').match(/^\/prototype\/combinations\/([a-z]{4})\/(t\d{2})\/?$/i);
  if (combination && mbtiCode.test(combination[1]) && typeId.test(combination[2]))
    return `?view=shared&type=${combination[2].toLowerCase()}&mbti=${combination[1].toUpperCase()}`;
  const match = location.pathname.replace(/^\/en(?=\/|$)/, '').match(/^\/prototype\/types\/(t\d{2})\/?$/i);
  if (match && typeId.test(match[1])) return `?type=${match[1].toLowerCase()}`;
  return location.search;
}
