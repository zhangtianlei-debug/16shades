import { currentLocale, translateText, translateRecord, localizedAsset, type Locale } from '../i18n/core';
import { characterArtworkSrc } from './character-artwork';
import {
  getCommunicationRole,
  getShareCardCopy,
  combinationKicker,
  type MbtiType,
} from './social-content';

export function identityCopy(roleId: string, mbti: MbtiType | null, locale: Locale = currentLocale()) {
  const role = translateRecord(getCommunicationRole(roleId), locale);
  const combination = mbti ? translateRecord(getShareCardCopy(roleId, mbti), locale) : null;
  return {
    role,
    identity: mbti ? `${mbti} × ${role.name}` : role.name,
    nickname: combination?.nickname ?? null,
    title: mbti ? translateText(combinationKicker, locale) : role.tagline,
    line: combination?.line ?? role.quote,
  };
}

// Muted display colors, independent of the assessment's four axes and scoring.
function identityColor(mbti: MbtiType) {
  if (mbti[1] === 'N') return mbti[2] === 'F' ? '#3F6C61' : '#67587E';
  return mbti[3] === 'J' ? '#4E6D85' : '#886A35';
}

const font = '"PingFang SC", "Microsoft YaHei", sans-serif';
const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  const cached = images.get(src);
  if (cached) return cached;
  const pending = (async () => {
    const image = new window.Image();
    image.src = src;
    await image.decode();
    return image;
  })().catch((error) => {
    images.delete(src);
    throw error;
  });
  images.set(src, pending);
  return pending;
}

type Silhouette = {
  source: HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
  minSum: number;
};
const silhouettes = new Map<string, Promise<Silhouette>>();
function loadSilhouette(id: string, locale: Locale) {
  const src = localizedAsset(characterArtworkSrc(id), locale);
  const cached = silhouettes.get(src);
  if (cached) return cached;
  const pending = (async () => {
    const image = await loadImage(src);
    const source = document.createElement('canvas');
    source.width = 1024;
    source.height = 1024;
    const ctx = source.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('无法读取人物');
    ctx.drawImage(image, 0, 0, 1024, 1024);
    const pixels = ctx.getImageData(0, 0, 1024, 1024).data;
    let left = 1024,
      top = 1024,
      right = -1,
      bottom = -1,
      minSum = 2048;
    for (let y = 0; y < 1024; y++)
      for (let x = 0; x < 1024; x++) {
        if (pixels[(y * 1024 + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
        minSum = Math.min(minSum, x + y);
      }
    if (right < left) throw new Error('人物暂时没有加载成功');
    // Only transparent margins are removed. Every visible pixel, including props,
    // is kept; minSum lets the entire silhouette clear the diagonal without a mask.
    return {
      source,
      x: left,
      y: top,
      width: right - left + 1,
      height: bottom - top + 1,
      minSum: minSum - left - top,
    };
  })().catch((error) => {
    silhouettes.delete(src);
    throw error;
  });
  silhouettes.set(src, pending);
  return pending;
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxSize: number,
  width: number,
  family = font,
) {
  let size = maxSize;
  do {
    ctx.font = `600 ${size}px ${family}`;
    if (ctx.measureText(text).width <= width) return size;
    size--;
  } while (size > 1);
  return size;
}

function textLines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const character of (/\p{Script=Han}/u.test(text) ? Array.from(text) : text.split(/(?<=\s)/))) {
    if (line && ctx.measureText(line + character).width > width) {
      lines.push(line);
      line = character;
    } else line += character;
  }
  if (line) lines.push(line);
  return lines;
}

function quoteLines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return [text];
  const characters = /\p{Script=Han}/u.test(text) ? Array.from(text) : text.split(/(?<=\s)/);
  let best: { lines: string[]; score: number } | null = null;
  for (let index = 1; index < characters.length; index++) {
    const left = characters.slice(0, index).join('');
    const right = characters.slice(index).join('');
    if (/[“‘（【《]$/.test(left) || /^[，。！？、；：”’）】》]/.test(right)) continue;
    const leftWidth = ctx.measureText(left).width;
    const rightWidth = ctx.measureText(right).width;
    if (Math.max(leftWidth, rightWidth) > width) continue;
    // Prefer a clause boundary; otherwise balance the two lines without leaving
    // closing punctuation at the start or an opening quote at the end.
    const score = Math.abs(leftWidth - rightWidth) + (/[，；：。！？]$/.test(left) ? 0 : width);
    if (!best || score < best.score) best = { lines: [left, right], score };
  }
  return best?.lines ?? textLines(ctx, text, width);
}

function drawBasic(
  ctx: CanvasRenderingContext2D,
  portrait: HTMLImageElement,
  roleId: string,
  locale: Locale,
) {
  const { identity, title, line } = identityCopy(roleId, null, locale);
  ctx.fillStyle = '#ece6f5';
  ctx.fillRect(0, 0, 1080, 1440);
  ctx.fillStyle = '#fff';
  ctx.fillRect(34, 34, 1012, 1372);
  ctx.fillStyle = '#503080';
  ctx.font = `600 32px ${font}`;
  ctx.fillText(translateText('16暗影', locale), 80, 100);
  ctx.font = `400 24px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText(translateText('我的另一面', locale), 1000, 100);
  ctx.textAlign = 'left';
  fitFont(ctx, identity, 92, 920);
  ctx.fillText(identity, 80, 218);
  ctx.fillStyle = '#ece6f5';
  ctx.fillRect(80, 270, 920, 665);
  ctx.drawImage(portrait, 217, 276, 654, 654);
  ctx.fillStyle = '#503080';
  let titleSize = 48;
  ctx.font = `600 ${titleSize}px ${font}`;
  let titleLines = textLines(ctx, title, 920);
  while (locale === 'en' && titleLines.length > 2 && titleSize > 24) {
    ctx.font = `600 ${--titleSize}px ${font}`;
    titleLines = textLines(ctx, title, 920);
  }
  titleLines.forEach((text, i) => ctx.fillText(text, 80, 1018 + i * 64));
  ctx.fillStyle = '#665676';
  ctx.font = `400 32px ${font}`;
  textLines(ctx, line, 920).forEach((text, i) =>
    ctx.fillText(text, 80, 1040 + titleLines.length * 64 + i * 49),
  );
  ctx.fillStyle = '#776886';
  ctx.font = `400 24px ${font}`;
  ctx.fillText(translateText('类型不是坏度', locale), 80, 1360);
  ctx.textAlign = 'right';
  ctx.fillText(translateText('认领一个有点坏的自己', locale), 1000, 1360);
}

function drawCombination(
  ctx: CanvasRenderingContext2D,
  figure: Silhouette,
  logo: HTMLImageElement,
  roleId: string,
  mbti: MbtiType,
  locale: Locale,
) {
  const { role, title, line, nickname } = identityCopy(roleId, mbti, locale);
  ctx.fillStyle = '#EAE3F2';
  ctx.fillRect(0, 0, 1080, 1100);
  ctx.fillStyle = identityColor(mbti);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(1080, 0);
  ctx.lineTo(0, 1100);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FFF5DC';
  ctx.font = `600 34px ${font}`;
  ctx.fillText(title, 64, 108);
  fitFont(ctx, mbti, 270, 640, 'Arial, sans-serif');
  ctx.fillText(mbti, 64, 330);
  fitFont(ctx, nickname!, 64, 560);
  ctx.fillText(nickname!, 64, 444);

  // The line is x / 1080 + y / 1100 = 1. Use its slightly more conservative
  // x+y=1124 boundary, preserving the full figure on the lower-right side.
  const scale = Math.min(
    660 / figure.height,
    540 / figure.width,
    (1018 + 1010 - 1124) / (figure.width + figure.height - figure.minSum),
  );
  const width = figure.width * scale,
    height = figure.height * scale;
  const left = 1018 - width,
    top = 1010 - height;
  ctx.drawImage(
    figure.source,
    figure.x,
    figure.y,
    figure.width,
    figure.height,
    left,
    top,
    width,
    height,
  );

  ctx.fillStyle = '#503080';
  let nameSize = 84;
  while (nameSize > 20) {
    ctx.font = `600 ${nameSize}px ${font}`;
    const width = ctx.measureText(role.name).width;
    if (left - 30 - width >= 1100 - (1000 - nameSize) + 24) break;
    nameSize--;
  }
  ctx.textAlign = 'right';
  ctx.fillText(role.name, left - 30, 1000);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 1100, 1080, 340);
  ctx.fillStyle = '#503080';
  let bodySize = 58;
  let lines: string[];
  do {
    ctx.font = `600 ${bodySize}px ${font}`;
    lines = quoteLines(ctx, line, 952);
    if (lines.length <= 2) break;
    bodySize--;
  } while (bodySize > 20);
  const startY = lines.length === 1 ? 1220 : 1180;
  lines.forEach((text, i) => ctx.fillText(text, 64, startY + i * 78));

  // Keep only our own brand in the footer; the selected type remains above.
  const logoWidth = 230,
    logoHeight = (logoWidth * logo.naturalHeight) / logo.naturalWidth;
  ctx.drawImage(logo, (1080 - logoWidth) / 2, 1310, logoWidth, logoHeight);
}

export async function createIdentityCard(
  roleId: string,
  mbti: MbtiType | null,
  locale: Locale = currentLocale(),
): Promise<string> {
  // Validate IDs before resolving any asset URL.
  const { role } = identityCopy(roleId, mbti, locale);
  const assets = mbti
    ? await Promise.all([
        loadSilhouette(role.id, locale),
        loadImage(localizedAsset('/brand/logo-horizontal-ink.svg', locale)),
      ])
    : ([
        await loadImage(localizedAsset(`/downloads/portraits/${role.id.toLowerCase()}.png`, locale)),
      ] as const);
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法生成图片');
  if (mbti)
    drawCombination(ctx, assets[0] as Silhouette, assets[1]!, role.id, mbti, locale);
  else drawBasic(ctx, assets[0] as HTMLImageElement, role.id, locale);
  // Production permits data images; blob URLs are blocked by its image CSP.
  return canvas.toDataURL('image/png');
}
