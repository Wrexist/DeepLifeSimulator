/** Keep development plumbing out of player-facing copy. */
export function cleanPlayerNote(text) {
  return String(text ?? '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/\[[^\]]*\]\(https?:\/\/(?:www\.)?github\.com\/[^\s)]*\)/gi, '')
    .replace(/https?:\/\/(?:www\.)?github\.com\/[^\s<>)]*/gi, '')
    .replace(/\(?#\d+\)?/g, '')
    .replace(/\(\s*\)/g, '')
    .trim();
}

/** Only explicitly authored player notes may become announcements. */
export function playerNotesFromPr(pr) {
  const body = String(pr.body ?? '').replace(/<!--[^]*?-->/g, '');
  const section = body.split(/^## Player update notes[ \t]*\r?\n/mi)[1]?.split(/^## /m)[0];
  if (!section) return [];
  return section.split(/\r?\n/)
    .filter(line => /^\s*[-*•]\s+/.test(line))
    .map(line => cleanPlayerNote(line.replace(/^\s*[-*•]\s+/, '')))
    .filter(line => line && !/^(none|n\/a|not applicable)\.?$/i.test(line));
}

export function developmentNoteBody(notes) {
  return [
    'A little peek at the next chapter of your DeepLife story…',
    '',
    ...notes.map(note => `• ${note}`),
    '',
    'Still taking shape. Watch #updates for what arrives in the game. ✨',
  ].join('\n');
}
