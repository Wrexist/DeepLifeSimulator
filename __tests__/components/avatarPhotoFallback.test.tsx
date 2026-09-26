import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Image } from 'react-native';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import { PORTRAIT_ASSETS } from '@/components/avatar/portraitAssets';
import type { AvatarSource } from '@/lib/avatar/resolve';

it('keeps stored portrait identity when an uploaded photo fails, and retries a replacement URI', () => {
  const source: AvatarSource = { name: 'Tyler', avatarId: 'portrait-v1:ember', sex: 'male' };
  let renderer!: TestRenderer.ReactTestRenderer;
  const props = { uri: 'https://example.invalid/old.jpg', face: { source, seed: 'Tyler', size: 34 } };
  act(() => { renderer = TestRenderer.create(<ImageWithFallback {...props} />); });
  expect(renderer.root.findByType(Image).props.source.uri).toBeDefined();
  act(() => renderer.root.findByType(Image).props.onError());
  expect(renderer.root.findByType(Image).props.source).toBe(PORTRAIT_ASSETS['portrait-v1:ember']);
  act(() => renderer.update(<ImageWithFallback {...props} uri="https://example.invalid/new.jpg" />));
  expect(renderer.root.findByType(Image).props.source.uri).toBeDefined();
  expect(renderer.root.findByType(Image).props.source.uri).toContain('new.jpg');
  act(() => renderer.unmount());
});
