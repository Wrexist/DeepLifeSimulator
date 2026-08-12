/**
 * The authored geometry every face is assembled from.
 *
 * ── Coordinate system ─────────────────────────────────────────────────────
 * All paths live in a 200 × 220 viewBox. The head occupies y 34…155 with its
 * widest point at y 88; the neck runs from y 145 and the shoulders close the
 * frame at y 220. Facial landmarks sit at fixed anchors so a feature from one
 * catalog lines up with a feature from any other:
 *
 *     eye centres   (78, 96) and (122, 96)
 *     nose          spans y 100 … 118, centred on x 100
 *     mouth centre  (100, 132)
 *     ear centres   (51, 100) and (149, 100)
 *
 * A shape that ignores those anchors will look subtly wrong in combination
 * with everything else, which is the failure mode this comment exists to
 * prevent. `__tests__/avatar/geometry.test.ts` pins the anchors.
 *
 * ── Why literal paths ─────────────────────────────────────────────────────
 * These are authored, not generated. That is the whole point: a face built
 * from geometry someone chose cannot carry the artefacts — stray particles,
 * baked-in backgrounds, a uniform expression — that made the previous
 * rendered portrait pool read as machine output.
 *
 * Catalog ORDER IS PART OF THE SAVE FORMAT. `AvatarConfig` stores indices, so
 * appending is safe but reordering or removing an entry silently changes the
 * face of every character already using it. Add to the end.
 */

/** Where the eyes, nose, mouth and ears sit. Shared by every catalog. */
export const ANCHORS = {
  eyeLeft: { x: 78, y: 96 },
  eyeRight: { x: 122, y: 96 },
  noseTop: 100,
  noseBottom: 118,
  noseCenter: 100,
  mouth: { x: 100, y: 132 },
  earLeft: { x: 51, y: 100 },
  earRight: { x: 149, y: 100 },
  headTop: 34,
  headBottom: 155,
  chinCenter: { x: 100, y: 155 },
} as const;

export const VIEWBOX = { width: 200, height: 220 } as const;

export interface FaceShape {
  id: string;
  name: string;
  /** The head silhouette, drawn clockwise from the top of the skull. */
  path: string;
  /** Half-width of the jaw at the mouth line — used to place facial hair. */
  jawHalfWidth: number;
}

/**
 * Head silhouettes. Feminine and masculine faces use the same catalog; the
 * renderer applies a small jaw-width scale by sex rather than doubling every
 * shape, which keeps the pickers honest — a player choosing "square" gets a
 * square jaw whatever sex they picked.
 */
export const FACE_SHAPES: FaceShape[] = [
  {
    id: 'oval',
    name: 'Oval',
    jawHalfWidth: 30,
    path:
      'M100 34 C130 34 152 56 152 88 C152 113 145 133 127 146 ' +
      'C117 153 108 156 100 156 C92 156 83 153 73 146 ' +
      'C55 133 48 113 48 88 C48 56 70 34 100 34 Z',
  },
  {
    id: 'round',
    name: 'Round',
    jawHalfWidth: 33,
    path:
      'M100 34 C133 34 155 58 155 90 C155 116 143 138 122 148 ' +
      'C115 152 107 154 100 154 C93 154 85 152 78 148 ' +
      'C57 138 45 116 45 90 C45 58 67 34 100 34 Z',
  },
  {
    id: 'square',
    name: 'Square',
    jawHalfWidth: 36,
    path:
      'M100 33 C132 33 154 55 154 86 C154 110 153 130 148 141 ' +
      'C144 150 132 156 118 157 C112 157 106 158 100 158 ' +
      'C94 158 88 157 82 157 C68 156 56 150 52 141 ' +
      'C47 130 46 110 46 86 C46 55 68 33 100 33 Z',
  },
  {
    id: 'heart',
    name: 'Heart',
    jawHalfWidth: 25,
    path:
      'M100 33 C133 33 156 56 156 87 C156 110 147 129 130 143 ' +
      'C119 152 109 158 100 158 C91 158 81 152 70 143 ' +
      'C53 129 44 110 44 87 C44 56 67 33 100 33 Z',
  },
  {
    id: 'long',
    name: 'Long',
    jawHalfWidth: 28,
    path:
      'M100 32 C128 32 149 54 149 86 C149 116 143 139 128 151 ' +
      'C118 159 108 162 100 162 C92 162 82 159 72 151 ' +
      'C57 139 51 116 51 86 C51 54 72 32 100 32 Z',
  },
  {
    id: 'diamond',
    name: 'Diamond',
    jawHalfWidth: 24,
    path:
      'M100 34 C124 34 143 52 148 78 C152 96 150 112 140 128 ' +
      'C128 147 112 158 100 158 C88 158 72 147 60 128 ' +
      'C50 112 48 96 52 78 C57 52 76 34 100 34 Z',
  },
];

export interface HairStyle {
  id: string;
  name: string;
  /** Mass drawn BEHIND the head (long hair, volume around the silhouette). */
  back?: string;
  /** Mass drawn OVER the skull. Omit for bald. */
  front?: string;
  /**
   * How much of the forehead this style covers, 0…1. Ageing recession lifts
   * the front mass by this much, so a style that already shows forehead
   * recedes less than a fringe that hides all of it.
   */
  coverage: number;
  /** Suppresses recession — a shaved head cannot recede. */
  noRecede?: boolean;
}

/**
 * Hair. Every style is offered to every sex on purpose: gating styles by sex
 * is the exact uniformity players objected to in the previous pool.
 *
 * ── Shape of a `front` path ───────────────────────────────────────────────
 * Each one traces the OUTER edge of the hair mass first — up the left temple,
 * over the crown, down the right temple — and then returns along the INNER
 * hairline across the forehead. Both ends meet at the temples so the mass
 * tapers to nothing there instead of stopping in a hard line.
 *
 * The outer edge has to reach roughly y 88 at the sides. An earlier pass ended
 * it near the crown, which left bare skin at both temples and made every style
 * read as a small cap sitting on a bald head — the single worst thing in the
 * first render of this catalog. Styles meant to cover the ears run to y 104+;
 * short styles stop around y 86-92 so the ear stays visible below.
 *
 * The hairline itself sits near y 52 at centre, which is where it belongs
 * against brows at y 84: hairline-to-brow, brow-to-nose-base and
 * nose-base-to-chin are each about a third of the face.
 */
export const HAIR_STYLES: HairStyle[] = [
  { id: 'bald', name: 'Bald', coverage: 0, noRecede: true },
  {
    id: 'buzz',
    name: 'Buzz',
    coverage: 0.35,
    noRecede: true,
    front:
      'M48 86 C45 60 63 33 100 33 C137 33 155 60 152 86 ' +
      'C149 77 145 68 139 63 C127 57 114 55 100 55 ' +
      'C86 55 73 57 61 63 C55 68 51 77 48 86 Z',
  },
  {
    id: 'crop',
    name: 'Short crop',
    coverage: 0.6,
    front:
      'M46 92 C42 62 60 28 100 28 C140 28 158 62 154 92 ' +
      'C151 80 147 70 141 64 C129 57 115 55 100 55 ' +
      'C85 55 71 57 59 64 C53 70 49 80 46 92 Z',
  },
  {
    id: 'quiff',
    name: 'Quiff',
    coverage: 0.55,
    front:
      'M46 92 C42 62 54 30 88 22 C110 17 132 26 144 40 ' +
      'C154 52 157 72 154 92 C151 76 147 64 141 58 ' +
      'C129 50 115 48 100 48 C85 48 71 52 59 60 C53 66 49 78 46 92 Z',
  },
  {
    id: 'messy',
    name: 'Messy',
    coverage: 0.7,
    front:
      'M45 94 C39 64 52 30 72 24 C84 20 92 26 100 22 ' +
      'C110 17 118 26 130 26 C150 30 161 64 155 94 ' +
      'C152 78 148 64 142 58 C134 66 126 60 118 54 ' +
      'C110 62 100 58 92 52 C84 60 72 56 62 58 C54 66 48 78 45 94 Z',
  },
  {
    id: 'curls',
    name: 'Short curls',
    coverage: 0.65,
    front:
      'M45 92 C33 76 36 44 58 32 C70 25 86 22 100 22 ' +
      'C114 22 130 25 142 32 C164 44 167 76 155 92 ' +
      'C154 78 148 64 140 58 C132 66 122 62 114 56 ' +
      'C106 64 94 64 86 56 C78 62 68 66 60 58 C52 64 46 78 45 92 Z',
  },
  {
    id: 'afro',
    name: 'Afro',
    coverage: 0.7,
    back: 'M100 14 C146 14 178 46 178 90 C178 116 166 138 148 150 C158 126 160 68 144 44 C130 24 116 18 100 18 C84 18 70 24 56 44 C40 68 42 126 52 150 C34 138 22 116 22 90 C22 46 54 14 100 14 Z',
    front:
      'M44 96 C26 74 32 34 66 20 C77 15 89 13 100 13 ' +
      'C111 13 123 15 134 20 C168 34 174 74 156 96 ' +
      'C153 76 146 62 138 56 C126 49 113 47 100 47 ' +
      'C87 47 74 49 62 56 C54 62 47 76 44 96 Z',
  },
  {
    id: 'bob',
    name: 'Bob',
    coverage: 0.75,
    back: 'M42 88 C42 50 68 26 100 26 C132 26 158 50 158 88 C158 112 156 132 152 150 C145 155 137 155 131 150 C136 130 136 106 134 90 C120 99 80 99 66 90 C64 106 64 130 69 150 C63 155 55 155 48 150 C44 132 42 112 42 88 Z',
    front:
      'M44 112 C40 70 66 26 100 26 C134 26 160 70 156 112 ' +
      'C153 88 148 64 141 57 C129 49 115 47 100 47 ' +
      'C85 47 71 49 59 57 C52 64 47 88 44 112 Z',
  },
  {
    id: 'long',
    name: 'Long straight',
    coverage: 0.7,
    back: 'M40 86 C40 48 68 24 100 24 C132 24 160 48 160 86 C160 122 162 158 158 188 C151 192 143 192 136 188 C140 156 138 116 136 90 C120 100 80 100 64 90 C62 116 60 156 64 188 C57 192 49 192 42 188 C38 158 40 122 40 86 Z',
    front:
      'M43 110 C39 68 66 24 100 24 C134 24 161 68 157 110 ' +
      'C154 86 148 62 141 55 C129 47 115 45 100 45 ' +
      'C85 45 71 47 59 55 C52 62 46 86 43 110 Z',
  },
  {
    id: 'wavy',
    name: 'Long wavy',
    coverage: 0.72,
    back: 'M40 86 C40 48 68 24 100 24 C132 24 160 48 160 86 C162 110 157 130 164 154 C160 172 151 184 140 192 C145 166 136 150 138 130 C138 112 138 100 136 90 C120 100 80 100 64 90 C62 100 62 112 62 130 C64 150 55 166 60 192 C49 184 40 172 36 154 C43 130 38 110 40 86 Z',
    front:
      'M43 108 C39 66 66 24 100 24 C134 24 161 66 157 108 ' +
      'C154 84 147 60 139 54 C130 64 118 68 106 66 ' +
      'C92 63 76 56 62 54 C53 62 46 84 43 108 Z',
  },
  {
    id: 'pixie',
    name: 'Pixie',
    coverage: 0.62,
    front:
      'M46 90 C42 60 62 26 100 26 C138 26 158 60 154 90 ' +
      'C151 74 147 62 140 56 C130 62 122 72 108 68 ' +
      'C96 64 84 54 72 57 C60 61 50 74 46 90 Z',
  },
  {
    id: 'ponytail',
    name: 'Ponytail',
    coverage: 0.66,
    back: 'M44 88 C44 50 68 26 100 26 C132 26 156 50 156 88 C156 96 155 102 154 108 C164 111 174 122 174 136 C174 152 164 164 151 166 C160 157 162 145 157 135 C152 125 144 119 136 117 C136 107 136 98 136 90 C120 99 80 99 66 90 C64 98 64 108 64 117 C56 112 48 104 44 88 Z',
    front:
      'M45 96 C41 64 66 26 100 26 C134 26 159 64 155 96 ' +
      'C152 78 147 62 140 55 C128 47 114 45 100 45 ' +
      'C86 45 72 47 60 55 C53 62 48 78 45 96 Z',
  },
  {
    id: 'bun',
    name: 'Top bun',
    coverage: 0.64,
    back: 'M100 4 C116 4 128 15 128 30 C128 41 121 50 111 54 L89 54 C79 50 72 41 72 30 C72 15 84 4 100 4 Z',
    front:
      'M45 94 C41 64 66 26 100 26 C134 26 159 64 155 94 ' +
      'C152 76 147 60 140 54 C128 46 114 44 100 44 ' +
      'C86 44 72 46 60 54 C53 60 48 76 45 94 Z',
  },
  {
    id: 'braids',
    name: 'Braids',
    coverage: 0.72,
    back: 'M40 88 C40 50 68 24 100 24 C132 24 160 50 160 88 C160 118 160 150 158 180 C151 186 143 186 136 180 C138 150 138 114 136 90 C120 100 80 100 64 90 C62 114 62 150 64 180 C57 186 49 186 42 180 C40 150 40 118 40 88 Z',
    front:
      'M43 106 C39 66 66 24 100 24 C134 24 161 66 157 106 ' +
      'C154 84 148 60 140 54 C132 64 122 60 114 54 ' +
      'C106 64 94 64 86 54 C78 60 68 64 60 54 C52 60 46 84 43 106 Z',
  },
  {
    id: 'undercut',
    name: 'Undercut',
    coverage: 0.5,
    front:
      'M52 86 C48 60 62 28 100 28 C138 28 152 60 148 86 ' +
      'C147 72 145 62 140 56 C129 49 115 47 100 47 ' +
      'C85 47 71 49 60 56 C55 62 53 72 52 86 Z',
  },
  {
    id: 'fade',
    name: 'Taper fade',
    coverage: 0.45,
    noRecede: true,
    front:
      'M48 88 C46 62 64 31 100 31 C136 31 154 62 152 88 ' +
      'C148 76 144 66 138 61 C126 55 113 53 100 53 ' +
      'C87 53 74 55 62 61 C56 66 52 76 48 88 Z',
  },
];

export interface BrowShape {
  id: string;
  name: string;
  /** The LEFT brow. The renderer mirrors it for the right. */
  path: string;
}

export const BROW_SHAPES: BrowShape[] = [
  { id: 'soft', name: 'Soft', path: 'M65 82 C72 77 85 77 91 81 C85 79 72 80 65 85 Z' },
  { id: 'straight', name: 'Straight', path: 'M65 81 C74 79 85 79 91 80 C85 82 72 83 65 85 Z' },
  { id: 'arched', name: 'Arched', path: 'M65 84 C71 75 85 74 92 80 C85 77 72 79 66 87 Z' },
  { id: 'thick', name: 'Thick', path: 'M64 82 C72 75 86 75 92 80 C86 80 72 82 65 88 Z' },
  { id: 'thin', name: 'Thin', path: 'M66 82 C73 78 85 78 90 81 C85 80 73 81 66 84 Z' },
  { id: 'angled', name: 'Angled', path: 'M64 86 C70 77 83 74 92 78 C84 78 72 81 65 89 Z' },
];

export interface EyeShape {
  id: string;
  name: string;
  /** The eye opening for the LEFT eye; mirrored for the right. */
  path: string;
  /** Iris radius. Larger reads younger and softer. */
  iris: number;
  /** How far the upper lid covers the iris, 0…1. */
  lidDrop: number;
}

export const EYE_SHAPES: EyeShape[] = [
  {
    id: 'round',
    name: 'Round',
    iris: 5.1,
    lidDrop: 0.1,
    path: 'M67 96 C67 90 72 87 78 87 C84 87 89 90 89 96 C89 101 84 104 78 104 C72 104 67 101 67 96 Z',
  },
  {
    id: 'almond',
    name: 'Almond',
    iris: 4.8,
    lidDrop: 0.18,
    path: 'M67 97 C70 90 74 88 78 88 C83 88 87 90 90 96 C87 101 83 103 78 103 C73 103 69 100 67 97 Z',
  },
  {
    id: 'wide',
    name: 'Wide',
    iris: 5,
    lidDrop: 0.08,
    path: 'M66 96 C66 90 71 87 78 87 C85 87 90 90 90 96 C90 101 85 104 78 104 C71 104 66 101 66 96 Z',
  },
  {
    id: 'narrow',
    name: 'Narrow',
    iris: 4.5,
    lidDrop: 0.3,
    path: 'M67 97 C70 92 74 90 78 90 C83 90 87 92 90 96 C87 100 83 102 78 102 C73 102 69 100 67 97 Z',
  },
  {
    id: 'upturned',
    name: 'Upturned',
    iris: 4.8,
    lidDrop: 0.2,
    path: 'M67 99 C69 92 74 89 79 89 C84 89 88 91 90 95 C87 100 83 102 77 102 C72 102 68 101 67 99 Z',
  },
  {
    id: 'downturned',
    name: 'Downturned',
    iris: 4.8,
    lidDrop: 0.16,
    path: 'M67 94 C70 89 74 87 79 88 C84 89 88 92 90 98 C86 102 82 103 77 102 C72 101 68 98 67 94 Z',
  },
  {
    id: 'hooded',
    name: 'Hooded',
    iris: 4.6,
    lidDrop: 0.38,
    path: 'M67 98 C70 93 74 91 78 91 C83 91 87 93 90 97 C87 101 83 103 78 103 C73 103 69 101 67 98 Z',
  },
];

export interface NoseShape {
  id: string;
  name: string;
  /** The shaded side plane — this is what gives the nose its depth. */
  shade: string;
  /** The lit ridge/tip highlight. */
  light: string;
  /** The two nostril wings. Without these the nose reads as a smudge. */
  nostrils: string;
}

export const NOSE_SHAPES: NoseShape[] = [
  {
    id: 'button',
    name: 'Button',
    shade: 'M100 101 C104 106 108 112 108 116 C108 120 104 122 100 122 C97 122 94 121 93 119 C97 119 102 118 103 115 C104 111 102 106 100 101 Z',
    light: 'M97 104 C95 109 93 113 94 117 C96 119 98 119 100 118 C97 116 96 111 97 104 Z',
    nostrils: 'M92 117 C93 114 96 113 97 115 C96 118 94 119 92 117 Z M108 117 C107 114 104 113 103 115 C104 118 106 119 108 117 Z',
  },
  {
    id: 'straight',
    name: 'Straight',
    shade: 'M100 99 C103 106 107 113 107 117 C107 121 103 123 99 123 C96 123 93 122 92 120 C97 120 102 119 103 116 C104 112 102 106 100 99 Z',
    light: 'M97 102 C95 108 93 114 94 118 C96 120 98 120 100 119 C97 116 96 110 97 102 Z',
    nostrils: 'M91 118 C92 115 95 114 96 116 C95 119 93 120 91 118 Z M109 118 C108 115 105 114 104 116 C105 119 107 120 109 118 Z',
  },
  {
    id: 'aquiline',
    name: 'Aquiline',
    shade: 'M100 98 C105 104 110 112 109 117 C108 121 104 123 99 123 C96 123 93 122 92 120 C98 120 103 119 104 116 C105 111 102 104 100 98 Z',
    light: 'M97 101 C94 108 92 114 93 118 C95 120 98 120 100 119 C97 116 95 109 97 101 Z',
    nostrils: 'M91 118 C92 115 95 114 96 116 C95 119 93 120 91 118 Z M109 118 C108 115 105 114 104 116 C105 119 107 120 109 118 Z',
  },
  {
    id: 'wide',
    name: 'Wide',
    shade: 'M100 102 C105 107 111 113 111 117 C111 122 105 124 100 124 C95 124 90 122 89 119 C95 120 103 119 105 116 C106 112 103 107 100 102 Z',
    light: 'M96 105 C93 110 91 114 92 118 C95 120 98 120 100 119 C96 116 95 111 96 105 Z',
    nostrils: 'M89 118 C90 114 94 113 96 115 C95 119 92 120 89 118 Z M111 118 C110 114 106 113 104 115 C105 119 108 120 111 118 Z',
  },
  {
    id: 'petite',
    name: 'Petite',
    shade: 'M100 104 C103 108 106 112 106 116 C106 119 103 121 100 121 C98 121 96 120 95 119 C99 119 102 118 103 115 C103 112 102 108 100 104 Z',
    light: 'M98 106 C96 110 95 113 96 116 C97 118 99 118 100 118 C98 116 97 111 98 106 Z',
    nostrils: 'M94 116 C95 114 97 113 98 115 C97 117 95 118 94 116 Z M106 116 C105 114 103 113 102 115 C103 117 105 118 106 116 Z',
  },
  {
    id: 'upturned',
    name: 'Upturned',
    shade: 'M100 102 C104 107 108 112 107 115 C106 119 102 121 99 120 C96 120 94 119 93 117 C97 118 102 117 103 114 C104 111 102 107 100 102 Z',
    light: 'M97 105 C95 109 94 112 95 115 C97 117 99 117 100 116 C97 114 96 110 97 105 Z',
    nostrils: 'M93 115 C94 112 97 111 98 113 C97 116 95 117 93 115 Z M107 115 C106 112 103 111 102 113 C103 116 105 117 107 115 Z',
  },
];

export interface MouthShape {
  id: string;
  name: string;
  /** Upper lip. */
  upper: string;
  /** Lower lip — drawn fuller and catches the light. */
  lower: string;
}

export const MOUTH_SHAPES: MouthShape[] = [
  {
    id: 'neutral',
    name: 'Neutral',
    upper: 'M85 131 C90 127 96 126 100 126 C104 126 110 127 115 131 C110 130 104 130 100 130 C96 130 90 130 85 131 Z',
    lower: 'M85 131 C90 130 96 130 100 130 C104 130 110 130 115 131 C110 137 104 139 100 139 C96 139 90 137 85 131 Z',
  },
  {
    id: 'smile',
    name: 'Smile',
    upper: 'M84 130 C90 126 96 125 100 125 C104 125 110 126 116 130 C110 130 104 130 100 130 C96 130 90 130 84 130 Z',
    lower: 'M84 130 C90 130 96 130 100 130 C104 130 110 130 116 130 C112 139 106 142 100 142 C94 142 88 139 84 130 Z',
  },
  {
    id: 'full',
    name: 'Full',
    upper: 'M84 130 C90 124 96 123 100 123 C104 123 110 124 116 130 C110 129 104 129 100 129 C96 129 90 129 84 130 Z',
    lower: 'M84 130 C90 129 96 129 100 129 C104 129 110 129 116 130 C111 139 105 142 100 142 C95 142 89 139 84 130 Z',
  },
  {
    id: 'thin',
    name: 'Thin',
    upper: 'M86 131 C91 128 96 127 100 127 C104 127 109 128 114 131 C109 130 104 130 100 130 C96 130 91 130 86 131 Z',
    lower: 'M86 131 C91 130 96 130 100 130 C104 130 109 130 114 131 C109 135 104 136 100 136 C96 136 91 135 86 131 Z',
  },
  {
    id: 'smirk',
    name: 'Smirk',
    upper: 'M85 132 C90 128 96 127 101 127 C106 127 111 127 116 129 C110 131 104 131 100 131 C96 131 90 131 85 132 Z',
    lower: 'M85 132 C90 131 96 131 100 131 C104 131 110 131 116 129 C113 137 106 140 100 139 C95 139 89 137 85 132 Z',
  },
  {
    id: 'serious',
    name: 'Serious',
    upper: 'M85 132 C90 129 96 128 100 128 C104 128 110 129 115 132 C110 131 104 131 100 131 C96 131 90 131 85 132 Z',
    lower: 'M85 132 C90 131 96 131 100 131 C104 131 110 131 115 132 C111 136 105 137 100 137 C95 137 89 136 85 132 Z',
  },
];

export interface FacialHair {
  id: string;
  name: string;
  path: string;
  /**
   * Fill opacity. Stubble is the SAME region as a full beard drawn faintly —
   * that is what stubble physically is, and it reads far better than the thin
   * outline shape used at first, which rendered as a dirty smear on the chin.
   */
  opacity: number;
}

/** Index 0 is clean-shaven and has no geometry. */
export const FACIAL_HAIR: FacialHair[] = [
  { id: 'none', name: 'Clean', path: '', opacity: 0 },
  { id: 'stubble', name: 'Stubble', opacity: 0.34, path: 'M60 98 C62 132 76 158 100 165 C124 158 138 132 140 98 C138 116 128 124 112 126 C108 122 104 120 100 120 C96 120 92 122 88 126 C72 124 62 116 60 98 Z' },
  { id: 'moustache', name: 'Moustache', opacity: 0.95, path: 'M84 124 C90 118 96 117 100 117 C104 117 110 118 116 124 C110 127 105 128 100 128 C95 128 90 127 84 124 Z' },
  { id: 'goatee', name: 'Goatee', opacity: 0.95, path: 'M86 134 C90 140 95 142 100 142 C105 142 110 140 114 134 C118 148 112 160 100 164 C88 160 82 148 86 134 Z' },
  { id: 'circle', name: 'Circle beard', opacity: 0.95, path: 'M84 124 C90 118 96 117 100 117 C104 117 110 118 116 124 C110 127 105 128 100 128 C95 128 90 127 84 124 Z M86 134 C90 140 95 142 100 142 C105 142 110 140 114 134 C118 148 112 160 100 164 C88 160 82 148 86 134 Z' },
  { id: 'full', name: 'Full beard', opacity: 0.95, path: 'M60 98 C62 132 76 158 100 165 C124 158 138 132 140 98 C138 116 128 124 112 126 C108 122 104 120 100 120 C96 120 92 122 88 126 C72 124 62 116 60 98 Z M84 124 C90 118 96 117 100 117 C104 117 110 118 116 124 C110 127 105 128 100 128 C95 128 90 127 84 124 Z' },
  { id: 'chinstrap', name: 'Chin strap', opacity: 0.95, path: 'M60 98 C62 132 76 158 100 165 C124 158 138 132 140 98 C138 112 132 120 126 124 C122 140 112 152 100 156 C88 152 78 140 74 124 C68 120 62 112 60 98 Z' },
];

export interface Accessory {
  id: string;
  name: string;
  /** Frame outline, stroked rather than filled. */
  path: string;
  /** Lens fill, drawn under the frame at low opacity. */
  lens?: string;
}

/** Index 0 is none. */
export const ACCESSORIES: Accessory[] = [
  { id: 'none', name: 'None', path: '' },
  {
    id: 'round',
    name: 'Round glasses',
    path:
      'M62 96 A14 14 0 1 0 90 96 A14 14 0 1 0 62 96 Z ' +
      'M110 96 A14 14 0 1 0 138 96 A14 14 0 1 0 110 96 Z ' +
      'M90 94 L110 94 M62 94 L48 92 M138 94 L152 92',
    lens: 'M62 96 A14 14 0 1 0 90 96 A14 14 0 1 0 62 96 Z M110 96 A14 14 0 1 0 138 96 A14 14 0 1 0 110 96 Z',
  },
  {
    id: 'square',
    name: 'Square glasses',
    path:
      'M60 87 L91 87 L91 106 L60 106 Z ' +
      'M109 87 L140 87 L140 106 L109 106 Z ' +
      'M91 93 L109 93 M60 90 L47 89 M140 90 L153 89',
    lens: 'M60 87 L91 87 L91 106 L60 106 Z M109 87 L140 87 L140 106 L109 106 Z',
  },
  {
    id: 'reading',
    name: 'Readers',
    path:
      'M62 98 L90 98 L88 108 L64 108 Z ' +
      'M110 98 L138 98 L136 108 L112 108 Z ' +
      'M90 100 L110 100 M62 99 L48 96 M138 99 L152 96',
    lens: 'M62 98 L90 98 L88 108 L64 108 Z M110 98 L138 98 L136 108 L112 108 Z',
  },
  {
    id: 'aviator',
    name: 'Aviators',
    path:
      'M59 90 L92 90 L86 108 L67 108 Z ' +
      'M108 90 L141 90 L133 108 L114 108 Z ' +
      'M92 93 L108 93 M59 91 L47 89 M141 91 L153 89',
    lens: 'M59 90 L92 90 L86 108 L67 108 Z M108 90 L141 90 L133 108 L114 108 Z',
  },
];

/** Every catalog, so callers can size a picker without importing each one. */
export const CATALOG_SIZES = {
  faceShape: FACE_SHAPES.length,
  hairStyle: HAIR_STYLES.length,
  browShape: BROW_SHAPES.length,
  eyeShape: EYE_SHAPES.length,
  noseShape: NOSE_SHAPES.length,
  mouthShape: MOUTH_SHAPES.length,
  facialHair: FACIAL_HAIR.length,
  accessory: ACCESSORIES.length,
} as const;
