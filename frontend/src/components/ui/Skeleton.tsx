import React from 'react';

export const Skeleton: React.FC<{ w?: number|string; h?: number|string; br?: number }>= ({ w='100%', h=16, br=8 }) => (
  <div style={{ width: w, height: h, borderRadius: br, background: 'linear-gradient(90deg, var(--border) 25%, #e5e7eb33 37%, var(--border) 63%)', backgroundSize: '400% 100%', animation: 'sk 1.4s ease infinite' }} />
);

export const SkeletonCard: React.FC = () => (
  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
    <Skeleton h={140} br={0} />
    <div style={{ padding: 12, display: 'grid', gap: 8 }}>
      <Skeleton w={180} />
      <Skeleton w={'60%'} />
      <Skeleton w={80} />
    </div>
    <style>{`@keyframes sk{0%{background-position:0% 0}100%{background-position:-135% 0}}`}</style>
  </div>
);

export default Skeleton;

