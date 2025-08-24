DeeplifeSim

## Changelog

- Added passive income utilities for stocks and real estate.
- Introduced inflation system with weekly price index.
- Added social relations with friends and romance influencing happiness.
- Implemented weekly event system with modal choices and logging.
- Introduced animated net worth display, smooth stat bars, and a finance overview.
- Added achievement progress tracking and journal logging.
- Introduced dynamic stock market with weekly simulations and economic events.
- Expanded careers with politician, celebrity, and athlete paths plus new achievements.
- Added cloud-backed leaderboard accessible from Settings.
- Added hobby minigames to train skills via a progression tab.
- Deferred travel system for a future update.

## Cloud Save

Set `EXPO_PUBLIC_CLOUD_SAVE_URL` to point to a backend service. The game will POST to `/save` with the serialized game state and fetch it via GET `/save` to synchronize progress across devices. Leaderboard scores are uploaded via POST `/leaderboard` and can be retrieved with GET `/leaderboard`.
