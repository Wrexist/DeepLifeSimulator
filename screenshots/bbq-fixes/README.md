# BBQ fixes — captured from the running app (2026-08-11)

Web preview (`npx expo start --web`) driven with Playwright at 430×932 @2x.
These prove the **B-1 gold-piggy fix** end to end in the real app, not in a test.

| Shot | What it shows |
|---|---|
| `01-hud-before.png` | Start of a fresh life: cash **$1,500**, gold piggy **0**. Before the fix the piggy stayed at 0 for the whole life — nothing could deposit into `bankSavings`. |
| `02-bank-overview.png` | Bank app: `Cash $1,500 / Bank $0`. |
| `03-savings-has-controls.png` | **The fix, side by side.** *Everyday Checking* still shows `Primary account · read-only` (correct — it mirrors cash). *Savings* now has **Deposit** and **Withdraw**. Previously both cards showed the read-only chip. |
| `06-savings-funded.png` | Savings balance **$1,000** after depositing. |
| `07-hud-after.png` | HUD after: cash **$500**, gold piggy **1,000**. The accessibility tree reads `Total savings: 1,000` — it was `Total savings: 0`. |

## The rebuilt account screen + the ad bonus

| Shot | What it shows |
|---|---|
| `08-ad-bonus-2k.png` | The bank's sponsored-ad bonus now reads **+$2,000** for a starting player. It used to be 2% of *cash* floored at **$50** — so a player with $40M in property and $300 in the wallet was offered $50. It now scales off `max(netWorth, cash) × 2%`, floored at $2,000 and capped at the same $500,000 `AdRewardOrb` uses. |
| `09-transfer-panel-deposit.png` | The rebuilt account screen. Deposit/Withdraw is one inline panel — segmented direction, big amount, drag slider, **10% / 25% / 50% / Max** chips — instead of two buttons that each opened a modal with a keyboard. Also note **no "Close account"**: `closeAccount` refuses the mirrored ids, so that button could only ever fail. Found by driving the app; the suite did not catch it. |
| `10-transfer-panel-withdraw.png` | The same panel flipped to Withdraw after a $750 deposit — Max re-bases onto the account balance, and the CTA states the exact amount it will move. |

## Not captured

The Onion **Gear** tab (C-1), listing **scam_risk** (D-2), Spark **befriend**
(X-3) and the **Acquire** modal (H-3) sit behind purchases — a $5,000 computer,
BTC, or a founded company — and the dev-tools shortcut for granting them loads
through a lazy modal that opens unreliably under automation. Those are covered by
`crimeToolsReachable`, `darkWebDelivery`, `friendsAndNeglect` and
`acquisitionValue`, which assert the wiring rather than the pixels.
