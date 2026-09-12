type NotesModule = typeof import('../../discord/playerNotes.mjs');
type CopyModule = typeof import('../../discord/copy.mjs');
let notes: NotesModule;
let copy: CopyModule;
beforeAll(async () => {
  notes = await import('../../discord/playerNotes.mjs');
  copy = await import('../../discord/copy.mjs');
});

it('publishes authored player benefits without PR links or internal sections', () => {
  const result = notes.playerNotesFromPr({ body: '## Summary\nTechnical title\n## Player update notes\n- Find your next goal. ([#212](https://github.com/org/repo/pull/212))\n- Claim your daily gems.\n## Risk\n- Internal detail' });
  expect(result).toEqual(['Find your next goal.', 'Claim your daily gems.']);
  expect(notes.developmentNoteBody(result)).toContain('Still taking shape');
  expect(notes.developmentNoteBody(result)).not.toMatch(/github|#212|Internal/);
});

it('keeps technical-only changes and template examples out of Discord', () => {
  expect(notes.playerNotesFromPr({ body: '## Summary\nFix lint' })).toEqual([]);
  expect(notes.playerNotesFromPr({ body: '## Player update notes\n<!--\n- Example, not a real update\n-->\n## Risk\n- Internal' })).toEqual([]);
  expect(notes.playerNotesFromPr({ body: '## Player update notes\n- None' })).toEqual([]);
});

it('strips GitHub URLs and references from live release notes too', () => {
  const post = copy.renderReleasePost({ storeVersion: '1.6.0', whatsNew: 'Your next chapter\n\n• Find your way home. https://github.com/org/repo/pull/212 (#212)' });
  expect(post.embeds[0].description).toContain('Find your way home.');
  expect(JSON.stringify(post)).not.toMatch(/github\.com|#212/);
});
