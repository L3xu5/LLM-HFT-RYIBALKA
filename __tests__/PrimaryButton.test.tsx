import { fireEvent, render, screen } from '@testing-library/react-native';

import { PrimaryButton } from '@/components/PrimaryButton';

describe('PrimaryButton', () => {
  it('вызывает onPress при нажатии', () => {
    const onPress = jest.fn();
    render(<PrimaryButton title="OK" onPress={onPress} />);
    fireEvent.press(screen.getByText('OK'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('не вызывает onPress в состоянии loading', () => {
    const onPress = jest.fn();
    render(<PrimaryButton title="Загрузка" loading onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
