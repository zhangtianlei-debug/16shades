// Prefer a supported compressed representation, respecting explicit opt-outs
// and quality values. Identity is the fallback unless the client excludes it.
export function contentEncodings(header = '') {
  if (!header.trim()) return ['identity'];
  const accepted = new Map();
  for (const part of header.toLowerCase().split(',')) {
    const [name, ...parameters] = part.trim().split(';');
    const weight = parameters.find((value) => value.trim().startsWith('q='));
    const raw = weight?.trim().slice(2);
    const quality =
      raw === undefined
        ? 1
        : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(raw)
          ? Number(raw)
          : 0;
    accepted.set(name.trim(), quality);
  }
  return ['br', 'gzip', 'identity']
    .map((name) => ({
      name,
      quality:
        accepted.get(name) ??
        (name === 'identity'
          ? accepted.get('*') === 0
            ? 0
            : 0.0001
          : (accepted.get('*') ?? 0)),
    }))
    .filter(({ quality }) => quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map(({ name }) => name);
}
