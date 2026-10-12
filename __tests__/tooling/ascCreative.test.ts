/**
 * Creative assets (Header and Search Results) are placed by Apple's own
 * reference data: which image spec a file satisfies, and which placement
 * groups accept that spec. Pinned here because a wrong match would silently
 * place nothing, or place a header into a group that cannot show it.
 */
type Creative = typeof import('../../scripts/lib/ascCreative.mjs');
let C: Creative;
beforeAll(async () => {
  C = await import('../../scripts/lib/ascCreative.mjs');
});

const ref = {
  placementTypes: [
    { placementTypeId: 'PRODUCT_PAGE_HEADER_ASSET', specMappings: [{ placementGroupId: 'ALL', specs: ['HEADER_16_9'] }, { placementGroupId: 'WIDE', specs: ['HEADER_21_9'] }] },
    { placementTypeId: 'APP_STORE_SEARCH_RESULTS_ASSET', specMappings: [{ placementGroupId: 'ALL', specs: ['SEARCH_3_2'] }] },
  ],
  imageSpecs: [
    { specId: 'HEADER_16_9', minWidth: 5244, maxWidth: 5244, minHeight: 2950, maxHeight: 2950, fileExtensions: ['png', 'jpg'], compatiblePlacementTypes: ['PRODUCT_PAGE_HEADER_ASSET'] },
    { specId: 'HEADER_21_9', minWidth: 3840, maxWidth: 3840, minHeight: 1646, maxHeight: 1646, compatiblePlacementTypes: ['PRODUCT_PAGE_HEADER_ASSET'] },
    { specId: 'SEARCH_3_2', minWidth: 1920, maxWidth: 3840, minHeight: 1280, maxHeight: 2560, compatiblePlacementTypes: ['APP_STORE_SEARCH_RESULTS_ASSET'] },
  ],
};

describe('creative asset matching', () => {
  it('matches a file to the spec its size satisfies, and only for its placement', () => {
    const header = { placementType: 'PRODUCT_PAGE_HEADER_ASSET', w: 5244, h: 2950, size: 1 };
    expect(C.matchingSpecs(ref, header).map((s: { specId: string }) => s.specId)).toEqual(['HEADER_16_9']);
    const search = { placementType: 'APP_STORE_SEARCH_RESULTS_ASSET', w: 3840, h: 2560, size: 1 };
    expect(C.matchingSpecs(ref, search).map((s: { specId: string }) => s.specId)).toEqual(['SEARCH_3_2']);
  });

  it('rejects a size no spec for that placement accepts', () => {
    const odd = { placementType: 'PRODUCT_PAGE_HEADER_ASSET', w: 3840, h: 2560, size: 1 };
    expect(C.matchingSpecs(ref, odd)).toEqual([]);
  });

  it('places only into groups whose spec list includes the image spec', () => {
    expect(C.groupsFor(ref, 'PRODUCT_PAGE_HEADER_ASSET', 'HEADER_16_9')).toEqual(['ALL']);
    expect(C.groupsFor(ref, 'PRODUCT_PAGE_HEADER_ASSET', 'SEARCH_3_2')).toEqual([]);
  });
});
