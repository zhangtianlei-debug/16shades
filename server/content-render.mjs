export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export function withSiteFiling(html) {
  if (html.includes('https://beian.miit.gov.cn/') || !/<footer\b/i.test(html)) return html;
  return html.replace(/<\/footer>/i, '<a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">京ICP备2026062660号-1</a></footer>');
}
export const localizedPath = (path, locale) => locale === 'en' ? `/en${path}` : path;
const labels = {
  zh: { brand:'16暗影', home:'首页', wiki:'知识库', theater:'小剧场', directory:'内容目录', updated:'更新于', related:'继续阅读', source:'来源', read:'进入沉浸阅读', fiction:'本期为虚构人物故事。', transcript:'台词与画面说明', all:'全部文章', about:'关于', privacy:'隐私', skip:'跳到正文' },
  en: { brand:'16 Shades', home:'Home', wiki:'Wiki', theater:'Theater', directory:'Content directory', updated:'Updated', related:'Keep reading', source:'Source', read:'Open immersive reader', fiction:'This is a fictional character story.', transcript:'Dialogue and scene descriptions', all:'All articles', about:'About', privacy:'Privacy', skip:'Skip to content' },
};
function target(url, locale) {
  if (/^https?:\/\//.test(url) || /^#[A-Za-z0-9_-]+$/.test(url)) return url;
  const code = url.match(/(?:#|^)([PM]\d{2})$/i)?.[1].toLowerCase();
  if (code) return localizedPath(`/knowledge/${code[0] === 'p' ? 'psychology' : 'mechanism'}-${code}`, locale);
  let decoded = url;
  try { decoded = decodeURIComponent(url); } catch { /* Invalid escapes are not links. */ }
  if (decoded === '01_心理学底层.md') return localizedPath('/knowledge/theory-sources', locale);
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url)) return localizedPath(`/knowledge/${url}`, locale);
  if (/^\/(?!\/)[^\s<>"']*$/.test(url)) return url.startsWith('/en/') ? url : localizedPath(url, locale);
  return null;
}
function inline(value, locale) {
  return String(value).replace(/<[^>]*>/g, '').split(/(\[[^\]]+\]\((?:[^()]|\([^()]*\))*\)|\*\*[^*]+\*\*|`[^`]+`)/g).map(part => {
    const link = part.match(/^\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)$/);
    if (link) { const url = target(link[2], locale); return url ? `<a href="${escapeHtml(url)}">${escapeHtml(link[1])}</a>` : escapeHtml(link[1]); }
    if (part.startsWith('**')) return `<strong>${escapeHtml(part.slice(2,-2))}</strong>`;
    if (part.startsWith('`')) return `<code>${escapeHtml(part.slice(1,-1))}</code>`;
    return escapeHtml(part);
  }).join('');
}
export function markdown(body, locale) {
  const lines = body.split('\n'), blocks = []; let i = 0, section = 0;
  const isBlock = line => /^(?:#{1,6}\s|[-*]\s|\d+[.)]\s|\||```|<a\s|>\s)/.test(line);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || /^---+$/.test(line)) { i++; continue; }
    const anchor = line.match(/^<a\s+id="([A-Za-z0-9_-]+)"[^>]*><\/a>$/);
    if (anchor) { blocks.push(`<span id="${anchor[1]}"></span>`); i++; continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { if (heading[1].length > 1) { const level = Math.min(heading[1].length, 4); blocks.push(`<h${level} id="section-${++section}">${inline(heading[2],locale)}</h${level}>`); } i++; continue; }
    if (line.startsWith('```')) { const code=[]; while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]); blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); i++; continue; }
    if (line.startsWith('|') && /^\|[\s:|-]+\|$/.test(lines[i+1] ?? '')) {
      const cells = row => row.replace(/^\||\|$/g,'').split('|').map(cell=>inline(cell.trim(),locale));
      const heads=cells(line); i+=2; const rows=[]; while(i<lines.length&&lines[i].startsWith('|')) rows.push(cells(lines[i++]));
      blocks.push(`<div class="table-scroll"><table><thead><tr>${heads.map(cell=>`<th scope="col">${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    if (/^(?:[-*]|\d+[.)])\s/.test(line)) { const ordered=/^\d/.test(line), pattern=ordered?/^\d+[.)]\s+/:/^[-*]\s+/, items=[]; while(i<lines.length&&pattern.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(pattern,''),locale)}</li>`); const tag=ordered?'ol':'ul'; blocks.push(`<${tag}>${items.join('')}</${tag}>`); continue; }
    if (line.startsWith('>')) { blocks.push(`<blockquote>${inline(line.replace(/^>\s?/,''),locale)}</blockquote>`); i++; continue; }
    const paragraph=[line]; i++; while(i<lines.length&&lines[i].trim()&&!isBlock(lines[i])) paragraph.push(lines[i++]);
    blocks.push(`<p>${inline(paragraph.join('\n'),locale)}</p>`);
  }
  return blocks.join('\n');
}
export const contentCss = `:root{color-scheme:light;--ink:#282231;--purple:#654079;--line:#e5dfeb}*{box-sizing:border-box}body{margin:0;background:#faf9fc;color:var(--ink);font:16px/1.85 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}a{color:var(--purple);text-underline-offset:4px}a:hover{color:#342047}.skip{position:absolute;top:-80px}.skip:focus{top:8px;background:white;padding:12px;z-index:2}header.site{padding:22px max(24px,calc((100% - 1100px)/2));display:flex;gap:24px;align-items:center;border-bottom:1px solid var(--line);background:white;flex-wrap:wrap}header.site .brand{font-size:22px;font-weight:750;text-decoration:none;margin-right:auto}header.site nav{display:flex;gap:20px;flex-wrap:wrap}header.site a{text-decoration:none}main{max-width:960px;margin:44px auto 80px;padding:0 26px}h1{font-size:clamp(30px,5vw,46px);line-height:1.35;margin:12px 0 18px;letter-spacing:-.03em}h2{font-size:25px;line-height:1.5;margin:44px 0 16px}h3{font-size:20px;line-height:1.6}p{margin:14px 0}.eyebrow,.meta{font-size:14px;color:#75677f}.lead{font-size:18px;color:#65566f}.prose{max-width:800px}.prose p,.prose li{overflow-wrap:anywhere}.prose blockquote{border-left:3px solid #ad97c2;padding:4px 22px;margin:24px 0;background:#f1ecf6}.prose code{font-size:14px}.prose pre{overflow:auto;background:#eee9f3;padding:18px;border-radius:8px}.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;vertical-align:top;border:1px solid var(--line);padding:12px}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.card{display:block;padding:24px;border:1px solid var(--line);border-radius:12px;background:white;text-decoration:none;color:var(--ink)}.card h2,.card h3{margin:6px 0;font-size:20px}.card p{font-size:15px;color:#73667d}.pill-links{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}.pill-links a{padding:5px 14px;border:1px solid var(--line);border-radius:30px;text-decoration:none}.action{display:inline-block;background:var(--purple);color:white;padding:12px 22px;border-radius:7px;text-decoration:none;margin:12px 0}.action:hover{color:white;background:#4b2d60}.comic-page{margin:40px 0}.comic-page img{display:block;width:100%;max-width:760px;height:auto;margin:0 auto;border:1px solid var(--line)}figcaption{max-width:760px;margin:16px auto}.dialogue{padding:16px 22px;background:white;border:1px solid var(--line);border-radius:8px}.dialogue p{margin:7px 0}footer{border-top:1px solid var(--line);padding:24px;display:flex;justify-content:center;gap:24px;flex-wrap:wrap;font-size:14px}.related{margin-top:48px;border-top:1px solid var(--line);padding-top:12px}img{max-width:100%}.thumb{width:100%;aspect-ratio:3/2;object-fit:cover;object-position:top;border-radius:6px}.notice{padding:16px 22px;background:#f0ebf5;border-radius:8px}@media(max-width:640px){header.site{gap:14px;padding:16px 20px}header.site nav{gap:14px;font-size:14px}main{margin-top:28px;padding:0 20px}.cards{grid-template-columns:1fr}.card{padding:20px}}`;
export function documentHtml({ title, description, path, locale, origin, cssUrl, body, structured, indexable=false, indexingEnabled=false, image }) {
  const c=labels[locale], canonical=new URL(localizedPath(path,locale),origin).href;
  const alt=locale==='en'?'zh':'en', altPath=localizedPath(path,alt);
  const json=JSON.stringify(structured ?? {}).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="${locale==='en'?'en':'zh-CN'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${indexable&&indexingEnabled?'index, follow':'noindex, follow'}"><link rel="canonical" href="${escapeHtml(canonical)}">${[['zh-CN',path],['en',`/en${path}`],['x-default',path]].map(([lang,url])=>`<link rel="alternate" hreflang="${lang}" href="${escapeHtml(new URL(url,origin).href)}">`).join('')}<meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}">${image?`<meta property="og:image" content="${escapeHtml(new URL(image,origin).href)}">`:''}<link rel="stylesheet" href="${escapeHtml(cssUrl)}"><script type="application/ld+json">${json}</script></head><body><a class="skip" href="#main">${c.skip}</a><header class="site"><a class="brand" href="${localizedPath('/prototype',locale)}">${c.brand}</a><nav aria-label="${c.directory}"><a href="${localizedPath('/knowledge',locale)}">${c.wiki}</a><a href="${localizedPath('/theater',locale)}">${c.theater}</a><a href="${localizedPath('/explore',locale)}">${c.directory}</a><a href="${altPath}" lang="${alt==='zh'?'zh-CN':'en'}">${alt==='en'?'EN':'中文'}</a></nav></header><main id="main">${body}</main><footer><a href="${localizedPath('/about',locale)}">${c.about}</a><a href="${localizedPath('/privacy',locale)}">${c.privacy}</a><a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">京ICP备2026062660号-1</a><span>${c.brand}</span></footer></body></html>`;
}
const card = (item,locale,path) => `<a class="card" href="${localizedPath(path,locale)}"><span class="eyebrow">${escapeHtml(item.kind?.[locale]??'')}</span><h3>${escapeHtml(item.title[locale])}</h3><p>${escapeHtml(item.summary[locale])}</p></a>`;
export function wikiPage(article, all, options) {
  const {locale,origin}=options,c=labels[locale],path=`/knowledge/${article.slug}`;
  const url=new URL(localizedPath(path,locale),origin).href;
  const related=article.related.map(id=>all.find(item=>item.slug===id)).filter(Boolean);
  const body=`<nav aria-label="${c.directory}"><a href="${localizedPath('/knowledge',locale)}">${c.wiki}</a></nav><article><p class="eyebrow">${escapeHtml(article.kind[locale])}</p><h1>${escapeHtml(article.title[locale])}</h1><p class="lead">${escapeHtml(article.summary[locale])}</p><p class="meta">${c.source}: ${c.brand} · ${c.updated} <time datetime="${article.updatedAt}">${article.updatedAt}</time></p><div class="prose">${markdown(article.body[locale],locale)}${(article.sources??[]).length?`<section><h2>${locale==='zh'?'参考来源':'References'}</h2><ul>${article.sources.map(source=>`<li><a href="${escapeHtml(target(source.url,locale)??'#')}">${escapeHtml(typeof source.title === 'string' ? source.title : source.title[locale])}</a><p class="meta">${escapeHtml(source.authors)} · ${source.year} · ${escapeHtml(source.kind[locale])}</p>${source.open_access_url?` · <a href="${escapeHtml(target(source.open_access_url,locale)??'#')}">${locale==='zh'?'开放全文':'Open-access text'}</a>`:''}${source.findings?.[locale]?.length?`<p>${escapeHtml(source.findings[locale].join(' '))}</p>`:''}${source.limits?.[locale]?.length?`<p>${escapeHtml(source.limits[locale].join(' '))}</p>`:''}</li>`).join('')}</ul></section>`:''}</div></article>${related.length?`<section class="related"><h2>${c.related}</h2><div class="cards">${related.map(item=>card(item,locale,`/knowledge/${item.slug}`)).join('')}</div></section>`:''}`;
  const citations=[...article.body[locale].matchAll(/\]\((https?:\/\/(?:[^()]|\([^()]*\))*)\)/g)].map(match=>match[1]).concat((article.sources??[]).flatMap(source=>[source.url,source.open_access_url].filter(Boolean)));
  return documentHtml({...options,path,title:`${article.title[locale]}｜${c.brand} ${c.wiki}`,description:article.summary[locale],indexable:article.indexable,body,structured:{'@context':'https://schema.org','@type':'Article',headline:article.title[locale],description:article.summary[locale],inLanguage:locale==='zh'?'zh-CN':'en',url,mainEntityOfPage:url,dateModified:article.updatedAt,author:{'@type':'Organization',name:c.brand},citation:[...new Set(citations)]}});
}
export function theaterPage(episode,all,options) {
  const {locale,origin}=options,c=labels[locale],path=`/theater/${episode.id}`,url=new URL(localizedPath(path,locale),origin).href;
  const index=all.findIndex(item=>item.id===episode.id), following=all[index+1];
  const body=`<nav><a href="${localizedPath('/theater/archive',locale)}">${c.theater}</a></nav><article><p class="eyebrow">${c.theater} · ${escapeHtml(episode.id)}</p><h1>${escapeHtml(episode.title[locale])}</h1><p class="lead">${escapeHtml(episode.summary[locale])}</p><p class="meta">${c.updated} <time datetime="${episode.updatedAt}">${episode.updatedAt}</time> · ${c.fiction}</p><a class="action" href="${localizedPath('/theater',locale)}?episode=${encodeURIComponent(episode.id)}">${c.read}</a><h2>${c.transcript}</h2>${episode.panels.map((panel,i)=>`<figure class="comic-page" id="page-${i+1}"><img src="${escapeHtml(panel.src[locale])}" width="${panel.width}" height="${panel.height}" alt="${escapeHtml(panel.alt[locale])}" loading="${i?'lazy':'eager'}"><figcaption><h3>${i+1}. ${escapeHtml(panel.title[locale])}</h3><p>${escapeHtml(panel.alt[locale])}</p><div class="dialogue">${panel.lines[locale].map(line=>`<p>${escapeHtml(line)}</p>`).join('')}</div></figcaption></figure>`).join('')}</article><section class="related"><a href="${localizedPath('/theater/archive',locale)}">${c.theater}</a>${following?` · <a href="${localizedPath(`/theater/${following.id}`,locale)}">${escapeHtml(following.title[locale])}</a>`:''}</section>`;
  return documentHtml({...options,path,title:`${episode.title[locale]}｜${c.brand} ${c.theater} ${episode.id}`,description:episode.summary[locale],image:episode.panels[episode.coverPanel].src[locale],indexable:episode.indexable,body,structured:{'@context':'https://schema.org','@type':'CreativeWork',name:episode.title[locale],description:episode.summary[locale],inLanguage:locale==='zh'?'zh-CN':'en',url,dateModified:episode.updatedAt,genre:locale==='zh'?'虚构漫画':'Fictional comic',creator:{'@type':'Organization',name:c.brand},image:episode.panels.map(panel=>new URL(panel.src[locale],origin).href)}});
}
export function collectionPage(index,options,{exploreEntries}={}) {
  const {locale}=options,c=labels[locale],theater=options.path==='/theater/archive',explore=options.path==='/explore';
  const title=explore?c.directory:theater?c.theater:c.wiki;
  let body=`<p class="eyebrow">${c.brand}</p><h1>${title}</h1>`;
  if(!theater) body+=`<nav class="pill-links">${index.wiki.categories.map(category=>`<a href="#${category.id}">${escapeHtml(category.label[locale])}</a>`).join('')}</nav>${index.wiki.categories.map(category=>`<section id="${category.id}"><h2>${escapeHtml(category.label[locale])}</h2><div class="cards">${index.wiki.articles.filter(item=>item.category===category.id).map(item=>card(item,locale,`/knowledge/${item.slug}`)).join('')}</div></section>`).join('')}`;
  if(theater||explore) body+=`<section><h2>${c.theater}</h2><div class="cards">${index.theater.episodes.map(item=>`<a class="card" href="${localizedPath(`/theater/${item.id}`,locale)}"><img class="thumb" src="${escapeHtml(item.cover[locale])}" alt="" loading="lazy"><span class="eyebrow">${escapeHtml(item.id)}</span><h3>${escapeHtml(item.title[locale])}</h3><p>${escapeHtml(item.summary[locale])}</p></a>`).join('')}</div></section>`;
  if(explore&&exploreEntries) for(const [kind,heading] of [['character',locale==='zh'?'16个人物':'16 characters'],['relationship',locale==='zh'?'人物关系':'Character relationships']]) body+=`<section><h2>${heading}</h2><div class="cards">${exploreEntries.filter(item=>item.locale===locale&&item.kind===kind).map(item=>`<a class="card" href="${escapeHtml(item.path)}"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></a>`).join('')}</div></section>`;
  return documentHtml({...options,title:`${title}｜${c.brand}`,description:locale==='zh'?'阅读16暗影知识、人物故事与创作依据。':'Explore 16 Shades articles, character stories and their sources.',body,indexable:true,structured:{'@context':'https://schema.org','@type':'CollectionPage',name:title,url:new URL(localizedPath(options.path,locale),options.origin).href}});
}
