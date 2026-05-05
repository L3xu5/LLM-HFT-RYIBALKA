import { fireEvent, render, screen } from '@testing-library/react-native';

import { TextField } from '@/components/TextField';

describe('TextField', () => {
  it('отображает ошибку', () => {
    const onChange = jest.fn();
    render(<TextField label="Email" value="" onChangeText={onChange} error="Ошибка поля" />);
    expect(screen.getByText('Ошибка поля')).toBeTruthy();
  });

  it('вызывает onChangeText', () => {
    const onChange = jest.fn();
    render(<TextField testID="tf" label="Поле" value="" onChangeText={onChange} />);
    fireEvent.changeText(screen.getByTestId('tf'), 'hello');
    expect(onChange).toHaveBeenCalledWith('hello');
  });
});
