#!/usr/bin/env node
/**
 * Generate share/ SEO shell HTML, sitemap.xml, and robots.txt for Quest Book deploy site.
 *
 * Usage: node ci/scripts/generate-share-shells.mjs <site-dir> [site-base-url]
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const qbmRoot = join(__dirname, '../..');

const DEFAULT_OG_IMAGE = 'https://wiki.terrafirmagreg.team/logo.png';
const SITE_NAME = 'TerraFirmaGreg Quest Book';
const DESCRIPTION_MAX = 160;

const siteDir = process.argv[2];
const siteBaseUrlArg = process.argv[3];

if (!siteDir) {
  console.error('usage: generate-share-shells.mjs <site-dir> [site-base-url]');
  process.exit(1);
}

function normalizeBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function resolveSiteBaseUrl() {
  if (siteBaseUrlArg) return normalizeBase(siteBaseUrlArg);
  const configPath = join(siteDir, 'site-config.json');
  if (existsSync(configPath)) {
    const config = readJson(configPath);
    if (config.siteBaseUrl) return normalizeBase(config.siteBaseUrl);
  }
  return normalizeBase(process.env.SITE_BASE_URL || 'https://wiki.terrafirmagreg.team/quest-book-modern');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function jsonString(value) {
  return JSON.stringify(value ?? '');
}

function truncate(text, max = DESCRIPTION_MAX) {
  const plain = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max - 1)}…`;
}

function spaUrl(siteBase, { locale, chapter, quest }) {
  const params = new URLSearchParams({ lang: locale });
  if (chapter) params.set('chapter', chapter);
  if (quest) params.set('quest', quest);
  return `${siteBase}/?${params.toString()}`;
}

function relativeToSpa(depth) {
  const prefix = depth > 0 ? '../'.repeat(depth) : './';
  return `${prefix}?`;
}

function renderShell({
  title,
  description,
  canonicalUrl,
  spaUrlTarget,
  depth,
  ogImage = DEFAULT_OG_IMAGE,
}) {
  const spaRelative = `${relativeToSpa(depth)}${canonicalUrl.split('?')[1] ?? ''}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: siteBase,
    },
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <meta http-equiv="refresh" content="0;url=${escapeHtml(spaRelative)}" />
  <script>location.replace(${jsonString(spaRelative)});</script>
</head>
<body>
  <p><a href="${escapeHtml(spaRelative)}">Open in Quest Book</a></p>
</body>
</html>
`;
}

const siteBase = resolveSiteBaseUrl();
const questExport = join(siteDir, 'data/quest-export');
const indexPath = join(questExport, 'quests/index.json');
const searchIndexDir = join(questExport, 'search-index');

if (!existsSync(indexPath)) {
  console.error(`::error::Missing ${indexPath}`);
  process.exit(1);
}

const questIndex = readJson(indexPath);
const siteTitle = questIndex.title || SITE_NAME;
const chapters = questIndex.chapters ?? [];

/** @type {string[]} */
let locales = [];
if (existsSync(searchIndexDir)) {
  locales = [...new Set(
    readdirSync(searchIndexDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -5)),
  )].sort();
}

if (locales.length === 0) {
  const langPath = join(siteDir, 'language.json');
  if (existsSync(langPath)) {
    locales = readJson(langPath).enabledLocales ?? ['en_us'];
  } else {
    locales = ['en_us'];
  }
}

const shareRoot = join(siteDir, 'share');
/** @type {string[]} */
const sitemapUrls = [];

let shellCount = 0;

for (const locale of locales) {
  const searchPath = join(searchIndexDir, `${locale}.json`);
  /** @type {Map<string, { chapterTitle?: string, quests: Array<{ id: string, title?: string, content?: string }> }>} */
  const byChapter = new Map();

  if (existsSync(searchPath)) {
    const payload = readJson(searchPath);
    for (const row of payload.quests ?? []) {
      if (!row.id || !row.chapter) continue;
      let bucket = byChapter.get(row.chapter);
      if (!bucket) {
        bucket = { chapterTitle: row.chapterTitle, quests: [] };
        byChapter.set(row.chapter, bucket);
      }
      if (row.chapterTitle && !bucket.chapterTitle) {
        bucket.chapterTitle = row.chapterTitle;
      }
      bucket.quests.push(row);
    }
  }

  const localeDir = join(shareRoot, locale);
  mkdirSync(join(localeDir, 'chapters'), { recursive: true });
  mkdirSync(join(localeDir, 'quests'), { recursive: true });

  const localeCanonical = spaUrl(siteBase, { locale });
  sitemapUrls.push(localeCanonical);

  const localeShell = renderShell({
    title: `${siteTitle} | ${SITE_NAME}`,
    description: `Browse FTB quest chapters and tasks for TerraFirmaGreg (${locale}).`,
    canonicalUrl: localeCanonical,
    spaUrlTarget: localeCanonical,
    depth: 2,
  });
  writeFileSync(join(localeDir, 'index.html'), localeShell);
  shellCount += 1;

  for (const chapter of chapters) {
    const filename = chapter.filename;
    if (!filename) continue;

    const bucket = byChapter.get(filename);
    const chapterTitle = bucket?.chapterTitle || chapter.title || filename;
    const chapterCanonical = spaUrl(siteBase, { locale, chapter: filename });
    sitemapUrls.push(chapterCanonical);

    const sampleTitles = (bucket?.quests ?? [])
      .slice(0, 5)
      .map((q) => q.title || q.id)
      .filter(Boolean)
      .join(' · ');
    const chapterDescription = sampleTitles
      ? `${chapterTitle} — ${sampleTitles}`
      : `Quest chapter: ${chapterTitle}`;

    const chapterShell = renderShell({
      title: `${chapterTitle} | ${SITE_NAME}`,
      description: truncate(chapterDescription, 200),
      canonicalUrl: chapterCanonical,
      spaUrlTarget: chapterCanonical,
      depth: 3,
    });
    writeFileSync(join(localeDir, 'chapters', `${filename}.html`), chapterShell);
    shellCount += 1;

    const questDir = join(localeDir, 'quests', filename);
    mkdirSync(questDir, { recursive: true });

    for (const row of bucket?.quests ?? []) {
      const questCanonical = spaUrl(siteBase, {
        locale,
        chapter: filename,
        quest: row.id,
      });
      sitemapUrls.push(questCanonical);

      const questTitle = row.title || row.id;
      const questShell = renderShell({
        title: `${questTitle} — ${chapterTitle} | ${SITE_NAME}`,
        description: truncate(row.content || questTitle),
        canonicalUrl: questCanonical,
        spaUrlTarget: questCanonical,
        depth: 4,
      });
      writeFileSync(join(questDir, `${row.id}.html`), questShell);
      shellCount += 1;
    }
  }
}

const uniqueUrls = [...new Set(sitemapUrls)];
const sitemapBody = uniqueUrls
  .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
  .join('\n');
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  sitemapBody,
  '</urlset>',
  '',
].join('\n');
writeFileSync(join(siteDir, 'sitemap.xml'), sitemap);

const robots = [
  'User-agent: *',
  'Allow: /',
  '',
  `Sitemap: ${siteBase}/sitemap.xml`,
  '',
].join('\n');
writeFileSync(join(siteDir, 'robots.txt'), robots);

console.log(
  `Generated ${shellCount} share shell(s), sitemap (${uniqueUrls.length} URL(s)), robots.txt → ${siteDir}`,
);
