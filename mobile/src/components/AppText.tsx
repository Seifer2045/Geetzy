import { Text, type TextProps } from 'react-native';
import { colors, typography, type ColorToken, type TypographyVariant } from '@/theme';

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

export const AppText = ({ variant = 'body', color = 'text', align, style, ...rest }: Props) => (
  <Text
    {...rest}
    style={[typography[variant], { color: colors[color] }, align ? { textAlign: align } : null, style]}
  />
);
