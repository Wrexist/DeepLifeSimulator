# Store version 1.6.0 - App Store Connect, 2026-10-11

**Submitted for review 2026-10-12 - WAITING_FOR_REVIEW** with build 195 (binary 2.15.6).

| Item | State | Evidence |
|---|---|---|
| Version record 1.6.0 | Created, PREPARE_FOR_SUBMISSION (beats released 1.5.5) | asc-release runs 38160639888 (created, then 409 on `━`), 38160766474 (completed) |
| Build | 195 (binary 2.15.6, yellow supercar to match the screenshots) attached, VALID; replaced 194 | build run 38175999953, asc-release 38179028121 |
| Version copy | en-US updated; es-MX, pt-BR, fr-FR, de-DE created - What's New, description, keywords, promotional text | `marketing/aso/metadata.mjs`, `npm run check:aso` green |
| App Information | en-US unchanged; es-MX subtitle; pt-BR/fr-FR/de-DE name + subtitle | run 38160766474 |
| Screenshots | 10 x iPhone 6.9 / 6.5 / iPad 13 for all 5 locales, 150/150 processed | asc-screenshots runs 38160967350 (per-image timeout), 38161242465 (uploaded, 9 slow), 38163038045 (status: all complete) |
| Header + Search Results | header-c (5244x2950) and search-a (3840x2560) placed, ACTIVE, all 5 locales | asc-screenshots runs 38172379854 (plan, Apple ref data), 38172463023 (apply) |

Submission: the first attempt returned 409 - es-MX, pt-BR, fr-FR and de-DE had
no supportUrl (Apple's reasons were in meta.associatedErrors, which the client
now prints). They inherit en-US's support and marketing URLs; the retry reused
the open draft and submitted (run 38179028121).

Legal links (2026-10-12): the first submission lacked the Terms of Use (EULA)
link that 1.5.5's description carried - the repo copy never had it and the
sync replaced the hand-typed store text. Pulled from review (cancel-review run
38200078354, now DEVELOPER_REJECTED), all five descriptions updated with the
EULA and privacy links, resubmitted (run 38200311544, submission e429b0ca).
Verified on Apple's record: EULA and privacy in every description; privacy
policy URL field set in every locale.
