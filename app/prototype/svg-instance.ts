// The same character may appear more than once. Keep every SVG definition and
// accessibility reference within its own instance, including generated layers.
export function inlineCharacterSvg(source: string, instance: string) {
  const idMap = new Map(
    [...source.matchAll(/\sid="([^"]+)"/g)].map((match) => [
      match[1],
      `${instance}-${match[1]}`,
    ]),
  );
  return source
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(
      /(\s)id="([^"]+)"/g,
      (_, space: string, id: string) => `${space}id="${idMap.get(id)}"`,
    )
    .replace(/url\(#([^)]+)\)/g, (match, id: string) =>
      idMap.has(id) ? `url(#${idMap.get(id)})` : match,
    )
    .replace(/(href=")#([^"]+)"/g, (match, attribute: string, id: string) =>
      idMap.has(id) ? `${attribute}#${idMap.get(id)}"` : match,
    )
    .replace(
      /(aria-(?:labelledby|describedby)=")([^"]+)"/g,
      (_, attribute: string, ids: string) =>
        `${attribute}${ids
          .split(/\s+/)
          .map((id) => idMap.get(id) ?? id)
          .join(' ')}"`,
    );
}
