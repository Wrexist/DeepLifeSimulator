# Typography and shared components - 27 September 2026

[Screenshot gallery](typography-cleanup-2026-09-27/gallery.html)

## Changes

Company Detail and portfolio cards now use the existing textStyles hierarchy: 44 local text font-size definitions replaced, including 22 metadata styles previously below 12-point base. Captions use the canonical 12/16 size/line box, rows use body/bodyStrong, and figures retain tabular digits. Staff meter labels/values have room to grow; badges use minimum height. Company names, costs, upgrade effects and requirement text wrap rather than truncating.

SectionTitle, CollapsibleSection, Chip, KeyValueRow and StatStrip share the same hierarchy. Disclosure headings are semibold, with natural wrapping and uncapped accessibility scaling. Supporting stat text and detail values can wrap. Small actionable chips and compact disclosures meet the 44-point minimum target. KeyValueRow includes its supporting explanation in the accessible label. Existing HUD, domain formulas, callbacks, schema 51 and saved state are unchanged.

## Verification

- Four focused suites / 32 tests passed, exit 0, 67.022s: shared wrapping/accessibility/callbacks, HUD line boxes, collapsible section width and company income reconciliation. The first new-test run failed because the repository StyleSheet.flatten mock is identity; a recursive test helper resolved style arrays and the rerun passed.
- Source and final test-project TypeScript passed, exit 0. The final test-helper numeric guard also passed its three-test rerun (45.615s); it fixed a test typing error without changing product behavior.
- Changed-file lint passed, exit 0, zero warnings/errors; follow-up lint for the disclosure and test helper passed. Diff check passed.
- UI ratchet passed: 142 gradients / 94 raw sizes / 645 heavy weights. Heavy-weight ceiling lowered from 647 to 645; no ceiling raised. These counts do not measure all typography quality or imply remaining component debt is zero.
- Browser checks at 320x667, 375x667 and 768x1024 passed, exit 0, zero page errors. Portfolio-to-company return, upgrade disclosure and unchanged $8,000 base income verified. Reviewed compact company/upgrade and tablet company captures. Screenshots use reduced motion and DPR 2, with a company created through developer tools in isolated QA storage. Initial preview startup and comma-specific currency assertion were corrected before the passing run.

- Additional Contacts/Hustle/DeepMail navigation regression passed at 375/768px, exit 0, zero page errors; the empty inbox did not exercise message detail.

## Remaining gates

V17 implementation follow-through complete; 27 audit items remain. Next: V18 Semantic color drift. Full branch CI, exact signed iPhone/iPad Larger Text/VoiceOver, populated named-hire/research/IPO states and the wider native navigation regression remain open. Browser screenshots are not native evidence. Other raw-size/heavy-weight declarations remain workload, not a claim that every screen has been migrated. No merge or OTA publication.
