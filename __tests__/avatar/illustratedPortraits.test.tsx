import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import CharacterAvatar from '@/components/avatar/CharacterAvatar';
import VectorAvatar from '@/components/avatar/VectorAvatar';
import { PORTRAITS } from '@/lib/avatar/portraits';
import { PORTRAIT_PRESETS } from '@/lib/avatar/portraitPresets';
import { avatarFromSeed, normalizeAvatar } from '@/lib/avatar/random';
import { encodeAvatar } from '@/lib/avatar/encode';
import { resolveAvatar } from '@/lib/avatar/resolve';
import { resolveChildAvatar } from '@/lib/avatar/family';

jest.mock('@/components/avatar/VectorAvatar', () => ({ __esModule: true, default: () => null }));

test.each(PORTRAITS)('$name renders the same curated face at every age without changing stored DNA', ({ id }) => {
  const dna = avatarFromSeed('saved identity', 'female');
  const source = { avatarId: id, avatar: encodeAvatar(dna), sex: 'female' };
  const before = JSON.stringify(source);
  let tree!: TestRenderer.ReactTestRenderer;
  for (const age of [6, 25, 75]) {
    act(() => { tree = TestRenderer.create(<CharacterAvatar source={source} age={age} />); });
    const props = tree.root.findByType(VectorAvatar).props;
    expect(props.config).toEqual(PORTRAIT_PRESETS[id]);
    expect(props.age).toBe(age);
    expect(normalizeAvatar(props.config)).toEqual(props.config);
    act(() => tree.unmount());
  }
  expect(resolveAvatar(source)).toEqual(dna);
  expect(JSON.stringify(source)).toBe(before);
});

test('portrait selection does not replace existing inherited features', () => {
  const mother = { avatar: encodeAvatar(avatarFromSeed('mother', 'female')), sex: 'female' };
  const father = { avatar: encodeAvatar(avatarFromSeed('father', 'male')), sex: 'male' };
  const before = resolveChildAvatar('child-id', 'female', { mother, father });
  for (const { id } of PORTRAITS) {
    expect(resolveChildAvatar('child-id', 'female', { mother: { ...mother, avatarId: id }, father })).toEqual(before);
  }
});

test('all six presets have distinct valid feature combinations', () => {
  expect(new Set(Object.values(PORTRAIT_PRESETS).map(config => JSON.stringify(config))).size).toBe(6);
});
