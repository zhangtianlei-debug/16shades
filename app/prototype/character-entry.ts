// Ephemeral navigation intent; never stores a visitor's assessment or history.
let entry: { id: string; time: number } | null = null;

export function rememberCharacterEntry(id: string) {
  entry = { id, time: performance.now() };
}

export function takeCharacterEntry(id: string) {
  const current = entry;
  entry = null;
  return current?.id === id && performance.now() - current.time < 1500;
}
