import { fireEvent, render, screen } from '@testing-library/react-native';

import { RedRecommendButton } from '@/components/RedRecommendButton';

describe('RedRecommendButton', () => {
  it('вызывает onPress', () => {
    const fn = jest.fn();
    render(<RedRecommendButton onPress={fn} />);
    fireEvent.press(screen.getByRole('button'));
    expect(fn).toHaveBeenCalled();
  });

  it('disabled при loading', () => {
    const fn = jest.fn();
    render(<RedRecommendButton onPress={fn} loading />);
    fireEvent.press(screen.getByRole('button'));
    expect(fn).not.toHaveBeenCalled();
  });
});
