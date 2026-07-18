/**
 * Promo redeem-code engine (Settings → "Redeem Code").
 *
 * The owner hands out codes shaped `DEEP-XXXX-XXXX-XXXX`; a player types one in
 * and receives a reward (a gems/perk IAP product's benefits, or a cash grant).
 * Codes are redeemable ONCE PER DEVICE.
 *
 * SECURITY: the app ships ONLY salted SHA-256 hashes of the codes — the
 * plaintext codes live exclusively with the owner and must NEVER appear in any
 * repo file. The salt below is NOT a secret (it ships in the bundle); the
 * plaintext codes are the secret. See docs/REDEEM-CODES.md.
 *
 * Exactly-once, per-device grant protocol mirrors utils/discordRewardClaim.ts:
 * a durable AsyncStorage ledger (`redeemed_codes_v1`) records finalized hashes
 * plus an optional pending marker frozen at begin time, and an in-state
 * `redeemedCodeHashes` array is the additive half that lets the launch-time
 * reconciler tell "granted-not-saved" from "saved-not-finalized".
 */
import { applyProductBenefitsToState, iapService } from '@/services/IAPService';
import { applyMoneyDelta } from '@/contexts/game/actions/MoneyActions';
import { getProductConfig, IAP_PRODUCTS } from '@/utils/iapConfig';
import { formatMoney } from '@/utils/moneyFormatting';
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import { logger } from '@/utils/logger';
import type { GameState } from '@/contexts/game/types';

// ───────────────────────────────────────────────────────────────────────────
// Vendored, dependency-free SHA-256 (expo-crypto is NOT installed; no Node
// `crypto` in app code). Clean-room implementation of FIPS 180-4 operating on
// UTF-8 string input and returning lowercase hex. Exported so tests can verify
// it against the standard vectors.
// ───────────────────────────────────────────────────────────────────────────

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Encode a JS string to its UTF-8 bytes (matches Node's Buffer.from(str)). */
function utf8Bytes(str: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      // High surrogate: combine with the following low surrogate.
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code & 0x3ff) << 10) + (next & 0x3ff);
        i++;
        out.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        );
      } else {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    } else {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(out);
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/** SHA-256 of a UTF-8 string, returned as 64 lowercase hex chars. */
export function sha256Hex(message: string): string {
  const bytes = utf8Bytes(message);
  const bitLen = bytes.length * 8;

  // Pad: 0x80, then zeros to 56 mod 64, then the 64-bit big-endian bit length.
  const withOne = bytes.length + 1;
  const padZeros = (56 - (withOne % 64) + 64) % 64;
  const totalLen = withOne + padZeros + 8;

  const buffer = new Uint8Array(totalLen);
  buffer.set(bytes, 0);
  buffer[bytes.length] = 0x80;
  const view = new DataView(buffer.buffer);
  // bitLen fits well under 2^53 for any realistic input; split into 32-bit halves.
  view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(totalLen - 4, bitLen >>> 0);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(offset + t * 4);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let t = 0; t < 64; t++) {
      const bigS1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + bigS1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const bigS0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (bigS0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += h[i].toString(16).padStart(8, '0');
  }
  return hex;
}

// ───────────────────────────────────────────────────────────────────────────
// Reward table (salted hashes only — never any plaintext code).
// ───────────────────────────────────────────────────────────────────────────

/** `{ p }` grants that IAP product's benefits; `{ m }` grants that much cash. */
export type RedeemReward = { p: string } | { m: number };

/**
 * Public salt appended to the normalized code before hashing. NOT a secret — it
 * ships in the bundle. Rotating codes means regenerating salt + table together
 * (see docs/REDEEM-CODES.md).
 */
export const REDEEM_SALT = '0b18c458fb224fd797ac1a0984b25760';

/**
 * Salted-SHA-256 → reward table. Keys are `sha256Hex(normalizedCode + REDEEM_SALT)`.
 * Generated by the owner's offline script; embedded verbatim.
 */
export const REDEEM_HASHES: Record<string, RedeemReward> = {
  '8d161720730fb86fe4d18485169ee2c0d4102e5420fafcfa522065cc48113e09': {p:'deeplife_gems_100'},
  'ce0d76b704759debd26755fa2b06358c211a846528d2f3e8b760c84253670e5c': {p:'deeplife_gems_100'},
  '92c8e3137746b00c1cef70fc9b31f4411decc9e933ecea78fcac36ee3be63544': {p:'deeplife_gems_100'},
  '4ae9919e8d7491f504587775526632a65011731dea471d37f00dd2b3d3061125': {p:'deeplife_gems_100'},
  'f3f417177856b312998ae7b9c36abe0f2691f0e3e06e99c30cdf585caca80a94': {p:'deeplife_gems_100'},
  'b09d1bddc49339a21915789e54807be157d2c2dfd0d85eeb928b2f57feefd87a': {p:'deeplife_gems_500'},
  'e94986bb09dc77d73652257d28f6d6899fc9b48ebdba6f3cc6f2fc43b81a4109': {p:'deeplife_gems_500'},
  '1428ab63c993a7bf30234ba0230c6decc62d4278d0a5ab01223ee6293c46d0d2': {p:'deeplife_gems_500'},
  '8230577a35d579a554e9ea6c1da806fdc3fb514815b2204eb939be97b8a727b4': {p:'deeplife_gems_500'},
  '306fe2e8045249b1e474a8a26ea345a9bc897a0230f55c6611f8ca9d22328f82': {p:'deeplife_gems_500'},
  '975a248be6b5116a2f7bda3eb72279b3a3d50676c39e5e65eaecb1772e39633a': {p:'deeplife_gems_1000'},
  '7bc38a242050d376c88e721b7a8803a1aac61d9c92fe50f4203115e3ff5e5eb2': {p:'deeplife_gems_1000'},
  '8249ccb120c5267f9d84c36a5090c26b5b62fe4871c37ac24322c7f2e39e5b73': {p:'deeplife_gems_1000'},
  'd3db526da5d3c684894200de4fa1bba33f88b711cec8f57216057f0be398e5a2': {p:'deeplife_gems_1000'},
  'cc6c3fc64a9bc943670dc06cfc58f237044f354aa34e32b16252950b9d8a395d': {p:'deeplife_gems_1000'},
  'fdb56c33f1a61dabd919448443c769d66ee75f32e85e64794ba48ab807203a25': {p:'deeplife_gems_5000'},
  '04809a765c306e74f4d143b9e582ade10182509019557bceb315855a030a7767': {p:'deeplife_gems_5000'},
  '05a7abb7c4f53b35aa8c755377f7fd2103af8180bd404b20d61643a3e516624b': {p:'deeplife_gems_5000'},
  'f72ed0b0e3e4eb55501d1ab56f795ac268d76e544f2c5caca99ce9063b167137': {p:'deeplife_gems_5000'},
  '314d7ec887d95248e54847fadad40256d427bc5421e629afbd9d19ff66994766': {p:'deeplife_gems_5000'},
  '91b328adb66dcf0e4b1ec9add971df54af179e0dac909a3a8f4a9e23a494645f': {p:'deeplife_gems_15000'},
  'bc1eab93e97394c7d62bc5f8433d19e16f450b2fd74c3d9fb54b474ca2257ed1': {p:'deeplife_gems_15000'},
  '8317a7cd81208700fcf17c2c0fe521a52050c86f5e9fa473c7c7819bde4e9a0b': {p:'deeplife_gems_15000'},
  '83085069a3fe4b5cac7aaef0df85ad6f91d8e0f568be11cfbc4ee005a5744b98': {p:'deeplife_gems_15000'},
  '800523333a26a3a9a8bfd4e45cf83e6982ea70b20015cf4109bfb0b12d8f1920': {p:'deeplife_gems_15000'},
  '25e6de006750f428c5881a1d7300f018b22c5b608d9e8d47129121acdb9b910b': {p:'deeplife_gems_50000'},
  'a74da996702a928ec6cc472f65d92ed26b6460621e91e4d9dc95f75cdadf7225': {p:'deeplife_gems_50000'},
  '26c691e0e6eaa903ddc2f0ab2107ce2c5638f7bf6924ca9250e2df970dcb182c': {p:'deeplife_gems_50000'},
  'e6459d8b9cccfeb0803b21cbbb75d0250ff4e3ac692421c7a410615229992832': {m:10000},
  '6a76ec13089247d651ebb207ebeb49b502532947bf41ffdee746a22c30b49b0c': {m:10000},
  'ee612888170cb575c3cb58a46e750f92a4edba31deabaec7c0b88552acd7674f': {m:10000},
  '7d6da1b8ce5b7316375ba3766b94d2ab64ddc559f3502cc4567fc71676d4dc88': {m:10000},
  '60e447840d00424abe1c49f9175c1a4a4c51151109307492e1fd26b787bb9243': {m:10000},
  '5dc6a6466fe8e7e6a25d1d41c622ce7e409b63726157abf368280ef9d3219387': {m:100000},
  'd5c3c53285e51f97c95d62e6e41cbad3cf60d3a367053a64e739003a356a8dd5': {m:100000},
  'b7cf091d99e3ff7ddd1851947be4cbe91b2d8142876fe82c05c0452ea8feda69': {m:100000},
  'bba341d682531966e27d259dcfd1868cc90d0bf00e3610320c2320078a7d38f6': {m:100000},
  'a96a6915d2e2f9bd0baea37809a1dbd495e74b778aebbc101f63484d5e43c592': {m:100000},
  'c1fccaac6a07e08d79a9d4687d106600b237a87269dd0dd6d1827f136460ff67': {m:1000000},
  'e9f0112a51103f500eac9e13aa7f508a1a7fa0422c8a0e43bdd09eb53d2b65f1': {m:1000000},
  '499885db34c8e765b957ab5ce3c8a361a8f8bfef1bfd8bafd1b2734adb624933': {m:1000000},
  'a120e6550405c85baf79e1af60c98c51375276ecaaedebfe0d5a29d32c656feb': {m:1000000},
  'f2f0d4ccf129a44884d92334604401552fb95a1a98bc71bec14522ce3119d5cf': {m:1000000},
  '41f55bf469c90fba6d9ed9938c7fa0431ce85ef0e5ed0b20639daf516df71b7d': {m:10000000},
  '44e18c2d3e09ab3764d19a758372e0b1d449094c5b7dd84a84d91e23f3027c78': {m:10000000},
  '243ec7dcab8c98c3e39634c90c78f4470ac150dee34720a38e81fb815ef83b2a': {m:10000000},
  'bc4c45df949d1e739e56890fbd5c5c8af8085c6e7195c3c36889dc7264efbaa9': {p:'deeplife_gems_starter'},
  'ebd2c09ac4c577f5772b6182b8beb55c1cfa4ec0e42f6807882b057f1a6af0d0': {p:'deeplife_gems_starter'},
  'af7aa79cf988d89258ffa1356e9c5445b3208a59a29381b29c7cd31e02451cbb': {p:'deeplife_gems_starter'},
  '326287c2dfe93120305e3e696231440c1efe983cfb5670a42aa844c36a26cf5c': {p:'deeplife_gems_premium'},
  '47b2bd4e1d1a82b03624d6ea0a0069098096a3ab080ffb088126e26736d98f38': {p:'deeplife_gems_premium'},
  '1f394fb1fbdefb11549e7d008fdd74c8c6caf717bd174d76cf4ecc4456d0bae4': {p:'deeplife_gems_premium'},
  '4a20cdfffd427e797883f26541d433e6c1f9eaaccb735a079991699631d05db1': {p:'deeplife_gems_ultimate'},
  '7266c6c892f9188169ef2cf1978bb424ab5b0091a2615f4c4331295d231c8960': {p:'deeplife_gems_ultimate'},
  'e133862e358f566555ddfc87f1ce5fc9b8c248ac079beee2b25eed57b2342286': {p:'deeplife_gems_ultimate'},
  '9870db2ac15648f2f53e915fb1aa0b70c4761436fc431e56dbfc18ad6a95eb43': {p:'deeplife_gems_mega'},
  '702cec2af0b78f619a511891c3c832ee546120e051f4caaafaf9996b9c22adff': {p:'deeplife_gems_mega'},
  '2895058461ed4247ceb4caad605c6e7935424ec84d43b0f408cf0b71d6c88fe5': {p:'deeplife_gems_mega'},
  '4678447346bbe33a3af76568b2aefc9bcd6667358bef4f0cfe68eb69af29508e': {p:'deeplife_youth_pill_single'},
  '2dc3960ffc17be914462f0501b186aa2614e2aa23c20b91f9a193bc9fbb4752c': {p:'deeplife_youth_pill_single'},
  '929daebc613c076cfeb8746f21886a6d5fd1c018185f4ed4f55060d9a8f0b571': {p:'deeplife_youth_pill_single'},
  '83e05942fd606d2d5a94040a2b6bac6404fc76f4ad41b4b94c026b2e56573173': {p:'deeplife_youth_pill_pack'},
  'b67f697d4f8ec44b41f99cb4a00a27e60c05767e4bb729b887a1b500e2a51856': {p:'deeplife_youth_pill_pack'},
  '756e3a2aa07a41110cc530ef0a3d9a22e87592615f567ee2b8f1783c9adcd4ef': {p:'deeplife_youth_pill_pack'},
  '28bc50e039d7d7d6ac831d8055454ff9dffe6405a9dad7bfbf0f81a04184b9e2': {p:'deeplife_money_boost'},
  'b1b3bdf83dae3bab6e01071d69913a001ed0f372cc173b0fd5056cbe6eed7265': {p:'deeplife_money_boost'},
  'add58e8921f4ee02352e4defbb11c800168c3f7a3f16e832493836f10f36d1e8': {p:'deeplife_money_boost'},
  '1d236c955f1c728ca31852f91ff807fb7ddf09bdbd38fe49bfafae4740d5ead8': {p:'deeplife_skill_boost'},
  '47e08d795659116918f0390e75d67c1a62ae94b0e7b466ad727f48eba118c7ce': {p:'deeplife_skill_boost'},
  '9e53dc78351d12b84d2da1e83327d3fa633b2f1a9998077d91c0cd3b65b27dd6': {p:'deeplife_skill_boost'},
  'b5e85658f0bd1ca4f22087207302c186b90bc7a09a764bfdb0714a4b84ea333d': {p:'deeplife_work_boost'},
  '372acf792f3246748b27ad2397e00167dd10d193950aa5f75fdbfd673c703e18': {p:'deeplife_work_boost'},
  '6957f17d74a9c7de06efe1f34d142c48211703d9a5e7c8f5a53f3301b1faa3a0': {p:'deeplife_work_boost'},
  '85f12d093acbc40264bb0405b4996e20f24e3678ff57262dfe442b7132f55f34': {p:'deeplife_mindset_perk'},
  '4e0989917556e37f7df2d4a77bdc8f989a517a9b3b0f01b3d920d791f43f470f': {p:'deeplife_mindset_perk'},
  '71f3f3a93fe9c4dfbab8336b595e589df8faa7a56febd588d7465eeda6346964': {p:'deeplife_mindset_perk'},
  '94fffb20fc0ec5fb4145af269fe7999a60e724e7f9854c83c8196a640402bcf3': {p:'deeplife_fast_learner'},
  'a3fa8e75d55a2d121d05ef9630a72d70d060918bb473a1a61d8cfc0f0d3de6e3': {p:'deeplife_fast_learner'},
  '849c7506e51272ce37389da1f18d68ad86842644eb4e06759516ddc6d48e1eff': {p:'deeplife_fast_learner'},
  '5ee371f39e1bc5e99ebc7d0f8b9b742b63830d6db0a8f5e24fcc82310985704e': {p:'deeplife_good_credit'},
  '41cebde52147234d5d58cc883728932cc7980353332e2714847e5fa0508ab6cd': {p:'deeplife_good_credit'},
  'fe972e4223df8b2cb5dd3d6e0d29afba14d2ea333b1a01692be9d02565603443': {p:'deeplife_good_credit'},
  'df446666f9b8c90921720f09f331292decca844f9460c4e5b5fb33b7a4849dd7': {p:'deeplife_unlock_all_perks'},
  '4a72f2d634b406c4e46323ebb3a0c003cb5b7240a67d29a19f09f586f7b08c22': {p:'deeplife_unlock_all_perks'},
  '405fdf7d7c70008bfd0639775443eb4ca9ab40721b97b26add39ad06a600f097': {p:'deeplife_unlock_all_perks'},
  'cc72c2f1efd2fad2cc45ae5039ec86d96868beb89ad8c24eab4fc285047be821': {p:'deeplife_remove_ads'},
  'dc79e27430bf5bbe0aef9e6efb5112f41f91564fc9573f26f5dd2cf2eada13ea': {p:'deeplife_remove_ads'},
  '8dce849b621c6ca3df7182ab66cb7b3d8ca67e7549c5c08ad3059863e7888b7c': {p:'deeplife_remove_ads'},
  'cfae87f6a096e1b619a3b7a96b171348be2dfadcffcba9fe1e418c412795b536': {p:'deeplife_remove_ads'},
  '39407216264db54fa31d95215891f18e845834c692781ab2c27c6a87bca69fd4': {p:'deeplife_remove_ads'},
  '1ef65189b1a81472bc08b4d0961cce50f71889eefe259e7c201783447bc57617': {p:'deeplife_lifetime_premium'},
  '6c9ca2a8d143ae0e2cfc7766c1d59e5bbd208c6a993407555cad9fa71c0fceb8': {p:'deeplife_lifetime_premium'},
  'b66d1c845a53027e14850e39db85062d85f904decce36bbfe379838eb8deb2a9': {p:'deeplife_lifetime_premium'},
  'cdaef9dca6de1381ea4068ebbf22185dc79d7ca4c14353aa6b278a4763ca73c1': {p:'revival_pack'},
  '5dfd08a23a558d5e465b8f7a0645035d12bbc1317e7a836956ef07bc72724f1d': {p:'revival_pack'},
  '3bd4c580f6c598ad7f95497ae0621074aae861903bfbb70bb234747dc4be4356': {p:'revival_pack'},
  'e15398ff81eb1d2e9660ecfdbd216f9b363a436eab0578e96c799ff7503a11f8': {p:'deeplife_premium_credit_card'},
  '180ec882d6ff090f1483bfdb9eae59b08b9663bc8a33dcc046a021eeac7e67ff': {p:'deeplife_premium_credit_card'},
  'fc2084fb793ea91c5fbcf064c02e2ef11e7fe3fe437903a8693503f94f6fb064': {p:'deeplife_premium_credit_card'},
  'bb3f48bdf165603102bd774c742ebf2767b396487110d7e72a063fddf34bf66d': {p:'deeplife_financial_planning'},
  '67bd178d248673ed2eb5f27646eee1db7b9954bd85761b097a1c9d188e73c464': {p:'deeplife_financial_planning'},
  'a6612dc502c82c1b703a673cfe5047b6b2002b04ecfcf46256a523236987642f': {p:'deeplife_financial_planning'},
  'da9ba68e0ab2bdc4ba0c12f5adaf65ea7e5dd343d7ebdcb6559d3ce27aec9c4d': {p:'deeplife_business_banking'},
  'e57bd5ea2832ed104ede24678616da9e6536b51e37e56b8bec73cc05b578fcc2': {p:'deeplife_business_banking'},
  '9a41b878a7c999958f544db6d7102316ff90924bc0cb2bfb6219423a428f8c20': {p:'deeplife_business_banking'},
  '12431eb0075d4e26aa3b332645550c1e28df325e58f1c1aeb7bee08e02556a59': {p:'deeplife_private_banking'},
  'e01ced91bafd963a1f08c0e95e0a5d3a5192bb3ee680dce35ca985f2963ea4af': {p:'deeplife_private_banking'},
  '621979903d9fee69b29b1d2e217c6c990a768893a8cd0e404b8faf16d1ae3001': {p:'deeplife_private_banking'},
};

// ───────────────────────────────────────────────────────────────────────────
// Normalization + lookup.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Canonicalize user input for hashing: UPPERCASE first, then strip everything
 * that is not A-Z or 2-9. A valid code yields 16 chars beginning with `DEEP`
 * (the prefix IS part of the hash input).
 */
export function normalizeRedeemCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, '');
}

/** A normalized code is only worth hashing/looking up when it matches this. */
const REDEEM_SHAPE = /^DEEP[A-Z2-9]{12}$/;

/**
 * Test-friendly lookup against an explicit salt + table, so tests can exercise
 * the full normalize → shape-check → hash → lookup path with a synthetic table
 * built from obviously-fake codes (never the real ones).
 */
export function lookupRedeemCodeWithTable(
  input: string,
  salt: string,
  table: Record<string, RedeemReward>,
): { hash: string; reward: RedeemReward } | null {
  const normalized = normalizeRedeemCode(input);
  if (!REDEEM_SHAPE.test(normalized)) return null;
  const hash = sha256Hex(normalized + salt);
  const reward = table[hash];
  return reward ? { hash, reward } : null;
}

/** Look a user-entered code up against the shipped salt + hash table. */
export function lookupRedeemCode(
  input: string,
): { hash: string; reward: RedeemReward } | null {
  return lookupRedeemCodeWithTable(input, REDEEM_SALT, REDEEM_HASHES);
}

// ───────────────────────────────────────────────────────────────────────────
// Per-device ledger (exactly-once) — mirrors utils/discordRewardClaim.ts.
// ───────────────────────────────────────────────────────────────────────────

/** AsyncStorage key holding the per-device redeem ledger. */
export const REDEEM_LEDGER_KEY = 'redeemed_codes_v1';

/** Money-mutator reason — kept identical across grant + reconcile. */
const REDEEM_REWARD_REASON = 'Redeem code reward';

/** An in-flight claim, frozen at begin time. */
export interface PendingRedeemMarker {
  hash: string;
  reward: RedeemReward;
}

export interface RedeemLedger {
  /** Hashes whose grant is fully committed + persisted. */
  finalized: string[];
  /** A claim begun-but-not-finalized, or null. */
  pending: PendingRedeemMarker | null;
  /**
   * The stored value existed but was unparseable / not our shape. Callers treat
   * EVERY code as already-redeemed (withhold) — the safe no-double-grant
   * direction, exactly like discordRewardClaim's "malformed → finalized".
   */
  corrupt: boolean;
}

/** True only when `value` is exactly one of `{ p:string }` or `{ m:finite }`. */
function isValidReward(value: unknown): value is RedeemReward {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const hasP = typeof record.p === 'string' && record.p.length > 0;
  const hasM = typeof record.m === 'number' && Number.isFinite(record.m);
  return hasP !== hasM; // exactly one
}

/** Serialize only the durable fields (never the derived `corrupt` flag). */
function serializeLedger(finalized: string[], pending: PendingRedeemMarker | null): string {
  return JSON.stringify({ finalized, pending });
}

/**
 * Read + classify the ledger. Parses DEFENSIVELY: any malformed / non-ledger
 * value reads as `corrupt` (→ withhold every code), never as an empty ledger,
 * so a corrupt marker can never trigger a re-grant.
 */
export async function readRedeemLedger(): Promise<RedeemLedger> {
  let raw: string | null;
  try {
    raw = await safeGetItem(REDEEM_LEDGER_KEY);
  } catch {
    return { finalized: [], pending: null, corrupt: true };
  }
  if (raw == null) return { finalized: [], pending: null, corrupt: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { finalized: [], pending: null, corrupt: true };
  }

  // A genuine ledger is always an object carrying a `finalized` array.
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed) ||
    !Array.isArray((parsed as { finalized?: unknown }).finalized)
  ) {
    return { finalized: [], pending: null, corrupt: true };
  }

  const obj = parsed as { finalized: unknown[]; pending?: unknown };
  const finalized = obj.finalized.filter(
    (h): h is string => typeof h === 'string' && h.length > 0,
  );

  let pending: PendingRedeemMarker | null = null;
  const rawPending = obj.pending;
  if (rawPending && typeof rawPending === 'object') {
    const marker = rawPending as { hash?: unknown; reward?: unknown };
    if (typeof marker.hash === 'string' && marker.hash.length > 0 && isValidReward(marker.reward)) {
      pending = { hash: marker.hash, reward: marker.reward };
    }
    // A present-but-malformed pending reads as no pending — never granted; it is
    // overwritten by the next successful begin/finalize.
  }

  return { finalized, pending, corrupt: false };
}

/** True when this device has already redeemed (or is mid-redeeming) `hash`. */
export async function isCodeRedeemedOnDevice(hash: string): Promise<boolean> {
  const ledger = await readRedeemLedger();
  if (ledger.corrupt) return true; // withhold — safe no-double-grant direction
  return ledger.finalized.includes(hash) || ledger.pending?.hash === hash;
}

/**
 * Begin a claim: durably record the FROZEN pending marker BEFORE any reward is
 * granted. Returns false if the write fails — the caller must then grant nothing
 * and leave the code redeemable (never grant an uncommitted reward).
 */
export async function beginRedeemClaim(hash: string, reward: RedeemReward): Promise<boolean> {
  const ledger = await readRedeemLedger();
  // Preserve finalized history; a corrupt read yields [] (begin only runs behind
  // the UI's not-yet-redeemed gate, so this is a defensive worst case).
  const finalized = ledger.corrupt ? [] : ledger.finalized;
  try {
    return await safeSetItem(REDEEM_LEDGER_KEY, serializeLedger(finalized, { hash, reward }));
  } catch {
    return false;
  }
}

/**
 * Finalize a claim: move `hash` into `finalized` and clear the pending marker.
 * Called only AFTER the grant has been persisted (saveGame resolved). Idempotent
 * — also the discard path for a malformed pending.
 */
export async function finalizeRedeemClaim(hash: string): Promise<void> {
  const ledger = await readRedeemLedger();
  const base = ledger.corrupt ? [] : ledger.finalized;
  const finalized = base.includes(hash) ? base : [...base, hash];
  await safeSetItem(REDEEM_LEDGER_KEY, serializeLedger(finalized, null));
}

// ───────────────────────────────────────────────────────────────────────────
// Grant application (pure).
// ───────────────────────────────────────────────────────────────────────────

/** Deep clone game state for the in-place product-benefit applier. */
function cloneState(state: GameState): GameState {
  if (typeof structuredClone === 'function') return structuredClone(state);
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/**
 * The shipped table uses canonical (iOS/default) product ids. One id differs per
 * platform: the Mindset perk is `deeplife_mindset_perk` on iOS but Android's
 * catalog keeps the original `deeplife_mindset`. Resolve to the id THIS
 * platform's catalog actually keys, so a mindset code grants on both (on iOS the
 * alias is the identity).
 */
const REDEEM_PRODUCT_ALIASES: Record<string, string> = {
  deeplife_mindset_perk: IAP_PRODUCTS.MINDSET,
};

function resolveRedeemProductId(tableId: string): string {
  return REDEEM_PRODUCT_ALIASES[tableId] ?? tableId;
}

/**
 * Apply a reward to game state in ONE pure, idempotent, atomic step: grant the
 * reward AND append `hash` to `state.redeemedCodeHashes`, so the reward and the
 * flag can never be persisted apart (which is what makes reconciliation
 * idempotent). Dedup: if `hash` is already recorded, returns `state` unchanged.
 *
 * `{ m }`  → canonical `applyMoneyDelta` (same path discord/economy use).
 * `{ p }`  → the shared `applyProductBenefitsToState` (grant parity with a real
 *            purchase — no duplicated benefit logic).
 */
export function applyRedeemReward(
  state: GameState,
  hash: string,
  reward: RedeemReward,
): GameState {
  const existing = Array.isArray(state.redeemedCodeHashes) ? state.redeemedCodeHashes : [];
  if (existing.includes(hash)) return state; // already granted — no second grant

  if ('m' in reward) {
    const applied = applyMoneyDelta(state, reward.m, REDEEM_REWARD_REASON);
    if (!applied) {
      // Non-finite amount (never expected) — still flag so the reconciler can't
      // loop forever on a bad stored marker.
      return { ...state, redeemedCodeHashes: [...existing, hash] };
    }
    return { ...state, ...applied, redeemedCodeHashes: [...existing, hash] };
  }

  const productId = resolveRedeemProductId(reward.p);
  const config = getProductConfig(productId);
  if (!config) {
    // Product id not resolvable in this build's catalog — consume the code once
    // (flag the hash) so it can't loop; nothing to grant.
    return { ...state, redeemedCodeHashes: [...existing, hash] };
  }
  const next = cloneState(state);
  applyProductBenefitsToState(next, config, productId);
  next.redeemedCodeHashes = [...existing, hash];
  return next;
}

/** Human-facing label for the success card. */
export function rewardLabel(reward: RedeemReward): string {
  if ('m' in reward) return formatMoney(reward.m);
  const config = getProductConfig(resolveRedeemProductId(reward.p));
  return config?.name ?? reward.p;
}

/**
 * Cross-slot entitlement side effects for a product-backed reward — the exact
 * persistence step a real purchase runs after applying benefits
 * (`iapService.persistPermanentPerks`), so a redeemed permanent perk (work
 * boost, mindset, fast learner, good credit, unlock-all) survives new lives and
 * other save slots the same way a bought one does. Idempotent; failures are
 * non-critical (the perk is already in the current save) and never throw.
 */
export async function persistRedeemedPerkEntitlements(reward: RedeemReward): Promise<void> {
  if (!('p' in reward)) return;
  const config = getProductConfig(resolveRedeemProductId(reward.p));
  if (!config) return;
  try {
    await iapService.persistPermanentPerks(config);
  } catch (err) {
    logger.warn('Redeem code: permanent-perk persistence failed (non-critical)', { error: err });
  }
}

// ───────────────────────────────────────────────────────────────────────────
// In-memory attempt throttle: max 5 lookups per rolling 60s.
// ───────────────────────────────────────────────────────────────────────────

const REDEEM_ATTEMPT_WINDOW_MS = 60_000;
const REDEEM_MAX_ATTEMPTS = 5;
// Module-level ring of attempt timestamps. Never call Date.now() at module load
// — only inside the functions below.
const redeemAttemptTimestamps: number[] = [];

/** True when another lookup attempt is allowed within the rolling window. */
export function canAttemptRedeem(): boolean {
  const cutoff = Date.now() - REDEEM_ATTEMPT_WINDOW_MS;
  while (redeemAttemptTimestamps.length > 0 && redeemAttemptTimestamps[0] < cutoff) {
    redeemAttemptTimestamps.shift();
  }
  return redeemAttemptTimestamps.length < REDEEM_MAX_ATTEMPTS;
}

/** Record that a lookup attempt happened (call once per user-driven attempt). */
export function recordRedeemAttempt(): void {
  redeemAttemptTimestamps.push(Date.now());
}

// ───────────────────────────────────────────────────────────────────────────
// Launch-time reconciler — mirrors the Discord reconciler in app/(tabs)/home.
// ───────────────────────────────────────────────────────────────────────────

export interface RedeemReconcileDeps {
  /** True when `hash` is already in the committed state's redeemedCodeHashes. */
  hasHash: (hash: string) => boolean;
  /** Fold the grant in: setGameState(prev => applyRedeemReward(prev, hash, reward)). */
  grant: (hash: string, reward: RedeemReward) => void;
  /**
   * Durably persist the committed state — `saveGame(true)`. Must resolve true
   * ONLY when the write completed; finalization is gated on that result.
   */
  save: () => Promise<boolean>;
}

/**
 * Complete, exactly once, any redeem claim a force-kill interrupted. Kill-point
 * walkthrough (all exactly-once):
 *   - killed BEFORE begin              → no pending → no-op.
 *   - killed AFTER begin, before grant → pending, hash NOT in state → grant the
 *                                        TABLE's reward for that hash, yield,
 *                                        save, finalize only on confirmed save.
 *   - killed AFTER grant+save          → pending, hash already in state → finalize
 *                                        only (no duplicate grant).
 *   - killed AFTER finalize            → no pending → no-op.
 * A malformed / corrupt pending is treated as no pending (nothing granted).
 *
 * SECURITY: the stored marker's `reward` copy is NEVER trusted — the reward is
 * re-derived from the shipped `REDEEM_HASHES` table, so a hand-edited
 * `redeemed_codes_v1` value cannot mint arbitrary grants. A pending hash that
 * is not in the table (tampered storage, or a table rotated by an app update
 * mid-claim) is discarded without granting.
 */
export async function reconcileRedeemClaim(deps: RedeemReconcileDeps): Promise<void> {
  let ledger: RedeemLedger;
  try {
    ledger = await readRedeemLedger();
  } catch (err) {
    logger.warn('Redeem code reconcile: ledger read failed', { error: err });
    return;
  }
  const pending = ledger.corrupt ? null : ledger.pending;
  if (!pending) return; // nothing was left in flight

  if (deps.hasHash(pending.hash)) {
    // Grant already committed + saved before the crash → finalize only. Re-run
    // the (idempotent) cross-slot entitlement persistence in case the crash
    // landed between saveGame and that step.
    const tableReward = REDEEM_HASHES[pending.hash];
    if (tableReward) await persistRedeemedPerkEntitlements(tableReward);
    await finalizeRedeemClaim(pending.hash);
    return;
  }

  // Re-derive the reward from the shipped table — never from the stored copy.
  const tableReward = REDEEM_HASHES[pending.hash];
  if (!tableReward) {
    logger.warn('Redeem code reconcile: pending hash not in table; discarding without grant');
    await finalizeRedeemClaim(pending.hash);
    return;
  }

  deps.grant(pending.hash, tableReward);
  await persistRedeemedPerkEntitlements(tableReward);
  // Macrotask yield: saveGame reads a post-commit ref synced in a passive effect,
  // so it lags the setGameState commit by one cycle — without this it would
  // persist the PRE-grant state.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  let saved = false;
  try {
    saved = await deps.save();
  } catch (err) {
    logger.warn('Redeem code reconcile save failed; will retry next launch', { error: err });
    return;
  }
  if (!saved) {
    // Not durably persisted — leave the pending marker; next launch retries.
    logger.warn('Redeem code reconcile save not confirmed; will retry next launch');
    return;
  }
  await finalizeRedeemClaim(pending.hash);
}
