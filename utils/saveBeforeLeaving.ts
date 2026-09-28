/** Await a durable canonical save before leaving the active life. */
export async function saveBeforeLeaving(
  saveGame: (force?: boolean) => Promise<boolean>,
  leave: () => void,
  stillActive: () => boolean = () => true,
): Promise<boolean> {
  const saved = await saveGame(true);
  if (!saved || !stillActive()) return false;
  leave();
  return true;
}
