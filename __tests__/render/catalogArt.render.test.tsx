import React from 'react';
import { act } from 'react-test-renderer';
import CatalogArt from '@/components/ui/CatalogArt';
import { renderWithProviders } from './helpers/renderWithProviders';

it('falls back after an image failure and for an unknown saved breed', () => {
  const result = renderWithProviders(<CatalogArt family="pets" id="dog" />);
  const images = () => result.renderer.root.findAll(node => typeof node.props.onError === 'function');
  expect(images().length).toBeGreaterThan(0);
  act(() => images()[0].props.onError());
  expect(images()).toHaveLength(0);
  result.unmount();
  const unknown = renderWithProviders(<CatalogArt family="pets" id="unknown-old-breed" />);
  expect(unknown.renderer.root.findAll(node => typeof node.props.onError === 'function')).toHaveLength(0);
  unknown.unmount();
});
