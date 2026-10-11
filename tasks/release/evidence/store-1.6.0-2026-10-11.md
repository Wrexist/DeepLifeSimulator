# Store version 1.6.0 - App Store Connect, 2026-10-11

Prepared for review, **not submitted**.

| Item | State | Evidence |
|---|---|---|
| Version record 1.6.0 | Created, PREPARE_FOR_SUBMISSION (beats released 1.5.5) | asc-release runs 38160639888 (created, then 409 on `━`), 38160766474 (completed) |
| Build | 194 (binary 2.15.5) attached, processing VALID | run 38160766474 |
| Version copy | en-US updated; es-MX, pt-BR, fr-FR, de-DE created - What's New, description, keywords, promotional text | `marketing/aso/metadata.mjs`, `npm run check:aso` green |
| App Information | en-US unchanged; es-MX subtitle; pt-BR/fr-FR/de-DE name + subtitle | run 38160766474 |
| Screenshots | 10 x iPhone 6.9 / 6.5 / iPad 13 for every locale | asc-screenshots run 38160967350 |

Remaining owner step: review the record in App Store Connect and submit
(`asc-release.yml`, mode `apply-and-submit`, confirm `SUBMIT`).
