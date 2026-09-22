import { readFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { collectionPage, escapeHtml, withSiteFiling } from './content-render.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=file=>JSON.parse(readFileSync(file,'utf8'));
const revisionPattern=/^r-[a-f0-9]{16}$/;
export function createContentHandler({root,staticRoot}={}) {
  root=resolve(root); staticRoot=resolve(staticRoot??'dist/client');
  let currentPath, snapshot;
  function current() {
    const path=realpathSync(join(root,'current'));
    if(path!==currentPath) {
      if(!path.startsWith(realpathSync(join(root,'releases'))+'/'))throw Error('Invalid content root');
      const manifest=readJson(join(path,'.manifest.json')),index=readJson(join(path,'index.json'));
      if(manifest.schemaVersion!==1||index.schemaVersion!==1||manifest.revision!==index.revision)throw Error('Invalid content release');
      snapshot={path,manifest,index};currentPath=path;
    }
    return snapshot;
  }
  function sitePolicy() {
    try {return readJson(join(staticRoot,'.shadow16-search.json'));}catch{return {indexingEnabled:false,canonicalOrigin:'',entries:[]};}
  }
  function send(req,res,bytes,type,cache='no-cache',status=200) {
    bytes=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
    const etag='"'+hash(bytes)+'"';
    res.setHeader('Content-Type',type);res.setHeader('Cache-Control',cache);res.setHeader('ETag',etag);res.setHeader('X-Content-Type-Options','nosniff');
    if(status===200&&req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
    res.writeHead(status,{'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
  }
  return function contentHandler(req,res) {
    let url;try{url=new URL(req.url,'http://local');}catch{return false;}
    let path;try{path=decodeURIComponent(url.pathname);}catch{return false;}
    const routePath=path.replace(/(?:\/index\.html|\.html|\/)$/,'');
    const isContent=path.startsWith('/content/'),isReading=/^\/(?:en\/)?knowledge(?:\/|\.html$|$)/.test(path)||/^\/(?:en\/)?theater\/(?:archive|[a-z0-9-]+)(?:\.html|\/index\.html|\/)?$/.test(path),isExplore=/^\/(?:en\/)?explore(?:\.html|\/index\.html|\/)?$/.test(path);
    if(!isContent&&!isReading&&!isExplore&&!['/sitemap.xml','/robots.txt'].includes(path))return false;
    if(!['GET','HEAD'].includes(req.method)){send(req,res,'Method not allowed','text/plain; charset=utf-8','no-store',405);return true;}
    if(path.split('/').some(part=>part==='..'||part.startsWith('.'))){send(req,res,'Not found','text/plain','no-store',404);return true;}
    let active;
    try{active=current();}catch{if(!isContent&&!isReading)return false;send(req,res,JSON.stringify({error:'content_unavailable'}),'application/json','no-store',503);return true;}
    const {manifest,index}=active,policy=sitePolicy();
    const enabled=Boolean(policy.indexingEnabled&&manifest.indexingEnabled&&policy.canonicalOrigin===manifest.origin);
    if(isContent) {
      let directory=active.path,name;
      if(path==='/content/v1/index.json')name='index.json';
      else {
        const match=path.match(/^\/content\/v1\/releases\/(r-[a-f0-9]{16})\/(.+)$/);
        if(match&&revisionPattern.test(match[1])){directory=join(root,'releases',match[1]);name=match[2];}
      }
      let contentManifest;try{contentManifest=directory===active.path?manifest:readJson(join(directory,'.manifest.json'));}catch{}
      if(!name||!contentManifest?.files[name]||name.startsWith('html/')||name==='index.json'&&path!=='/content/v1/index.json') {send(req,res,'Not found','text/plain','no-store',404);return true;}
      const type=name.endsWith('.json')?'application/json; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'image/jpeg';
      if(name.endsWith('.json'))res.setHeader('X-Robots-Tag','noindex');
      try {send(req,res,readFileSync(join(directory,name)),type,path==='/content/v1/index.json'?'no-cache':'public, max-age=31536000, immutable');}catch{send(req,res,'Not found','text/plain','no-store',404);}return true;
    }
    if(path==='/robots.txt') {
      const robots=`User-agent: *\nAllow: /\nDisallow: /api/\n\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\n${enabled?'Allow: /\nDisallow: /api/':'Disallow: /'}\n${enabled?`\nSitemap: ${manifest.origin}/sitemap.xml\n`:''}`;
      send(req,res,robots,'text/plain; charset=utf-8');return true;
    }
    if(path==='/sitemap.xml') {
      const entries=new Map();
      if(enabled){for(const entry of policy.entries??[])if(entry.candidate&&entry.kind!=='knowledge')entries.set(entry.path,{});for(const [route,meta]of Object.entries(manifest.routes))if(meta.indexable)entries.set(route,meta);}
      const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...entries].map(([route,meta])=>`<url><loc>${escapeHtml(manifest.origin+route)}</loc>${meta.updatedAt?`<lastmod>${meta.updatedAt}</lastmod>`:''}</url>`).join('')+'</urlset>\n';send(req,res,xml,'application/xml; charset=utf-8');return true;
    }
    if(routePath!==path){res.writeHead(308,{Location:routePath+url.search,'Cache-Control':'no-cache'});res.end();return true;}
    let html;
    if(isExplore)html=collectionPage(index,{locale:path.startsWith('/en/')?'en':'zh',origin:manifest.origin,cssUrl:manifest.cssUrl,indexingEnabled:enabled,path:'/explore'},{exploreEntries:policy.entries});
    else if(manifest.routes[path])html=readFileSync(join(active.path,manifest.routes[path].file),'utf8');
    if(!html){send(req,res,path.startsWith('/en/')?'This content is unavailable.':'这篇内容暂不可用。','text/plain; charset=utf-8','no-cache',404);return true;}
    html=withSiteFiling(html);
    if(!enabled)html=html.replace(/<meta name="robots" content="[^"]*">/,'<meta name="robots" content="noindex, follow">');
    if(!enabled||url.search)res.setHeader('X-Robots-Tag','noindex, follow');
    send(req,res,html,'text/html; charset=utf-8');return true;
  };
}
