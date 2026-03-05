#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const z = require('zod');

const DATA_DIR = __dirname;
const SUBS = path.join(DATA_DIR, 'subscriptions.json');
const CACHE = path.join(DATA_DIR, 'cache.json');
const INDEX = path.join(DATA_DIR, 'paper_index.json');
const STATE = path.join(DATA_DIR, 'daily_state.json');
const REPORTS = path.join(DATA_DIR, 'reports');
const parser = new Parser({ timeout: 30000, headers: { 'User-Agent': 'or-research-hub-mcp/2.0' } });
const parserRetry = new Parser({ timeout: 45000, headers: { 'User-Agent': 'or-research-hub-mcp/2.0' } });

const LIMIT_PER_FEED = 15;
const MAX_PER_FEED = 40;
const MAX_RESULTS = 120;

const now = () => Date.now();
const dt = (x) => { const t = Date.parse(x || ''); return Number.isFinite(t) ? t : null; };
const dstr = (t) => { const d = new Date(t); return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`; };
const txt = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const read = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const write = (p, x) => fs.writeFileSync(p, JSON.stringify(x, null, 2), 'utf8');
const ok = (x) => ({ content: [{ type: 'text', text: JSON.stringify(x, null, 2) }] });
const err = (m) => ({ content: [{ type: 'text', text: m }], isError: true });
const fp = (p) => (p.doi || p.link || p.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'feed';
const hasCJK = (s) => /[\u3400-\u9fff]/.test(String(s || ''));
const escRe = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsTerm = (haystack, term) => {
  const h = String(haystack || '').toLowerCase();
  const t = String(term || '').toLowerCase().trim();
  if (!t) return false;
  if (hasCJK(t)) return h.includes(t);
  return new RegExp(`(^|[^a-z0-9])${escRe(t)}([^a-z0-9]|$)`, 'i').test(h);
};

function ensure() {
  if (!fs.existsSync(SUBS)) throw new Error(`Missing ${SUBS}`);
  if (!fs.existsSync(CACHE)) write(CACHE, { feeds: {} });
  if (!fs.existsSync(INDEX)) write(INDEX, { papers: {} });
  if (!fs.existsSync(STATE)) write(STATE, { lastPushDate: null, seenFingerprints: [] });
  if (!fs.existsSync(REPORTS)) fs.mkdirSync(REPORTS, { recursive: true });
}
const subs = () => (read(SUBS, { subscriptions: [] }).subscriptions || []).filter((x) => x && x.id && x.url);
const saveSubs = (x) => write(SUBS, { subscriptions: x });
const cache = () => read(CACHE, { feeds: {} });
const saveCache = (x) => write(CACHE, x);
const index = () => read(INDEX, { papers: {} });
const saveIndex = (x) => write(INDEX, x);
const state = () => { const s = read(STATE, { lastPushDate: null, seenFingerprints: [] }); return { lastPushDate: s.lastPushDate || null, seenFingerprints: Array.isArray(s.seenFingerprints) ? s.seenFingerprints : [] }; };
const saveState = (s) => write(STATE, { lastPushDate: s.lastPushDate || null, seenFingerprints: [...new Set((s.seenFingerprints || []).filter(Boolean))].slice(-12000) });

function doi(it) { const m = `${it?.doi || ''} ${it?.id || ''} ${it?.guid || ''} ${it?.link || ''} ${it?.content || ''}`.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i); return m ? m[0] : ''; }
function guessYearFromText(s) {
  const m = String(s || '').match(/\b(20\d{2})\b/g);
  if (!m || !m.length) return null;
  const ys = m.map((x) => Number(x)).filter((y) => y >= 2000 && y <= 2100);
  if (!ys.length) return null;
  return ys[ys.length - 1];
}
function authors(it) {
  const out = [];
  if (Array.isArray(it.authors)) for (const a of it.authors) out.push(txt(typeof a === 'string' ? a : a?.name || `${a?.firstName || ''} ${a?.lastName || ''}`));
  if (it.creator) out.push(...String(it.creator).split(/[,;|]/).map(txt));
  if (it.author) out.push(...String(it.author).split(/[,;|]/).map(txt));
  return [...new Set(out.filter(Boolean))].slice(0, 12);
}

async function fetchFeed(sub, limit) {
  const normalizeFeed = (f) => ({
    ok: true,
    feedTitle: txt(f.title || sub.name),
    items: (f.items || []).slice(0, limit).map((it) => {
      const publishedAt = dt(it.isoDate || it.pubDate || it.date);
      const iso = publishedAt ? new Date(publishedAt).toISOString() : null;
      const summary = txt(it.contentSnippet || it.content || it.summary || it.description || '');
      const link = it.link || '';
      const yearGuess = guessYearFromText(`${summary} ${it.title || ''} ${link}`);
      return {
        title: txt(it.title || ''),
        link,
        publishedAt: iso,
        summary,
        authors: authors(it),
        doi: doi(it),
        year: iso ? Number(new Date(iso).getFullYear()) : yearGuess
      };
    })
  });
  try {
    const f = await parser.parseURL(sub.url);
    return normalizeFeed(f);
  } catch (e) {
    const msg = String(e?.message || e);
    if (!/timed out/i.test(msg)) return { ok: false, error: msg };
    try {
      const fRetry = await parserRetry.parseURL(sub.url);
      return normalizeFeed(fRetry);
    } catch (e2) {
      return { ok: false, error: String(e2?.message || e2) };
    }
  }
}

async function refresh(o = {}) {
  const maxFeeds = Math.max(Number(o.maxFeeds || 10), 1);
  const per = Math.min(Math.max(Number(o.limitPerFeed || LIMIT_PER_FEED), 1), MAX_PER_FEED);
  const conc = Math.max(Number(o.concurrency || 4), 1);
  const ttl = Math.max(Number(o.ttlMinutes || 360), 1) * 60 * 1000;
  const active = subs().filter((x) => x.enabled !== false).slice(0, maxFeeds);
  const c = cache(); const ts = now(); const res = [];
  for (let i = 0; i < active.length; i += conc) {
    const r = await Promise.all(active.slice(i, i + conc).map(async (s) => {
      const old = c.feeds[s.url];
      if (!o.force && old && ts - Number(old.fetchedAt || 0) <= ttl) return { subscriptionId: s.id, url: s.url, status: 'cached', items: (old.items || []).length };
      const x = await fetchFeed(s, per);
      if (!x.ok) return { subscriptionId: s.id, url: s.url, status: 'error', error: x.error };
      c.feeds[s.url] = { subscriptionId: s.id, sourceName: s.name, sourceGroup: s.group || '', feedTitle: x.feedTitle, fetchedAt: ts, items: x.items };
      return { subscriptionId: s.id, url: s.url, status: 'ok', items: x.items.length };
    }));
    res.push(...r);
  }
  saveCache(c);
  return { total: active.length, success: res.filter((x) => x.status === 'ok' || x.status === 'cached').length, failed: res.filter((x) => x.status === 'error').length, updatedCount: res.filter((x) => x.status === 'ok').length, results: res };
}

async function mapConcurrent(items, concurrency, mapper) {
  const out = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(Math.max(concurrency, 1), Math.max(items.length, 1)) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      out[i] = await mapper(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

function rows(sinceDays = 3650) {
  const cut = now() - Math.max(Number(sinceDays || 3650), 1) * 24 * 3600 * 1000;
  const by = new Map(subs().map((s) => [s.url, s])); const out = [];
  for (const [url, e] of Object.entries(cache().feeds || {})) {
    const s = by.get(url); if (!s || s.enabled === false) continue;
    for (const it of (e.items || [])) {
      const t = dt(it.publishedAt || ''); if (t && t < cut) continue;
      out.push({ subscriptionId: s.id, sourceName: s.name, sourceGroup: s.group || '', feedTitle: e.feedTitle || s.name, feedUrl: s.url, title: it.title || '', link: it.link || '', publishedAt: it.publishedAt || null, fetchedAt: e.fetchedAt || null, summary: it.summary || '', authors: Array.isArray(it.authors) ? it.authors : [], doi: it.doi || '', year: it.year || null });
    }
  }
  const seen = new Set(); return out.filter((p) => { const k = fp(p); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}

function filter(xs, q = {}) {
  const qterms = String(q.query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const kws = Array.isArray(q.keywords) ? q.keywords.map((x) => String(x).toLowerCase()).filter(Boolean) : [];
  const auth = Array.isArray(q.authors) ? q.authors.map((x) => String(x).toLowerCase()) : [];
  const jour = Array.isArray(q.journals) ? q.journals.map((x) => String(x).toLowerCase()) : [];
  const yf = Number.isFinite(q.yearFrom) ? Number(q.yearFrom) : null; const yt = Number.isFinite(q.yearTo) ? Number(q.yearTo) : null;
  const onlyToday = !!q.onlyToday; const today = dstr(now());
  return xs.filter((p) => {
    const m = `${p.title} ${p.summary} ${(p.authors || []).join(' ')} ${p.sourceName} ${p.feedTitle}`.toLowerCase();
    if (qterms.length && !qterms.every((t) => containsTerm(m, t))) return false;
    if (kws.length && !kws.some((k) => containsTerm(m, k))) return false;
    if (auth.length && !auth.some((a) => containsTerm((p.authors || []).join(' ').toLowerCase(), a))) return false;
    if (jour.length && !jour.some((j) => containsTerm(`${p.sourceName} ${p.feedTitle}`.toLowerCase(), j))) return false;
    if (yf && (!p.year || p.year < yf)) return false;
    if (yt && (!p.year || p.year > yt)) return false;
    if (onlyToday) { const d = p.publishedAt ? dstr(Date.parse(p.publishedAt)) : (p.fetchedAt ? dstr(p.fetchedAt) : null); if (d !== today) return false; }
    return true;
  });
}

function score(p, query, keywords) {
  const terms = [].concat(String(query || '').toLowerCase().split(/\s+/).filter(Boolean)).concat((keywords || []).map((x) => String(x).toLowerCase()));
  const t = String(p.title || '').toLowerCase(), s = String(p.summary || '').toLowerCase();
  let z = 0; for (const x of terms) { if (containsTerm(t, x)) z += 5; if (containsTerm(s, x)) z += 2; }
  const ts = dt(p.publishedAt || ''); if (ts) z += Math.max(0, 2 - (now() - ts) / (25 * 24 * 3600 * 1000)); return z;
}

async function fetchTxt(url, timeout = 12000) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (or-research-hub-mcp)' } });
    return r.ok ? await r.text() : '';
  } catch {
    return '';
  } finally {
    clearTimeout(tm);
  }
}

async function fetchJson(url, timeout = 12000) {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (or-research-hub-mcp)', Accept: 'application/json' } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(tm);
  }
}

const html2txt = (h) => String(h || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const firstSentence = (text, pats) => { for (const s of String(text || '').split(/(?<=[。！？.!?])\s+/).map(txt).filter((x) => x.length > 20).slice(0, 300)) for (const p of pats) if (p.test(s)) return s; return ''; };
const splitSentences = (text) => String(text || '').split(/(?<=[。！？.!?])\s+/).map(txt).filter((x) => x.length >= 25).slice(0, 500);
const pickFirst = (sentences, regs, fallback = '') => { for (const s of sentences) { for (const r of regs) if (r.test(s)) return s; } return fallback; };
const pickMany = (sentences, regs, maxN = 2) => {
  const out = [];
  for (const s of sentences) {
    if (out.length >= maxN) break;
    if (regs.some((r) => r.test(s)) && !out.includes(s)) out.push(s);
  }
  return out;
};
const extractMetaDescription = (html) => {
  const h = String(html || '');
  const m = h.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]+content=["']([^"']+)["']/i);
  return m ? txt(m[1]) : '';
};
const extractPdfLink = (html, baseUrl) => {
  const m = String(html || '').match(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/i);
  if (!m) return '';
  try { return new URL(m[1], baseUrl).toString(); } catch { return ''; }
};
const openAlexAbstract = (inv) => {
  if (!inv || typeof inv !== 'object') return '';
  const words = [];
  for (const [token, pos] of Object.entries(inv)) {
    for (const p of (Array.isArray(pos) ? pos : [])) words.push({ token, p: Number(p) });
  }
  words.sort((a, b) => a.p - b.p);
  return txt(words.map((x) => x.token).join(' '));
};
const duck = (h) => { const m = String(h || '').match(/class=\"result__a\"[^>]+href=\"([^\"]+)\"/i); if (!m) return ''; let u = m[1]; const mm = u.match(/[?&]uddg=([^&]+)/); if (mm) { try { u = decodeURIComponent(mm[1]); } catch {} } if (u.startsWith('//')) u = `https:${u}`; return u; };

async function enrich(p, fulltext = true) {
  const pieces = [];
  let usedWebSearch = false;
  const totalLen = () => pieces.reduce((s, x) => s + (x.text ? x.text.length : 0), 0);
  const pushPiece = (source, text, link = '') => {
    const clean = txt(text || '');
    if (!clean || clean.length < 40) return;
    pieces.push({ source, text: clean, link });
  };

  pushPiece('rss_summary', p.summary || '', p.link || '');

  if (!fulltext) {
    const merged = pieces.map((x) => x.text).join(' ').slice(0, 30000);
    return {
      evidenceText: merged,
      evidenceSource: pieces.map((x) => x.source).join(',') || 'rss_summary',
      evidenceSources: pieces.map((x) => x.source),
      evidenceLink: p.link || '',
      usedWebSearch
    };
  }

  if (p.link) {
    const raw = await fetchTxt(p.link);
    if (raw) {
      pushPiece('article_meta', extractMetaDescription(raw), p.link);
      pushPiece('article_page', html2txt(raw).slice(0, 26000), p.link);
      const pdf = extractPdfLink(raw, p.link);
      if (pdf) {
        const pdfPreview = await fetchTxt(pdf, 9000);
        pushPiece('article_pdf_preview', html2txt(pdfPreview).slice(0, 6000), pdf);
      }
    }
  }

  if (p.doi && totalLen() < 8000) {
    const doiKey = encodeURIComponent(String(p.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim());
    const cr = await fetchJson(`https://api.crossref.org/works/${doiKey}`, 10000);
    const msg = cr?.message || null;
    if (msg) {
      const crossrefText = [
        txt(Array.isArray(msg.title) ? msg.title[0] : msg.title || ''),
        txt(msg.abstract || ''),
        txt(Array.isArray(msg['container-title']) ? msg['container-title'][0] : msg['container-title'] || ''),
        txt((msg.subject || []).join('; '))
      ].join(' ');
      pushPiece('crossref', crossrefText, msg.URL || '');
    }
    const oa = await fetchJson(`https://api.openalex.org/works/https://doi.org/${doiKey}`, 10000);
    if (oa && !oa.error) {
      const oaText = [
        txt(oa.title || ''),
        openAlexAbstract(oa.abstract_inverted_index),
        txt((oa.concepts || []).map((x) => x.display_name).join('; ')),
        txt((oa.topics || []).map((x) => x.display_name).join('; '))
      ].join(' ');
      pushPiece('openalex', oaText, oa.primary_location?.landing_page_url || oa.id || '');
    }
  }

  if (p.title && totalLen() < 1800) {
    const q = `${p.title} ${p.sourceName} full text pdf`;
    const duckHtml = await fetchTxt(`https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`, 9000);
    const url = duck(duckHtml);
    if (url) {
      const page = await fetchTxt(url, 10000);
      pushPiece('web_search', html2txt(page).slice(0, 18000), url);
      usedWebSearch = true;
    }
  }

  const merged = [];
  const seen = new Set();
  for (const item of pieces) {
    const key = item.text.slice(0, 220).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  const evidenceText = merged.map((x) => x.text).join(' ').slice(0, 42000);
  const evidenceSources = merged.map((x) => x.source);
  const evidenceLink = (merged.find((x) => x.link)?.link) || p.link || '';
  return { evidenceText, evidenceSource: evidenceSources.join(','), evidenceSources, evidenceLink, usedWebSearch };
}

function sar(p, ev) {
  const t = txt(ev.evidenceText || `${p.title}. ${p.summary}`);
  const sents = splitSentences(t);
  const models = [['MIP/MILP', /mixed[\s-]?integer|milp|mip|binary/i], ['Stochastic Programming', /stochastic|chance[\s-]?constraint|scenario/i], ['Robust Optimization', /robust optimization|distributionally robust|dro\b/i], ['Empirical/Regression Model', /regression|panel data|difference-in-differences|did\b|causal/i]].filter((x) => x[1].test(t.toLowerCase())).map((x) => x[0]);
  const methods = [['Heuristics/Metaheuristics', /heuristic|metaheuristic|genetic algorithm|tabu|simulated annealing|vns|alns/i], ['Column Generation', /column generation|branch-and-price/i], ['Benders Decomposition', /benders/i], ['Reinforcement Learning', /reinforcement learning|policy gradient|actor-critic|drl/i], ['Exact Solver-Based Optimization', /cplex|gurobi|exact algorithm|branch-and-bound/i]].filter((x) => x[1].test(t.toLowerCase())).map((x) => x[0]);

  const components = [];
  if (/network|graph|state|demand|arrival|time window|constraint/i.test(t)) components.push({ name: '问题建模与状态表达', role: '把业务流程映射为可计算的优化问题并定义约束边界', feature: '强调时间窗、资源约束或图结构表示' });
  if (/decomposition|column generation|benders|lagrangian|branch/i.test(t)) components.push({ name: '求解分解模块', role: '降低大规模模型复杂度并提升可求解性', feature: '通过分解或列生成改善收敛效率' });
  if (/heuristic|metaheuristic|search|tabu|genetic|annealing|vns|alns|monte carlo/i.test(t)) components.push({ name: '启发式搜索模块', role: '在可接受时间内搜索高质量可行解', feature: '结合问题结构设计邻域或搜索策略' });
  if (/reinforcement learning|drl|policy|neural|transformer/i.test(t)) components.push({ name: '学习驱动决策模块', role: '从数据中学习调度或控制策略', feature: '可适应动态环境与不确定性' });
  if (/simulation|simulator|digital twin|case study/i.test(t)) components.push({ name: '仿真与验证模块', role: '验证方法在真实业务或近真实环境中的效果', feature: '支持多场景敏感性分析' });

  const researchProblem = pickFirst(sents, [/we (study|address|consider|investigate)|this paper (studies|addresses|considers)|problem of|objective is to|aims? to/i], `论文聚焦“${p.title}”对应的优化与决策问题。`);
  const researchMotivation = pickMany(sents, [/motivation|challenge|critical|important|complex|uncertain|cost|delay|congestion|safety|emission|efficiency|bottleneck/i], 2).join(' ') || '该问题通常具有高复杂度与显著业务价值，值得进行方法改进。';
  const methodFramework = pickFirst(sents, [/we propose|we develop|framework|approach|algorithm|model/i], '作者提出了一个面向该问题的优化/学习混合求解框架。');

  const designObj = pickMany(sents, [/dataset|instance|benchmark|real-world|case study|synthetic|simulation|公开数据|算例/i], 2).join(' ') || '实验对象包含公开或构造算例，具体下载入口需结合论文正文与附录确认。';
  const designMetric = pickMany(sents, [/cost|gap|throughput|delay|makespan|tardiness|utilization|robustness|service level|objective value|最优性间隙|吞吐|延误/i], 2).join(' ') || '评测指标以目标函数值、效率和鲁棒性为主，与 OR 文献常用指标一致。';
  const designSetup = pickMany(sents, [/baseline|ablation|sensitivity|parameter|hyperparameter|cross-validation|train|test|split|scenario/i], 2).join(' ') || '实验设置包含基线对比与参数敏感性分析，参数优化方式需结合全文细节。';
  const designEnv = pickMany(sents, [/cpu|gpu|memory|python|matlab|cplex|gurobi|hardware|server/i], 2).join(' ') || '计算环境信息在当前证据中不完整，需查阅全文实验章节。';

  const resultPos = pickMany(sents, [/outperform|improve|reduce|better than|significant|effective|superior|state-of-the-art|提升|降低/i], 2).join(' ') || '结果显示方法在至少部分关键指标上有改进。';
  const resultNeg = pickMany(sents, [/however|limitation|fails|worse|trade-off|sensitive|expensive|time-consuming|仅在|受限于/i], 2).join(' ') || '负面结果与边界条件描述不足，建议在复现实验时补充失败案例分析。';
  const resultConclusion = pickFirst(sents, [/in conclusion|overall|therefore|we conclude|results indicate/i], '综合来看，该方法在目标场景中具有应用潜力，但泛化性仍需更多验证。');

  const insightInnovation = pickFirst(sents, [/novel|first|contribution|new|outperform|improvement/i], '创新点主要体现在建模与求解流程的组合改进。');
  const insightIssue = pickFirst(sents, [/limitation|assume|restricted|only considers|future work|缺乏/i], '潜在问题是对数据质量、场景假设或参数设置较为敏感。');
  const insightFuture = pickFirst(sents, [/future work|further research|extension|next step|open question/i], '后续可扩展到更大规模、强不确定性或在线决策场景。');

  return {
    header: `${p.title} | ${p.sourceName} | ${(p.authors || []).join(', ') || 'N/A'} | ${p.year || 'N/A'} | ${p.doi || p.link || 'N/A'}`,
    title: p.title,
    journal: p.sourceName,
    authors: p.authors || [],
    year: p.year || null,
    doiOrLink: p.doi || p.link || '',
    researchScene: firstSentence(t, [/supply chain|logistics|manufacturing|transport|inventory|production|port|terminal|quay|yard|warehouse|healthcare|energy/i]) || `${p.sourceName} 对应的运筹优化问题场景。`,
    researchQuestion: researchProblem,
    mathematicalModel: models.length ? models.join('; ') : '当前证据未明确给出模型类型。',
    researchMethod: methods.length ? methods.join('; ') : '当前证据未明确给出核心求解方法。',
    innovationIncrement: firstSentence(t, [/we propose|novel|for the first time|contribution|outperform|improve/i]) || '创新增量需结合全文与 benchmark 做进一步核对。',
    limitations: firstSentence(t, [/limitation|future work|however|assume|restricted|only considers|does not/i]) || '当前证据未明确列出局限性。',
    structured: {
      researchProblem,
      researchMotivation,
      method: {
        framework: methodFramework,
        components: components.length ? components : [{ name: '方法组件', role: '当前证据不足以拆解完整模块', feature: '建议补抓全文后完善' }]
      },
      experimentDesign: {
        researchQuestionAndMotivation: `${researchProblem} ${researchMotivation}`,
        experimentalObjects: designObj,
        evaluationMetrics: designMetric,
        setupAndParameters: designSetup,
        environment: designEnv
      },
      experimentResults: {
        positiveFindings: resultPos,
        negativeFindings: resultNeg,
        conclusion: resultConclusion
      },
      insights: {
        innovationOrDifference: insightInnovation,
        existingIssuesAndFixIdeas: insightIssue,
        futureWork: insightFuture
      }
    },
    evidenceSource: ev.evidenceSource,
    evidenceSources: ev.evidenceSources || [],
    evidenceLink: ev.evidenceLink,
    usedWebSearch: !!ev.usedWebSearch
  };
}

function idxUpsert(p, s, tags = []) {
  const k = fp(p);
  if (!k) return;
  const i = index();
  const old = i.papers[k] || {};
  i.papers[k] = {
    fingerprint: k,
    title: p.title,
    link: p.link || '',
    doi: p.doi || '',
    journal: p.sourceName || '',
    group: p.sourceGroup || '',
    authors: p.authors || [],
    year: p.year || null,
    lastSeenAt: new Date().toISOString(),
    lastBriefAt: new Date().toISOString(),
    tags: [...new Set([...(old.tags || []), ...tags])],
    sarSummary: {
      problem: s.structured?.researchProblem || s.researchQuestion,
      model: s.mathematicalModel,
      method: s.structured?.method?.framework || s.researchMethod,
      conclusion: s.structured?.experimentResults?.conclusion || ''
    }
  };
  saveIndex(i);
}

function mdBrief(s) {
  const st = s.structured || {};
  const comps = ((st.method && Array.isArray(st.method.components)) ? st.method.components : [])
    .map((c, idx) => `${idx + 1}. ${c.name}（作用：${c.role}；特色：${c.feature}）`)
    .join('； ');

  return [
    `### ${s.title} | ${s.journal} | ${(s.authors || []).join(', ') || 'N/A'} | ${s.year || 'N/A'} | ${s.doiOrLink || 'N/A'}`,
    '',
    `（1）研究问题：${st.researchProblem || s.researchQuestion || '未从当前证据中抽取到明确表述。'}`,
    `（2）研究动机：${st.researchMotivation || '未从当前证据中抽取到明确动机。'}`,
    '（3）作者提出的方法：',
    `方法框架总体介绍：${st.method?.framework || s.researchMethod || '未从当前证据中抽取到完整方法框架。'}`,
    `方法组件：${comps || '未抽取到可拆分组件。'}`,
    '（4）实验设计：',
    `研究问题与动机：${st.experimentDesign?.researchQuestionAndMotivation || '未明确给出。'}`,
    `实验对象：${st.experimentDesign?.experimentalObjects || '未明确给出数据集/算例来源。'}`,
    `评测指标：${st.experimentDesign?.evaluationMetrics || '未明确给出指标定义。'}`,
    `实验设置：${st.experimentDesign?.setupAndParameters || '未明确给出完整实验步骤与参数优化策略。'}`,
    `实验环境：${st.experimentDesign?.environment || '未明确给出软硬件环境。'}`,
    '（5）实验结果：',
    `积极结果：${st.experimentResults?.positiveFindings || '未明确给出。'}`,
    `负面结果：${st.experimentResults?.negativeFindings || '未明确给出。'}`,
    `结论：${st.experimentResults?.conclusion || '未明确给出。'}`,
    '（6）受到的启发：',
    `创新点或差异：${st.insights?.innovationOrDifference || s.innovationIncrement || '未明确给出。'}`,
    `可能问题与改进方向：${st.insights?.existingIssuesAndFixIdeas || s.limitations || '未明确给出。'}`,
    `未来工作：${st.insights?.futureWork || '未明确给出。'}`,
    `证据来源：${s.evidenceSource || 'N/A'}`,
    `证据链接：${s.evidenceLink || 'N/A'}`
  ].join('\n');
}

function saveMd(markdown, fileName, outputDir) {
  const dir = outputDir ? path.resolve(outputDir) : REPORTS;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, fileName);
  fs.writeFileSync(f, markdown, 'utf8');
  return f;
}

const server = new McpServer({ name: 'or-research-hub', version: '2.0.0' });

server.registerTool('list_subscriptions', { description: 'List all subscribed OR journal RSS feeds.' }, async () => { try { const s = subs(); return ok({ total: s.length, subscriptions: s }); } catch (e) { return err(`list_subscriptions failed: ${String(e?.message || e)}`); } });
server.registerTool('subscribe_journal', { description: 'Subscribe a new journal RSS feed.', inputSchema: { name: z.string(), url: z.string().url(), group: z.string().optional() } }, async ({ name, url, group }) => { try { const s = subs(); const ex = s.find((x) => x.url === url); if (ex) return ok({ added: false, reason: 'already_exists', subscription: ex }); const base = slug(name); let id = base; let i = 2; while (s.some((x) => x.id === id)) { id = `${base}-${i}`; i += 1; } const sub = { id, name, url, group: group || 'Custom', enabled: true }; s.push(sub); saveSubs(s); return ok({ added: true, subscription: sub, total: s.length }); } catch (e) { return err(`subscribe_journal failed: ${String(e?.message || e)}`); } });
server.registerTool('unsubscribe_journal', { description: 'Unsubscribe journal by id or url.', inputSchema: { identifier: z.string() } }, async ({ identifier }) => { try { const s = subs(); const i = s.findIndex((x) => x.id === identifier || x.url === identifier); if (i < 0) return ok({ removed: false, reason: 'not_found', identifier }); const [rm] = s.splice(i, 1); saveSubs(s); const c = cache(); delete c.feeds[rm.url]; saveCache(c); return ok({ removed: true, subscription: rm, total: s.length }); } catch (e) { return err(`unsubscribe_journal failed: ${String(e?.message || e)}`); } });
server.registerTool('refresh_subscriptions', { description: 'Fetch latest items from subscribed journal feeds and update local cache.', inputSchema: { force: z.boolean().optional(), maxFeeds: z.number().int().min(1).max(200).optional(), limitPerFeed: z.number().int().min(1).max(MAX_PER_FEED).optional(), concurrency: z.number().int().min(1).max(10).optional(), ttlMinutes: z.number().int().min(1).max(10080).optional() } }, async (a) => { try { return ok(await refresh(a || {})); } catch (e) { return err(`refresh_subscriptions failed: ${String(e?.message || e)}`); } });
server.registerTool('query_subscribed_papers', { description: 'Quick query over subscribed feed cache.', inputSchema: { query: z.string(), limit: z.number().int().min(1).max(MAX_RESULTS).optional(), sinceDays: z.number().int().min(1).max(36500).optional(), refresh: z.boolean().optional(), maxFeeds: z.number().int().min(1).max(200).optional(), limitPerFeed: z.number().int().min(1).max(MAX_PER_FEED).optional(), concurrency: z.number().int().min(1).max(10).optional() } }, async ({ query, limit, sinceDays, refresh: rf, maxFeeds, limitPerFeed, concurrency }) => { try { if (rf) await refresh({ maxFeeds, limitPerFeed, concurrency, force: false }); let all = rows(sinceDays || 3650); if (!all.length) { await refresh({ maxFeeds: maxFeeds || 10, limitPerFeed: limitPerFeed || LIMIT_PER_FEED, concurrency: concurrency || 4, force: false }); all = rows(sinceDays || 3650); } const r = filter(all, { query }).map((p) => ({ ...p, score: score(p, query, []) })).sort((a, b) => b.score - a.score); const take = Math.max(Number(limit || 20), 1); return ok({ query, total: r.length, returned: Math.min(take, r.length), results: r.slice(0, take) }); } catch (e) { return err(`query_subscribed_papers failed: ${String(e?.message || e)}`); } });

server.registerTool('intelligence_search', { description: 'Intelligence layer for trigger text like "检索关键词: [xxx]". Supports year/author/journal filtering and Non-Abstract SAR.', inputSchema: { query: z.string().optional(), keywords: z.array(z.string()).optional(), authors: z.array(z.string()).optional(), journals: z.array(z.string()).optional(), yearFrom: z.number().int().optional(), yearTo: z.number().int().optional(), onlyToday: z.boolean().optional(), refresh: z.boolean().optional(), includeFulltext: z.boolean().optional(), includeSAR: z.boolean().optional(), limit: z.number().int().min(1).max(MAX_RESULTS).optional(), maxFeeds: z.number().int().min(1).max(200).optional(), limitPerFeed: z.number().int().min(1).max(MAX_PER_FEED).optional(), concurrency: z.number().int().min(1).max(10).optional() } }, async (a) => {
  try {
    const query = a.query || '', keywords = Array.isArray(a.keywords) ? a.keywords : [], includeSAR = a.includeSAR !== false, includeFulltext = a.includeFulltext !== false, limit = Math.max(Number(a.limit || 10), 1);
    if (a.refresh !== false) await refresh({ force: false, maxFeeds: a.maxFeeds || subs().length, limitPerFeed: a.limitPerFeed || LIMIT_PER_FEED, concurrency: a.concurrency || 4 });
    let all = rows(3650); if (!all.length) { await refresh({ force: false, maxFeeds: a.maxFeeds || 10, limitPerFeed: a.limitPerFeed || LIMIT_PER_FEED, concurrency: a.concurrency || 4 }); all = rows(3650); }
    const ranked = filter(all, { query, keywords, authors: a.authors, journals: a.journals, yearFrom: a.yearFrom, yearTo: a.yearTo, onlyToday: a.onlyToday }).map((p) => ({ ...p, score: score(p, query, keywords) })).sort((x, y) => y.score - x.score).slice(0, limit);
    const enrichConcurrency = Math.min(Math.max(Number(a.concurrency || 3), 1), 6);
    const out = await mapConcurrent(ranked, includeSAR ? enrichConcurrency : 10, async (p) => {
      let s = null, ev = { evidenceSource: 'rss_summary', evidenceSources: ['rss_summary'], evidenceLink: p.link || '', usedWebSearch: false };
      if (includeSAR) { ev = await enrich(p, includeFulltext); s = sar(p, ev); const tags = [...new Set([`journal:${slug(p.sourceName)}`, p.year ? `year:${p.year}` : '', ...keywords.map((k) => `kw:${slug(k)}`)].filter(Boolean))]; idxUpsert(p, s, tags); }
      return { ...p, sar: s, evidenceSource: ev.evidenceSource, evidenceSources: ev.evidenceSources || [], evidenceLink: ev.evidenceLink, usedWebSearch: ev.usedWebSearch };
    });
    return ok({ triggerHints: ['每日推送', '检索关键词: [xxx]'], total: out.length, results: out, postActionPrompt: '是否需要将此简报导出为 Markdown 文件？如需入库 Notion，可继续调用 notion MCP。' });
  } catch (e) { return err(`intelligence_search failed: ${String(e?.message || e)}`); }
});

server.registerTool('daily_push', { description: 'Daily OR push. Creates Daily_Pulse_OR_[Date].md and only pushes new papers vs prior logs.', inputSchema: { query: z.string().optional(), keywords: z.array(z.string()).optional(), limit: z.number().int().min(1).max(MAX_RESULTS).optional(), refresh: z.boolean().optional(), includeFulltext: z.boolean().optional(), outputDir: z.string().optional(), maxFeeds: z.number().int().min(1).max(200).optional(), limitPerFeed: z.number().int().min(1).max(MAX_PER_FEED).optional(), concurrency: z.number().int().min(1).max(10).optional() } }, async (a) => {
  try {
    const query = a.query || '', keywords = Array.isArray(a.keywords) ? a.keywords : [], limit = Math.max(Number(a.limit || 12), 1), includeFulltext = a.includeFulltext !== false;
    if (a.refresh !== false) await refresh({ force: false, maxFeeds: a.maxFeeds || subs().length, limitPerFeed: a.limitPerFeed || 12, concurrency: a.concurrency || 4 });
    let all = rows(7); if (!all.length) { await refresh({ force: false, maxFeeds: a.maxFeeds || 10, limitPerFeed: a.limitPerFeed || LIMIT_PER_FEED, concurrency: a.concurrency || 4 }); all = rows(7); }
    let cand = filter(all, { query, keywords, onlyToday: true }); if (!cand.length) cand = filter(all, { query, keywords });
    cand = cand.map((p) => ({ ...p, score: score(p, query, keywords) })).sort((x, y) => y.score - x.score);
    const st = state(), seen = new Set(st.seenFingerprints || []), fresh = cand.filter((p) => !seen.has(fp(p))).slice(0, limit);
    const enrichConcurrency = Math.min(Math.max(Number(a.concurrency || 3), 1), 6);
    const briefs = await mapConcurrent(fresh, enrichConcurrency, async (p) => {
      const ev = await enrich(p, includeFulltext), s = sar(p, ev);
      const tags = [...new Set([`journal:${slug(p.sourceName)}`, p.year ? `year:${p.year}` : '', ...keywords.map((k) => `kw:${slug(k)}`)].filter(Boolean))];
      idxUpsert(p, s, tags);
      seen.add(fp(p));
      return { paper: p, sar: s };
    });
    const today = dstr(now()), fileName = `Daily_Pulse_OR_${today}.md`;
    const md = ['# Daily Pulse OR - ' + today, '', `- Total candidates scanned: ${cand.length}`, `- New papers pushed: ${briefs.length}`, query || keywords.length ? `- Query scope: query="${query}", keywords=${JSON.stringify(keywords)}` : '', '', '## Non-Abstract SAR Briefs', '', briefs.length ? briefs.map((x) => mdBrief(x.sar)).join('\n\n') : '- No newly discovered papers matched today.', '', '---', '是否需要将此简报导出为 Markdown 文件？如需同步到 Notion 工作区“OR学术文献推送”，请继续调用 notion MCP。', ''].filter(Boolean).join('\n');
    const outPath = saveMd(md, fileName, a.outputDir); saveState({ lastPushDate: today, seenFingerprints: [...seen] });
    return ok({ today, scanned: cand.length, pushed: briefs.length, filePath: outPath, notionPrompt: '是否加入 Notion 工作区“OR学术文献推送”？如需执行，请调用 notion MCP 创建页面并写入该 Markdown。' });
  } catch (e) { return err(`daily_push failed: ${String(e?.message || e)}`); }
});

server.registerTool('save_brief_markdown', { description: 'Save markdown brief to local file.', inputSchema: { markdown: z.string(), fileName: z.string().optional(), outputDir: z.string().optional() } }, async ({ markdown, fileName, outputDir }) => { try { const fn = fileName && fileName.trim() ? fileName.trim() : `OR_Brief_${dstr(now())}.md`; return ok({ saved: true, filePath: saveMd(markdown, fn.endsWith('.md') ? fn : `${fn}.md`, outputDir) }); } catch (e) { return err(`save_brief_markdown failed: ${String(e?.message || e)}`); } });
server.registerTool('list_paper_index', { description: 'List indexed papers with optional tag filter.', inputSchema: { tag: z.string().optional(), limit: z.number().int().min(1).max(500).optional() } }, async ({ tag, limit }) => { try { let rows = Object.values(index().papers || {}); if (tag) { const t = String(tag).toLowerCase(); rows = rows.filter((r) => Array.isArray(r.tags) && r.tags.some((x) => String(x).toLowerCase().includes(t))); } rows.sort((a, b) => Date.parse(b.lastSeenAt || '') - Date.parse(a.lastSeenAt || '')); const take = Math.max(Number(limit || 100), 1); return ok({ total: rows.length, returned: Math.min(rows.length, take), papers: rows.slice(0, take) }); } catch (e) { return err(`list_paper_index failed: ${String(e?.message || e)}`); } });

async function main() { ensure(); const transport = new StdioServerTransport(); await server.connect(transport); }
main().catch((e) => { process.stderr.write(`or-research-hub server error: ${String(e?.message || e)}\n`); process.exit(1); });

