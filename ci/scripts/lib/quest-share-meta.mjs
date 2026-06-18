export const QUEST_SHARE_SITE_NAME = 'TerraFirmaGreg Quest';

export function formatQuestShareOgTitle(questTitle, siteName = QUEST_SHARE_SITE_NAME) {
  const quest = String(questTitle ?? '').trim();
  return `${quest} | ${siteName}`;
}
