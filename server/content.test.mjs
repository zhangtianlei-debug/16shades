import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { publishContent, activateContent } from '../scripts/publish-content.mjs';
import { validateContent } from './content-schema.mjs';
import { createContentHandler } from './content.mjs';
import { markdown } from './content-render.mjs';
import sharp from 'sharp';
const pair=(zh,en)=>({zh,en});
const article=(slug='first',category='basics')=>({slug,category,status:'published',title:pair('文章 '+slug,'Article '+slug),summary:pair('这是摘要。','A useful summary.'),kind:pair('项目定义','Project definition'),body:pair('## 正文\n\n可见的中文正文。\n\n[研究](https://example.org/paper)','## Body\n\nReadable English body.\n\n[Research](https://example.org/paper)'),related:[],updatedAt:'2026-09-07',indexable:true});
const episode=(id='001')=>({id,number:Number(id),status:'published',title:pair('故事 '+id,'Story '+id),summary:pair('虚构的故事。','A fictional story.'),cast:['T01'],coverPanel:0,updatedAt:'2026-09-15',indexable:true,panels:[{id:'01',title:pair('开场','Opening'),alt:pair('人物在办公室。','A character in an office.'),src:pair('image.png','image.png'),width:30,height:40,lines:pair(['人物：你好。'],['Character: Hello.'])}]});
const settings=()=>({schemaVersion:1,categories:[{id:'basics',label:pair('基础','Basics'),order:1}],featuredWiki:['first'],wikiDirectory:['first']});
async function fixture(t) {
  const dir=await mkdtemp(join(tmpdir(),'shade-content-')),source=join(dir,'source'),root=join(dir,'runtime'),staticRoot=join(dir,'site');
  await Promise.all(['wiki','theater'].map(folder=>mkdir(join(source,folder),{recursive:true})));await mkdir(staticRoot);
  const write=async(path,data)=>writeFile(join(source,path),JSON.stringify(data));
  await write('settings.json',settings());await write('wiki/first.json',article());await write('theater/001.json',episode());
  await writeFile(join(dir,'image.png'),await sharp({create:{width:30,height:40,channels:3,background:'#62417b'}}).png().toBuffer());
  await writeFile(join(staticRoot,'.shadow16-search.json'),JSON.stringify({indexingEnabled:false,canonicalOrigin:'https://shades16.com',entries:[{kind:'character',path:'/prototype/types/t01',locale:'zh',title:'人物',description:'人物介绍',candidate:true}]}));
  await writeFile(join(staticRoot,'build-sentinel'),'immutable-app-build');
  const publish=(extra={})=>publishContent({source,root,projectRoot:dir,sharp,policy:{canonicalOrigin:'https://shades16.com',indexingEnabled:false},...extra});
  const handler=createContentHandler({root,staticRoot});
  const server=createServer((req,res)=>{if(!handler(req,res)){res.writeHead(404);res.end('fallback');}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
  const origin=`http://127.0.0.1:${server.address().port}`;
  return {dir,source,root,staticRoot,write,publish,get:(path,options)=>fetch(origin+path,options)};
}
test('schema checks identities, references, languages and publication state without fixed counts',()=>{
  const data={settings:settings(),wiki:[article()],theater:[episode()]};
  assert.equal(validateContent(data).wiki.length,1);
  const duplicate=structuredClone(data);duplicate.wiki.push(article());assert.throws(()=>validateContent(duplicate),/Duplicate/);
  const broken=structuredClone(data);broken.wiki[0].related=['missing'];assert.throws(()=>validateContent(broken),/unknown related/);
  broken.wiki[0].related=[];broken.wiki[0].body.en='';assert.throws(()=>validateContent(broken),/body.en/);
  const draft=article('draft');draft.status='draft';data.wiki.push(draft);data.wiki[0].related=['draft'];
  assert.deepEqual(validateContent(data).wiki[0].related,[]);
});
test('independent publication updates a running server, both languages and new category without app rebuild',async t=>{
  const f=await fixture(t),first=await f.publish();
  let index=await (await f.get('/content/v1/index.json')).json();
  assert.equal(index.wiki.articles.length,1);const oldDetail=index.theater.episodes[0].url;
  const settings2=settings();settings2.categories.push({id:'new-topic',label:pair('新主题','New topic'),order:2});
  await f.write('settings.json',settings2);await f.write('wiki/second.json',article('second','new-topic'));await f.write('theater/005.json',episode('005'));
  const second=await f.publish();assert.notEqual(first.revision,second.revision);
  index=await(await f.get('/content/v1/index.json')).json();
  assert.equal(index.wiki.articles.length,2);assert.equal(index.wiki.categories.length,2);assert.equal(index.theater.episodes.length,2);
  assert.equal(await readFile(join(f.staticRoot,'build-sentinel'),'utf8'),'immutable-app-build');
  for(const prefix of ['','/en']) {
    const wikiHtml=await(await f.get(prefix+'/knowledge/second')).text();assert.ok(wikiHtml.includes(prefix? 'Readable English body.':'可见的中文正文。'));
    assert.ok(wikiHtml.includes('rel="canonical"'));assert.ok(wikiHtml.includes('hreflang="zh-CN"'));assert.ok(wikiHtml.includes('application/ld+json'));assert.ok(wikiHtml.includes('https://example.org/paper'));
    const comic=await(await f.get(prefix+'/theater/005')).text();assert.ok(comic.includes(prefix?'Character: Hello.':'人物：你好。'));assert.ok(comic.includes('width="30" height="40"'));
  }
  assert.equal((await f.get(oldDetail)).status,200,'old immutable detail still resolves');
  const search=await(await f.get(index.wiki.search.en)).json();assert.ok(search.entries.some(entry=>entry.slug==='second'));
  assert.ok((await(await f.get('/explore')).text()).includes('/knowledge/second'));
});
test('noindex gate, safe paths, conditional requests and missing content states',async t=>{
  const f=await fixture(t);
  assert.equal((await f.get('/content/v1/index.json')).status,503);
  await f.publish();
  const response=await f.get('/content/v1/index.json'),index=await response.json();
  assert.equal((await f.get('/content/v1/index.json',{headers:{'If-None-Match':response.headers.get('etag')}})).status,304);
  assert.equal((await f.get('/content/v1/index.json',{method:'POST'})).status,405);
  assert.equal((await f.get('/content/v1/releases/'+index.revision+'/.manifest.json')).status,404);
  assert.equal((await f.get('/content/v1/releases/'+index.revision+'/html/knowledge/first.html')).status,404);
  assert.equal((await f.get('/knowledge/unknown')).status,404);
  assert.equal((await f.get('/theater/999')).status,404);
  assert.equal((await f.get('/knowledge/first/')).url.endsWith('/knowledge/first'),true);
  assert.equal((await f.get('/knowledge.html')).url.endsWith('/knowledge'),true);
  assert.equal((await f.get('/en/knowledge.html')).url.endsWith('/en/knowledge'),true);
  assert.equal((await f.get('/knowledge/first',{method:'HEAD'})).headers.get('x-robots-tag'),'noindex, follow');
  assert.ok(!(await(await f.get('/sitemap.xml')).text()).includes('<loc>'));
  assert.ok((await(await f.get('/robots.txt')).text()).includes('User-agent: OAI-SearchBot'));
});
test('withdrawal removes public discovery and detail; bad release leaves active snapshot untouched; rollback works',async t=>{
  const f=await fixture(t),first=await f.publish();
  const next=article('first');next.status='draft';await f.write('wiki/first.json',next);
  await f.publish();assert.equal((await f.get('/knowledge/first')).status,404);
  assert.equal((await(await f.get('/content/v1/index.json')).json()).wiki.articles.length,0);
  await activateContent(f.root,first.revision);assert.equal((await f.get('/knowledge/first')).status,200);
  const bad=episode();bad.panels[0].width=42;await f.write('theater/001.json',bad);
  await assert.rejects(f.publish(),/size mismatch/);
  assert.ok((await realpath(join(f.root,'current'))).endsWith(first.revision));
  await writeFile(join(f.root,'releases',first.revision,'wiki/first.json'),'tampered');
  await assert.rejects(activateContent(f.root,first.revision),/checksum mismatch/);
});
test('rendering treats unsafe inline input as text and preserves headings and source links',()=>{
  const html=markdown('## A\n\n<script>evil</script> [bad](javascript:alert) **safe**\n\n<a id="P01"></a>\n\n[paper](https://example.org/a(b))','en');
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('<strong>safe</strong>'));assert.ok(html.includes('id="P01"'));assert.ok(html.includes('href="https://example.org/a(b)"'));
  for(const filename of ['01_心理学底层.md',encodeURIComponent('01_心理学底层.md')])assert.ok(markdown(`[Research](${filename})`,'en').includes('href="/en/knowledge/theory-sources"'));
  assert.ok(markdown('[Next](new-article)','zh').includes('href="/knowledge/new-article"'));
});
test('indexing gate merges latest content with existing site routes only when both policies agree',async t=>{
  const f=await fixture(t),origin='https://shades16.com';
  await f.publish({policy:{canonicalOrigin:origin,indexingEnabled:true}});
  assert.ok(!(await(await f.get('/sitemap.xml')).text()).includes('<loc>'),'disabled application policy still wins');
  await writeFile(join(f.staticRoot,'.shadow16-search.json'),JSON.stringify({indexingEnabled:true,canonicalOrigin:origin,entries:[{kind:'character',path:'/prototype/types/t01',locale:'zh',candidate:true},{kind:'knowledge',path:'/knowledge/removed-old-article',locale:'zh',candidate:true}]}));
  const sitemap=await(await f.get('/sitemap.xml')).text();
  for(const path of ['/prototype/types/t01','/knowledge/first','/en/knowledge/first','/theater/001','/en/theater/001'])assert.ok(sitemap.includes(origin+path));
  assert.ok(!sitemap.includes('removed-old-article'));assert.ok(sitemap.includes('<lastmod>2026-09-15</lastmod>'));
  const html=await(await f.get('/theater/001')).text();assert.ok(html.includes('content="index, follow"'));
  assert.ok((await(await f.get('/robots.txt')).text()).includes(`Sitemap: ${origin}/sitemap.xml`));
});
