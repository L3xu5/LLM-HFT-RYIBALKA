import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { View } from 'react-native';

const mockPush = jest.fn();
const mockRequestRecommendation = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [] }),
}));

jest.mock('@/lib/api/catches', () => ({
  fetchCatches: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 55.75, longitude: 37.61 },
  }),
  Accuracy: { Balanced: 2 },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/lib/api/recommend', () => ({
  requestRecommendation: (...args: unknown[]) => mockRequestRecommendation(...args),
}));

jest.mock('@/components/YandexMap', () => {
  const ReactLocal = require('react');
  const { View: ViewLocal } = require('react-native');
  return {
    YandexMap: ReactLocal.forwardRef((props: { onReady?: () => void }, ref: React.Ref<unknown>) => {
      ReactLocal.useImperativeHandle(ref, () => ({
        getViewport: async () => ({ lat: 55.75, lng: 37.61, zoom: 11, widthPx: 1200, heightPx: 900 }),
        adjustZoom: () => {},
        setCamera: () => {},
      }));
      ReactLocal.useEffect(() => {
        props.onReady?.();
      }, [props]);
      return <ViewLocal testID="mock-map" />;
    }),
  };
});

import MapScreen from '../app/(tabs)/map';

describe('Map recommendation integration', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockRequestRecommendation.mockReset();
  });

  it('opens recommendation modal with sources and evidence', async () => {
    mockRequestRecommendation.mockResolvedValueOnce({
      lat: 55.8,
      lng: 37.7,
      reason: 'Try near the river bend with moderate current.',
      sources: ['yandex', 'overpass'],
      nearby_evidence: ['river segment nearby', 'recent cod catches', 'matching bait trend'],
      suggested_bait: 'worm',
      suggested_species: 'cod',
    });

    render(<MapScreen />);

    fireEvent.press(screen.getByText('Where to go?'));

    await waitFor(() => {
      expect(screen.getByText('Sources: yandex, overpass')).toBeTruthy();
    });
    expect(screen.getByText(/Evidence:/)).toBeTruthy();
    expect(screen.getByText('Bait: worm')).toBeTruthy();
    expect(screen.getByText('Fish: cod')).toBeTruthy();
    expect(mockRequestRecommendation).toHaveBeenCalled();
  });
});
