/** AstroBase Component: Button & ButtonLink — Accessible button primitives with variant styling. */
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cx } from '../format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-[var(--hover-brightness)] font-semibold',
  secondary: 'border border-border bg-panel-2 text-text hover:border-muted',
  ghost: 'text-muted hover:bg-panel-2 hover:text-text',
  danger: 'border border-danger/60 bg-danger/15 text-text hover:bg-danger/25',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-[36px] px-3 text-sm',
  md: 'min-h-[44px] px-4 text-sm',
  lg: 'min-h-[52px] px-6 text-base',
};

function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra?: string) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg transition-colors no-underline hover:no-underline',
    'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100',
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  pressed?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', pressed, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      className={buttonClass(variant, size, cx(pressed && 'ring-2 ring-accent', className))}
      {...rest}
    />
  );
});

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant = 'secondary', size = 'md', className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
