
import React, { useMemo } from 'react';
import { AppLanguage } from '../types';

const speechLetters: Record<AppLanguage, string[]> = {
  ru: ['Р', 'Л', 'С', 'З', 'Ш', 'Ж', 'Ч', 'Щ', 'Ц'],
  uk: ['Р', 'Л', 'С', 'З', 'Ш', 'Ж', 'Ч', 'Щ', 'Ц'],
};
const balloonColors = ['#60A5FA', '#F472B6', '#FBBF24', '#34D399', '#FB7185', '#A78BFA'];
const pandaFloatSeeds = [
  { left: 6, duration: 28, delay: -8, drift: 34, sway: 16, tilt: 7, scale: 0.9 },
  { left: 18, duration: 34, delay: -22, drift: -42, sway: 22, tilt: 9, scale: 1.02 },
  { left: 31, duration: 30, delay: -13, drift: 48, sway: 18, tilt: 6, scale: 0.84 },
  { left: 49, duration: 38, delay: -28, drift: -30, sway: 24, tilt: 8, scale: 1.12 },
  { left: 68, duration: 32, delay: -18, drift: 44, sway: 20, tilt: 7, scale: 0.96 },
  { left: 86, duration: 36, delay: -6, drift: -54, sway: 26, tilt: 9, scale: 1.08 },
];
const letterFloatSeeds = [
  { left: 11, duration: 27, delay: -16, drift: -28, sway: 18, tilt: 10, scale: 0.74 },
  { left: 24, duration: 34, delay: -5, drift: 38, sway: 26, tilt: 7, scale: 0.86 },
  { left: 39, duration: 30, delay: -20, drift: -46, sway: 22, tilt: 9, scale: 0.8 },
  { left: 56, duration: 37, delay: -11, drift: 32, sway: 24, tilt: 6, scale: 0.92 },
  { left: 73, duration: 32, delay: -24, drift: -36, sway: 20, tilt: 8, scale: 0.78 },
  { left: 91, duration: 36, delay: -15, drift: 42, sway: 28, tilt: 10, scale: 0.88 },
  { left: 3, duration: 40, delay: -29, drift: 26, sway: 18, tilt: 7, scale: 0.72 },
  { left: 80, duration: 29, delay: -3, drift: -30, sway: 22, tilt: 9, scale: 0.82 },
];

interface PandaBalloonsProps {
  language?: AppLanguage;
}

export const PandaBalloons: React.FC<PandaBalloonsProps> = ({ language = 'ru' }) => {
  const balloons = useMemo(() => {
    const lettersForLanguage = speechLetters[language];
    const pandas = pandaFloatSeeds.map((seed, i) => ({
      id: i,
      type: 'panda' as const,
      left: `${seed.left}%`,
      drift: `${seed.drift}px`,
      sway: `${seed.sway}px`,
      tilt: `${seed.tilt}deg`,
      scale: seed.scale,
      duration: `${seed.duration}s`,
      delay: `${seed.delay}s`,
    }));

    const letters = letterFloatSeeds.map((seed, i) => ({
      id: i + pandas.length,
      type: 'letter' as const,
      letter: lettersForLanguage[i % lettersForLanguage.length],
      color: balloonColors[i % balloonColors.length],
      left: `${seed.left}%`,
      drift: `${seed.drift}px`,
      sway: `${seed.sway}px`,
      tilt: `${seed.tilt}deg`,
      scale: seed.scale,
      duration: `${seed.duration}s`,
      delay: `${seed.delay}s`,
    }));

    return [...pandas, ...letters];
  }, [language]);

  return (
    <>
      {balloons.map((b) => (
        <div
          key={b.id}
          className="panda-balloon"
          style={{
            left: b.left,
            animationDuration: b.duration,
            animationDelay: b.delay,
            '--float-drift': b.drift,
            '--float-sway': b.sway,
            '--float-tilt': b.tilt,
            '--float-scale': b.scale,
            '--string-tilt': b.tilt,
          } as React.CSSProperties}
        >
          {b.type === 'panda' ? (
            <span className="panda-float-icon" aria-hidden="true">
              <span className="panda-float-icon__face" />
            </span>
          ) : (
            <span
              className="letter-balloon"
              style={{
                background: b.color,
              }}
            >
              <span className="letter-balloon__glyph">{b.letter}</span>
              <span className="letter-balloon__string" aria-hidden="true" />
            </span>
          )}
        </div>
      ))}
    </>
  );
};
