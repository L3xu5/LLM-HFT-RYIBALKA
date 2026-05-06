import { fireEvent, render, screen } from '@testing-library/react-native';

import { TextField } from '@/components/TextField';

describe('TextField', () => {
  it('renders error text', () => {
    const onChange = jest.fn();
    render(<TextField label="Email" value="" onChangeText={onChange} error="Field error" />);
    expect(screen.getByText('Field error')).toBeTruthy();
  });

  it('calls onChangeText', () => {
    const onChange = jest.fn();
    render(<TextField testID="tf" label="Field" value="" onChangeText={onChange} />);
    fireEvent.changeText(screen.getByTestId('tf'), 'hello');
    expect(onChange).toHaveBeenCalledWith('hello');
  });
});
