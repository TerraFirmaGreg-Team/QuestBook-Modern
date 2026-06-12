#!/usr/bin/env node
/**
 * Replace SEO placeholders in viewer index.html for the deploy target.
 *
 * Usage: node ci/scripts/patch-site-meta.mjs <site-dir> [site-base-url] [og-image-url]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PLACEHOLDER_CANONICAL = '__SITE_CANONICAL_URL__';
const PLACEHOLDER_OG_IMAGE = '__OG_IMAGE_URL__';
const DEFAULT_OG_IMAGE = 'https://wiki.terrafirmagreg.team/logo.png';

const siteDir = process.argv[2];
const siteBaseUrlArg = process.argv[3];
const ogImageUrlArg = process.argv[4];

if (!siteDir) {
  console.error('usage: patch-site-meta.mjs <site-dir> [site-base-url] [og-image-url]');
  process.exit(1);
}

function normalizeCanonical(url) {
  const trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return `${trimmed}/`;
}

function resolveSiteBaseUrl() {
  if (siteBaseUrlArg) return normalizeCanonical(siteBaseUrlArg);
  const configPath = join(siteDir, 'site-config.json');
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    if (config.siteBaseUrl) return normalizeCanonical(config.siteBaseUrl);
  }
  return '';
}

const indexPath = join(siteDir, 'index.html');
if (!existsSync(indexPath)) {
  console.error(`::error::Missing ${indexPath}`);
  process.exit(1);
}

const canonical = resolveSiteBaseUrl();
if (!canonical) {
  console.error('::error::SITE_BASE_URL / site-config.json#siteBaseUrl required to patch index.html');
  process.exit(1);
}

const ogImage = String(ogImageUrlArg || process.env.OG_IMAGE_URL || DEFAULT_OG_IMAGE).trim();
let html = readFileSync(indexPath, 'utf8');

if (!html.includes(PLACEHOLDER_CANONICAL)) {
  console.warn(`No ${PLACEHOLDER_CANONICAL} in ${indexPath} — skipping canonical patch`);
} else {
  html = html.replaceAll(PLACEHOLDER_CANONICAL, canonical);
}

if (html.includes(PLACEHOLDER_OG_IMAGE)) {
  html = html.replaceAll(PLACEHOLDER_OG_IMAGE, ogImage);
}

writeFileSync(indexPath, html);
console.log(`Patched ${indexPath} (canonical=${canonical} og:image=${ogImage})`);
