import type { Config } from 'tailwindcss';

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        panel: token('panel'),
        'panel-2': token('panel-2'),
        border: token('panel-border'),
        text: token('text'),
        muted: token('text-muted'),
        mars: token('mars'),
        moon: token('moon'),
        o2: token('o2'),
        water: token('water'),
        food: token('food'),
        power: token('power'),
        radiation: token('radiation'),
        science: token('science'),
        ok: token('ok'),
        warn: token('warn'),
        danger: token('danger'),
        info: token('info'),
        accent: token('accent'),
        'on-accent': token('on-accent'),
        'input-border': token('input-border'),
        scrim: token('scrim'),
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
