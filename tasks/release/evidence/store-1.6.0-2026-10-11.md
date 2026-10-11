# Store version 1.6.0 - App Store Connect, 2026-10-11

Prepared for review, **not submitted**.

| Item | State | Evidence |
|---|---|---|
| Version record 1.6.0 | Created, PREPARE_FOR_SUBMISSION (beats released 1.5.5) | asc-release runs 38160639888 (created, then 409 on `━`), 38160766474 (completed) |
| Build | 194 (binary 2.15.5) attached, processing VALID | run 38160766474 |
| Version copy | en-US updated; es-MX, pt-BR, fr-FR, de-DE created - What's New, description, keywords, promotional text | `marketing/aso/metadata.mjs`, `npm run check:aso` green |
| App Information | en-US unchanged; es-MX subtitle; pt-BR/fr-FR/de-DE name + subtitle | run 38160766474 |
| Screenshots | 10 x iPhone 6.9 / 6.5 / iPad 13 for all 5 locales, 150/150 processed | asc-screenshots runs 38160967350 (per-image timeout), 38161242465 (uploaded, 9 slow), 38163038045 (status: all complete) |
| Header + Search Results | header-c (5244x2950) and search-a (3840x2560) placed, ACTIVE, all 5 locales | asc-screenshots runs 38172379854 (plan, Apple ref data), 38172463023 (apply) |

Remaining owner step: review the record in App Store Connect and submit
(`asc-release.yml`, mode `apply-and-submit`, confirm `SUBMIT`).
