// Canonical immersive App Store edition. See screenshots/appstore-2026/README.md.
process.argv.push('--devices=ipad-13');
await import('../screenshots/appstore-2026/source/build.mjs');
