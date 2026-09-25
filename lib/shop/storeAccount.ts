/**
 * The name of the account a purchase belongs to, per store.
 *
 * The "Nothing To Restore" alert told every player to check "this Apple ID" -
 * on Android too, where purchases belong to the Google account signed into
 * Google Play. An Android player who restores and finds nothing is exactly the
 * one who needs the right account named, so the wording is decided here, once,
 * for both restore surfaces (the Gem Shop and Settings).
 *
 * Pure: callers pass `Platform.OS`, so the suite can check both stores without
 * mocking React Native.
 */

/** The account a store purchase is tied to, as a player would call it. */
export function storeAccountName(os: string): string {
  return os === 'android' ? 'Google account' : 'Apple ID';
}

/** Body of the "Nothing To Restore" alert. */
export function nothingToRestoreMessage(os: string): string {
  return (
    `No previous purchases were found for this ${storeAccountName(os)}. ` +
    'If you bought something on another account, sign in to that one and try again.'
  );
}
