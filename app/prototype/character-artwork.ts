export function familyClass(id: string) {
  return `proto-family-${Math.floor((Number(id.slice(1)) - 1) / 4)}`;
}

export const T06_ARTWORK_REVISION = '20260916-slanted-brows';

export function characterArtworkSrc(id: string) {
  const source = `/characters-transparent/${id.toLowerCase()}.svg`;
  return id.toUpperCase() === 'T06'
    ? `${source}?v=${T06_ARTWORK_REVISION}`
    : source;
}
