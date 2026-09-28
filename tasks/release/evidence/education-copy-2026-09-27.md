# Education copy - 27 September 2026

[Screenshot gallery](education-copy-2026-09-27/gallery.html)

## What changed

Zero-net-cost enrollment (including full aid) now says **Enroll free**, explains that no cash or loan is needed, and omits payment choices. Paid buttons say **Pay [amount] & enroll** or **Sign loan & enroll**. Existing cash-after-tuition, non-refundable tuition and continuing-loan explanations remain available before commitment.

The catalogue, enrollment modal and course progress share exact week formatting: the diploma consistently shows 104 weeks, rather than switching from 2yr to 104w. Policy reductions remain explicit. The picker names the automatic classes before selection and explains how manual choices replace them. It no longer claims a two-class minimum that the existing handler did not require.

Canonical quotes, enrollment/withdrawal actions, prices, class fallback, duration math and save schema remain unchanged. A quote that becomes fully covered uses the existing cash enrollment path with zero cost.

## Verification

- 3 focused suites / 23 tests passed, exit 0, 69.682s: enrollment rendering, canonical quote/repayment and enrollment safety. Includes zero-cash free enrollment, full aid, manual class replacement, stale/dead-life rejection, duplicate charges and debt after withdrawal.
- Source and test-project TypeScript passed, exit 0.
- Changed-file lint passed, exit 0: six existing EducationApp useMemo warnings, zero errors.
- UI ratchet passed unchanged: 142 gradients / 94 raw font sizes / 647 heavy weights. Diff check passed.
- Browser journeys at 375x667 and 768x1024 passed, exit 0, zero page errors: free diploma has no payment radios; 104 weeks before and after enrollment; paid Business Degree loan disclosure remains accessible. Captures use DPR 2 and reduced motion.
- Initial browser fixture had Education locked by chapter progression. Used the existing unlocked isolated QA save instead; no unlock rule changed. Corrected the script's tab locator to the actual Catalog label.

## Handoff

V13 implementation complete; 31 audit items remain. Next: V14 Contacts action clarity. Signed iPhone/iPad, Larger Text, VoiceOver, localization and latest full CI remain acceptance gates. Browser evidence is not native evidence. No merge or OTA publishing authorized.
