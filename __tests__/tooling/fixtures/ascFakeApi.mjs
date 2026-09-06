// A stand-in for the App Store Connect API, installed as `globalThis.fetch`
// before `scripts/asc-release.mjs` constructs its client.
//
// It exists because the one thing that cannot be checked by reading the code
// is which RESOURCE each field is written to: Apple splits a listing between
// appStoreVersionLocalizations (description, keywords, promo, What's New, the
// support and marketing URLs) and appInfoLocalizations (name, subtitle,
// privacy URL), and sending a field to the wrong one is a 4xx at Apple rather
// than a wrong value anybody could see here.
//
// The account it models is the awkward one: a released 1.3.5, an open editable
// draft, an en-US listing that already exists with STALE copy, and no es-MX
// listing at all — so a correct run has to produce one update and one create
// on each resource.

const json = (body) => ({
  status: 200,
  ok: true,
  text: async () => JSON.stringify(body),
});

/** Apple's own answer to a sparse fieldset naming an attribute it does not have. */
const invalidField = (name) => ({
  status: 400,
  ok: false,
  text: async () =>
    JSON.stringify({
      errors: [{ title: 'A parameter has an invalid value', detail: `'${name}' is not a valid field name` }],
    }),
});

const VERSION_ID = 'ver-1';
const APP_INFO_ID = 'info-editable';

globalThis.fetch = async (url) => {
  const path = String(url);

  // Apple renames attributes, and a sparse fieldset names them. Asking for
  // `appStoreVersionState` — the deprecated ENUM's name, never a field — is an
  // HTTP 400 before the plan prints a line, which is how the release script
  // shipped and why no run of it ever reached Apple. Reproduced here so a
  // fieldset that comes back reintroducing the class fails the suite instead.
  if (path.includes('appStoreVersionState')) return invalidField('appStoreVersionState');
  if (path.includes('fields[appStoreVersions]') || path.includes('fields%5BappStoreVersions%5D')) {
    return invalidField('fields[appStoreVersions] — do not name renameable attributes');
  }
  if (path.includes('fields[appInfos]') || path.includes('fields%5BappInfos%5D')) {
    return invalidField('fields[appInfos] — do not name renameable attributes');
  }

  if (path.includes('/appStoreVersions?filter[platform]') || path.includes('/appStoreVersions?filter%5Bplatform%5D')) {
    return json({
      data: [
        // The modern spelling on one and the deprecated one on the other, which
        // is what a real account that has shipped over the rename returns.
        { id: 'ver-old', type: 'appStoreVersions', attributes: { versionString: '1.3.5', appStoreState: 'READY_FOR_SALE' } },
        { id: VERSION_ID, type: 'appStoreVersions', attributes: { versionString: '1.6.0', appVersionState: 'PREPARE_FOR_SUBMISSION' } },
      ],
      links: {},
    });
  }

  if (path.includes(`/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations`)) {
    return json({
      data: [
        {
          id: 'vloc-en',
          type: 'appStoreVersionLocalizations',
          attributes: {
            locale: 'en-US',
            description: 'Stale description',
            keywords: 'old,keywords',
            promotionalText: 'Stale promo',
            whatsNew: 'Stale notes',
            supportUrl: 'https://old.example/support',
            marketingUrl: null,
          },
        },
      ],
      links: {},
    });
  }

  if (path.includes('/appInfos?')) {
    return json({
      data: [
        { id: 'info-live', type: 'appInfos', attributes: { state: 'READY_FOR_DISTRIBUTION' } },
        { id: APP_INFO_ID, type: 'appInfos', attributes: { state: 'PREPARE_FOR_SUBMISSION' } },
      ],
      links: {},
    });
  }

  if (path.includes(`/appInfos/${APP_INFO_ID}/appInfoLocalizations`)) {
    return json({
      data: [
        {
          id: 'iloc-en',
          type: 'appInfoLocalizations',
          attributes: {
            locale: 'en-US',
            name: 'Deep Life Simulator',
            subtitle: 'Rags to riches money life sim',
            privacyPolicyUrl: 'https://old.example/privacy',
          },
        },
      ],
      links: {},
    });
  }

  throw new Error(`fake App Store Connect API: unexpected request ${path}`);
};
