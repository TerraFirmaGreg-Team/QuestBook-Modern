/**
 * Share shell og:title / og:site_name conventions.
 * Keep in sync with QuestBook-React/src/shared/lib/quest-share-meta.ts
 */
export const QUEST_SHARE_SITE_NAME = 'TerraFirmaGreg Quest Book';

/** og:title for per-quest share shells. */
export function formatQuestShareOgTitle(questTitle, chapterTitle, siteName = QUEST_SHARE_SITE_NAME) {
  const quest = String(questTitle ?? '').trim();
  const chapter = String(chapterTitle ?? '').trim();
  return `${quest} | ${chapter} | ${siteName}`;
}
