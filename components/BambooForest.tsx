import React from 'react';

const stalks = [
  { id: 1, left: -1, width: 18, height: 115, lean: -2, opacity: 0.8, shade: '#66c68f' },
  { id: 2, left: 6, width: 24, height: 112, lean: 2, opacity: 0.72, shade: '#4fad7a' },
  { id: 3, left: 12, width: 16, height: 118, lean: -3, opacity: 0.76, shade: '#7edba3' },
  { id: 4, left: 24, width: 14, height: 105, lean: 5, opacity: 0.46, shade: '#8ce0b0' },
  { id: 5, left: 36, width: 18, height: 116, lean: -1, opacity: 0.36, shade: '#76c79b' },
  { id: 6, left: 50, width: 16, height: 108, lean: 2, opacity: 0.24, shade: '#93d8b3' },
  { id: 7, left: 63, width: 17, height: 116, lean: 4, opacity: 0.48, shade: '#75d69d' },
  { id: 8, left: 76, width: 24, height: 114, lean: -3, opacity: 0.76, shade: '#52b779' },
  { id: 9, left: 85, width: 17, height: 120, lean: 2, opacity: 0.66, shade: '#79d59d' },
  { id: 10, left: 94, width: 20, height: 113, lean: -2, opacity: 0.72, shade: '#497f6e' },
  { id: 11, left: 102, width: 16, height: 118, lean: 3, opacity: 0.48, shade: '#71ca96' },
];

const leafClusters = [
  { top: 13, side: 'right', angle: -14 },
  { top: 21, side: 'left', angle: 18 },
  { top: 35, side: 'right', angle: 10 },
  { top: 50, side: 'left', angle: -10 },
  { top: 67, side: 'right', angle: -18 },
] as const;

export const BambooForest: React.FC = () => {
  return (
    <div className="bamboo-forest" aria-hidden="true">
      {stalks.map((stalk) => (
        <div
          key={stalk.id}
          className="bamboo-stalk"
          style={{
            left: `${stalk.left}vw`,
            width: `${stalk.width}px`,
            height: `${stalk.height}vh`,
            opacity: stalk.opacity,
            '--bamboo-lean': `${stalk.lean}deg`,
            '--bamboo-color': stalk.shade,
          } as React.CSSProperties}
        >
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} className="bamboo-node" style={{ top: `${8 + index * 10.5}%` }} />
          ))}
          {leafClusters.map((cluster, index) => (
            <span
              key={`${cluster.top}-${cluster.side}`}
              className={`bamboo-leaf-cluster bamboo-leaf-cluster--${cluster.side}`}
              style={{
                top: `${cluster.top + ((stalk.id + index) % 3) * 2}%`,
                '--leaf-angle': `${cluster.angle + (stalk.id % 4) * 4}deg`,
              } as React.CSSProperties}
            >
              <span className="bamboo-leaf bamboo-leaf--one" />
              <span className="bamboo-leaf bamboo-leaf--two" />
              <span className="bamboo-leaf bamboo-leaf--three" />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
