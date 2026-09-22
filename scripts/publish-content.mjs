import { readFile, writeFile, readdir, mkdir, rename, symlink, rm, stat, realpath } from 'node:fs/promises';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { validateContent } from '../server/content-schema.mjs';
import { wikiPage, theaterPage, collectionPage, contentCss } from '../server/content-render.mjs';

const site=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha=value=>createHash('sha256').update(value).digest('hex');
const json=async file=>JSON.parse(await readFile(file,'utf8'));
export async function readContent(source=join(site,'content-source')) {
  const readAll=async folder=>Promise.all((await readdir(join(source,folder))).filter(name=>name.endsWith('.json')).sort().map(name=>json(join(source,folder,name))));
  return {settings:await json(join(source,'settings.json')),wiki:await readAll('wiki'),theater:await readAll('theater')};
}
export async function activateContent(root,revision) {
  if(!/^r-[a-f0-9]{16}$/.test(revision))throw Error('Invalid content revision');
  const directory=join(root,'releases',revision), manifest=await json(join(directory,'.manifest.json'));
  if(manifest.revision!==revision)throw Error('Release manifest mismatch');
  for(const [name,hash] of Object.entries(manifest.files)) {
    if(name.startsWith('/')||name.split('/').some(part=>part==='..'||part===''))throw Error('Invalid release file path');
    if(sha(await readFile(join(directory,name)))!==hash)throw Error(`Content checksum mismatch: ${name}`);
  }
  const link=join(root,`.activate-${process.pid}-${Date.now()}`);
  await symlink(`releases/${revision}`,link);
  await rename(link,join(root,'current'));
  return revision;
}
export async function publishContent({source=join(site,'content-source'),root=join(site,'var/content'),projectRoot=site,activate=true,checkOnly=false,policy,sharp:sharpOverride}={}) {
  const raw=await readContent(source), publication=validateContent(raw);
  const {settings,wiki,theater}=publication;
  const searchPolicy=policy??await json(join(site,'app/search/config.json'));
  if(typeof searchPolicy.indexingEnabled!=='boolean'||(searchPolicy.canonicalOrigin&&!/^https:\/\/[^/]+$/.test(searchPolicy.canonicalOrigin)))throw Error('Invalid search policy');
  const origin=searchPolicy.canonicalOrigin||'http://localhost:3106';
  const releaseOrigin=(await json(join(site,'release.json'))).publicOrigin;
  if(searchPolicy.indexingEnabled&&releaseOrigin&&releaseOrigin!==origin)throw Error('Indexing requires the approved public origin');
  const inputs=new Map();
  const projectReal=await realpath(projectRoot);
  for(const episode of theater) for(const panel of episode.panels) for(const locale of ['zh','en']) {
    const path=await realpath(resolve(projectRoot,panel.src[locale]));
    if(!path.startsWith(projectReal+sep))throw Error(`Asset escapes project root: ${panel.src[locale]}`);
    if(!inputs.has(path))inputs.set(path,await readFile(path));
  }
  if(checkOnly)return {result:'passed',articles:wiki.length,episodes:theater.length,drafts:raw.wiki.length+raw.theater.length-wiki.length-theater.length,assets:inputs.size};
  const imageProcessor=sharpOverride??sharp;
  // Includes template and assets: identical inputs reuse the same immutable revision.
  const renderer=await readFile(join(site,'server/content-render.mjs'));
  const revision='r-'+sha(JSON.stringify({publication,origin,indexingEnabled:searchPolicy.indexingEnabled})+sha(renderer)+[...inputs].map(([path,bytes])=>relative(projectRoot,path)+sha(bytes)).join('\n')).slice(0,16);
  await mkdir(join(root,'releases'),{recursive:true});
  const destination=join(root,'releases',revision);
  try { await stat(join(destination,'.manifest.json')); if(activate)await activateContent(root,revision); return {result:'reused',revision,articles:wiki.length,episodes:theater.length}; } catch(error) { if(error.code!=='ENOENT')throw error; }
  const stage=join(root,`.stage-${process.pid}-${Date.now()}`); await mkdir(stage,{recursive:true});
  const files={},routes={},base=`/content/v1/releases/${revision}`;
  const write=async(name,value)=>{const bytes=typeof value==='string'?Buffer.from(value):value;await mkdir(dirname(join(stage,name)),{recursive:true});await writeFile(join(stage,name),bytes);files[name]=sha(bytes);};
  const writeJson=(name,value)=>write(name,JSON.stringify(value)+'\n');
  const cssUrl=base+'/style.css';
  const index={schemaVersion:1,revision,generatedAt:new Date().toISOString(),wiki:{categories:settings.categories.slice().sort((a,b)=>(a.order??0)-(b.order??0)),featured:settings.featuredWiki,directory:settings.wikiDirectory,articles:[],search:{zh:base+'/search/zh.json',en:base+'/search/en.json'}},theater:{episodes:[]}};
  const publicWiki=wiki.map(({status,indexable,...item})=>({...item,schemaVersion:1}));
  const publicEpisodes=[];
  try {
    await write('style.css',contentCss);
    for(const article of publicWiki) {
      const {body,sources,schemaVersion,...summary}=article;
      index.wiki.articles.push({...summary,url:`${base}/wiki/${article.slug}.json`});
      await writeJson(`wiki/${article.slug}.json`,article);
    }
    for(const locale of ['zh','en'])await writeJson(`search/${locale}.json`,{schemaVersion:1,revision,locale,entries:publicWiki.map(article=>({slug:article.slug,text:`${article.title[locale]} ${article.summary[locale]} ${article.body[locale]}`}))});
    for(const episode of theater.slice().sort((a,b)=>a.number-b.number)) {
      const {status,indexable,...detail}=structuredClone(episode); detail.schemaVersion=1;
      for(const panel of detail.panels) for(const locale of ['zh','en']) {
        const original=await realpath(resolve(projectRoot,panel.src[locale]));
        const image=imageProcessor(inputs.get(original)); const metadata=await image.metadata();
        if(metadata.width!==panel.width||metadata.height!==panel.height)throw Error(`Image size mismatch: ${episode.id}/${panel.id}/${locale}, actual ${metadata.width}x${metadata.height}`);
        const name=`assets/${episode.id}/${locale}/${panel.id}.jpg`;
        await write(name,await image.jpeg({quality:82,chromaSubsampling:'4:2:0',progressive:false,mozjpeg:false}).toBuffer());
        panel.src[locale]=`${base}/${name}`;
      }
      publicEpisodes.push(detail);
      const cover={};
      for(const locale of ['zh','en']) {
        const panel=episode.panels[episode.coverPanel],original=await realpath(resolve(projectRoot,panel.src[locale]));
        const name=`assets/${episode.id}/${locale}/cover.jpg`;
        await write(name,await imageProcessor(inputs.get(original)).resize(480,640,{fit:'cover'}).jpeg({quality:78,progressive:false}).toBuffer()); cover[locale]=`${base}/${name}`;
      }
      index.theater.episodes.push({id:detail.id,number:detail.number,title:detail.title,summary:detail.summary,cast:detail.cast,updatedAt:detail.updatedAt,pageCount:detail.panels.length,cover,url:`${base}/theater/${detail.id}.json`});
      await writeJson(`theater/${detail.id}.json`,detail);
    }
    for(const locale of ['zh','en']) {
      const options={locale,origin,cssUrl,indexingEnabled:searchPolicy.indexingEnabled};
      const add=async(path,html,indexable,updatedAt)=>{const localized=locale==='en'?'/en'+path:path;const file=`html${localized}.html`;await write(file,html);routes[localized]={file,indexable,updatedAt};};
      for(const article of wiki)await add(`/knowledge/${article.slug}`,wikiPage(article,wiki,options),article.indexable,article.updatedAt);
      for(const detail of publicEpisodes){const sourceItem=theater.find(item=>item.id===detail.id);await add(`/theater/${detail.id}`,theaterPage({...detail,indexable:sourceItem.indexable},publicEpisodes,options),sourceItem.indexable,detail.updatedAt);}
      await add('/knowledge',collectionPage(index,{...options,path:'/knowledge'}),true);
      await add('/theater/archive',collectionPage(index,{...options,path:'/theater/archive'}),true);
    }
    await writeJson('index.json',index);
    // Private publication metadata is never exposed by the HTTP adapter.
    await writeFile(join(stage,'.manifest.json'),JSON.stringify({schemaVersion:1,revision,origin,indexingEnabled:searchPolicy.indexingEnabled,cssUrl,routes,files},null,2)+'\n');
    await rename(stage,destination);
    if(activate)await activateContent(root,revision);
    return {result:'published-locally',revision,articles:wiki.length,episodes:theater.length,drafts:raw.wiki.length+raw.theater.length-wiki.length-theater.length,files:Object.keys(files).length,root};
  } catch(error) { await rm(stage,{recursive:true,force:true}); throw error; }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?undefined:args[i+1];};
  try {
    const root=resolve(value('--root')??join(site,'var/content'));
    if(value('--activate'))console.log(JSON.stringify({activated:await activateContent(root,value('--activate')),root}));
    else console.log(JSON.stringify(await publishContent({root,source:value('--source')?resolve(value('--source')):undefined,checkOnly:args.includes('--check'),activate:!args.includes('--no-activate')})));
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
