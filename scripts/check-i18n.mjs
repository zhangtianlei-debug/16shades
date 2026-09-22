import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as routing from '../app/i18n/routing.mjs';
const english = JSON.parse(readFileSync('app/i18n/en.json', 'utf8'));
const code = ts.transpileModule(readFileSync('app/i18n/core.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText;
const exports = {};
vm.runInNewContext(code, {exports, require: (path) => path.endsWith('routing.mjs') ? routing : english, console, URL, document: undefined, window: undefined});
const {resolveLocale, translateText, localizedHref, localizedAsset, missingTranslations} = exports;
for (const [explicit, saved, languages, expected] of [
  [null,null,['en-US'],'en'],[null,null,['zh-CN'],'zh'],[null,null,['zh-TW','en'],'zh'],[null,null,['fr-FR'],'en'],[null,null,['de-DE','zh-CN'],'zh'],[null,'zh',['en-US'],'zh'],[null,'en',['zh-CN'],'en'],['en','zh',['zh-CN'],'en'],['zh','en',['en-US'],'zh'],['invalid','invalid',[],'en'],
]) assert.equal(resolveLocale(explicit,saved,languages),expected);
assert.equal(localizedHref('/prototype?view=quiz#question-card','en'),'/en/prototype?view=quiz#question-card');
assert.equal(localizedHref('/en/prototype/types/t01','zh'),'/prototype/types/t01');
assert.equal(localizedHref('/api/session','en'),'/api/session');
assert.equal(localizedHref('https://example.com/path','en'),'https://example.com/path');
assert.equal(localizedAsset('/downloads/portraits/t01.png','en'),'/en-assets/downloads/portraits/t01.png');
assert.equal(localizedAsset('/downloads/cards/t01.png','en'),'/en-assets/downloads/cards/t01.png');
assert.equal(localizedAsset('/question-illustrations/brand-frosted-v1.webp','en'),'/en-assets/question-illustrations/brand-frosted-v1.svg');
for (const [source, translation] of Object.entries(english)) {
 assert.equal(typeof translation,'string',source);
 assert.ok(translation.trim(),source);
 assert.ok(!/\p{Script=Han}/u.test(translation),source);
 assert.ok(!/ProperNAME\d*TOKEN|TOKEN[A-Z]*|\bShun Cheng\b/.test(translation),source);
 assert.equal(translateText(source,'zh'),source,'Chinese source must stay exact');
}
let checked=0;
function inspect(value,location) {
 if(typeof value==='string' && /\p{Script=Han}/u.test(value)) {
  assert.ok(Object.hasOwn(english,value),`Missing catalog key: ${location}: ${value.slice(0,120)}`);
  assert.ok(!/\p{Script=Han}/u.test(translateText(value,'en'))); checked++;
 } else if (Array.isArray(value)) value.forEach((item,i)=>inspect(item,`${location}[${i}]`));
 else if(value && typeof value==='object')for(const [key,item] of Object.entries(value))inspect(item,`${location}.${key}`);
}
for(const file of ['candidate-form.json','social-content.json','relationship-data.json','population-estimate-data.json','knowledge-content.json','personal-report-copy.json']) inspect(JSON.parse(readFileSync('app/prototype/'+file,'utf8')),file);

const han = /\p{Script=Han}/u;
const sourceRoot = process.cwd();
function sourceFiles(directory) {
 const root = join(sourceRoot, directory);
 return readdirSync(root, {withFileTypes: true}).flatMap((entry) => {
  const pathname = join(root, entry.name);
  if (entry.isDirectory()) return sourceFiles(join(directory, entry.name));
  return /\.(?:ts|tsx)$/.test(entry.name) ? [pathname] : [];
 });
}
function lineOf(source, position) { return source.getLineAndCharacterOfPosition(position).line + 1; }
function staticTexts(node) {
 if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
 if (ts.isParenthesizedExpression(node)) return staticTexts(node.expression);
 if (ts.isConditionalExpression(node)) return [...staticTexts(node.whenTrue), ...staticTexts(node.whenFalse)];
 if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
  const left = staticTexts(node.left), right = staticTexts(node.right);
  return left.length && right.length ? left.flatMap((a) => right.map((b) => a + b)) : [];
 }
 return [];
}
function templateText(node) {
 if (!ts.isTemplateExpression(node)) return null;
 return node.head.text + node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join('');
}
let staticCalls=0, dynamicTemplates=0, rawJsx=0;
const uiIssues = [];
function reportUiIssue(message) { uiIssues.push(message); }
function checkTranslatedText(text, location) {
 if (!han.test(text)) return;
 missingTranslations.clear();
 const translated = translateText(text, 'en');
 if (han.test(translated)) reportUiIssue(`English output still contains Chinese: ${location}: ${text.slice(0,120)}`);
 if (missingTranslations.size) reportUiIssue(`English fallback used: ${location}: ${text.slice(0,120)}`);
 else staticCalls++;
}
function isVisibleDomAttribute(node, source) {
 if (!['alt', 'title', 'placeholder', 'aria-label', 'aria-description', 'aria-valuetext'].includes(node.name.getText(source))) return false;
 const opening = node.parent?.parent;
 if (!opening || (!ts.isJsxOpeningElement(opening) && !ts.isJsxSelfClosingElement(opening))) return false;
 return /^[a-z]/.test(opening.tagName.getText(source));
}
const uiSourceFiles = [...sourceFiles('app').filter((pathname) => !relative(sourceRoot, pathname).startsWith('app/i18n/')), ...sourceFiles('components')];
for (const pathname of uiSourceFiles) {
 const text = readFileSync(pathname, 'utf8');
 const source = ts.createSourceFile(pathname, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 const display = relative(sourceRoot, pathname);
 const visit = (node) => {
  const location = `${display}:${lineOf(source, node.getStart(source))}`;
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && (node.expression.text === 't' || node.expression.text === 'tn') && node.arguments.length) {
   const argument = node.arguments[0];
   for (const value of staticTexts(argument)) checkTranslatedText(value, location);
   const template = templateText(argument);
   if (template && han.test(template)) {
    // Runtime values can be data-driven. English placeholders isolate whether the
    // static template can be translated without treating unknown dynamic data as a miss.
    const concrete = template.replace(/\{\d+\}/g, 'English placeholder');
    missingTranslations.clear();
    const translated = translateText(concrete, 'en');
    if (han.test(translated)) reportUiIssue(`English template output still contains Chinese: ${location}: ${template}`);
    if (missingTranslations.size) reportUiIssue(`English fallback used by template: ${location}: ${template}`);
    else dynamicTemplates++;
   }
  }
  if (ts.isJsxText(node) && han.test(node.text)) {
   rawJsx++;
   reportUiIssue(`Untranslated raw JSX text: ${location}: ${node.text.trim().slice(0,120)}`);
  }
  if (ts.isJsxAttribute(node) && isVisibleDomAttribute(node, source) && node.initializer && ts.isStringLiteral(node.initializer) && han.test(node.initializer.text)) {
   rawJsx++;
   reportUiIssue(`Untranslated raw JSX attribute: ${location}: ${node.initializer.text.slice(0,120)}`);
  }
  ts.forEachChild(node, visit);
 };
 visit(source);
}

let checkedAssets=0;
function checkEnglishAsset(asset) {
 assert.ok(existsSync(join('public', asset.slice(1))), `Missing source asset: ${asset}`);
 const localized = localizedAsset(asset, 'en');
 assert.ok(localized.startsWith('/en-assets/'), `Asset was not localized: ${asset}`);
 assert.ok(existsSync(join('public', localized.slice(1))), `Missing English asset: ${localized} (from ${asset})`);
 checkedAssets++;
}
for (const filename of readdirSync('public/brand')) checkEnglishAsset(`/brand/${filename}`);
for (let index = 1; index <= 16; index++) {
 const id = `t${String(index).padStart(2, '0')}`;
 checkEnglishAsset(`/characters-transparent/${id}.svg`);
 checkEnglishAsset(`/downloads/portraits/${id}.png`);
 checkEnglishAsset(`/downloads/cards/${id}.png`);
}
for (const asset of ['/downloads/shadow16-all-characters.zip', '/downloads/使用说明.md', '/downloads/manifest.json', '/question-illustrations/brand-frosted-v1.webp']) checkEnglishAsset(asset);
assert.deepEqual(uiIssues, [], `UI i18n issues (${uiIssues.length}):\n${uiIssues.join('\n')}`);
assert.equal(missingTranslations.size,0);
console.log(`Language preference, links and assets passed; ${Object.keys(english).length} English messages, ${checked} content values, ${staticCalls} static UI calls, ${dynamicTemplates} catalog templates, ${rawJsx} raw JSX values and ${checkedAssets} localized assets checked; Chinese source strings unchanged.`);
