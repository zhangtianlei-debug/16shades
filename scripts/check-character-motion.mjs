import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inlineCharacterSvg } from '../app/prototype/svg-instance.ts';

const files = [
  'character-motion.css',
  'hunters-raiders-motion.css',
  'controllers-rulers-motion.css',
  'action-rigs-motion.css',
];
const css = files
  .map((file) => readFileSync(`app/prototype/assets/${file}`, 'utf8'))
  .join('\n');
const ids = (svg) =>
  [...svg.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
let bytes = 0;
for (let number = 1; number <= 16; number++) {
  const type = `t${String(number).padStart(2, '0')}`;
  const source = readFileSync(
    `app/prototype/assets/${type}-motion.svg`,
    'utf8',
  );
  bytes += Buffer.byteLength(source);
  assert.ok(
    source.includes(`data-character-id="${type.toUpperCase()}"`),
    `${type}: correct character`,
  );
  assert.equal(
    new Set(ids(source)).size,
    ids(source).length,
    `${type}: unique source IDs`,
  );
  assert.ok(
    css.includes(`@keyframes ${type}-body-result`),
    `${type}: result completion marker`,
  );
  const a = inlineCharacterSvg(source, 'instance-a');
  const b = inlineCharacterSvg(source, 'instance-b');
  const combinedIds = [...ids(a), ...ids(b)];
  assert.equal(
    new Set(combinedIds).size,
    combinedIds.length,
    `${type}: two instances must not share IDs`,
  );
  for (const rendered of [a, b]) {
    const ownIds = new Set(ids(rendered));
    assert.ok(
      rendered.includes(`data-character-id="${type.toUpperCase()}"`),
      `${type}: preserve character identity attribute`,
    );
    assert.deepEqual(
      [...rendered.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]),
      [...source.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]),
      `${type}: instancing preserves geometry`,
    );
    const references = [
      ...[...rendered.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]),
      ...[...rendered.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]),
      ...[
        ...rendered.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g),
      ].flatMap((m) => m[1].split(/\s+/)),
    ];
    for (const ref of references)
      assert.ok(
        ownIds.has(ref),
        `${type}: reference ${ref} stays in its own SVG`,
      );
  }
}
console.log(
  `Passed: all 16 motion assets, separate instance IDs, internal clip/accessibility references and preserved geometry (${bytes.toLocaleString()} bytes). Visual quality still requires rendered review.`,
);
