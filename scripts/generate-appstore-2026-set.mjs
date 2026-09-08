// Canonical immersive App Store edition. See screenshots/appstore-2026/README.md.
process.argv.push('--devices=iphone-6.9,iphone-6.5');
await import('../screenshots/appstore-2026/source/build.mjs');
