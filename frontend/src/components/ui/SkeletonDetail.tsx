import React from 'react';

export default function SkeletonDetail() {
  return (
    <div style={{ padding: 24, display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      <div style={{ height: 24, width: 260, background: '#F3F4F6', borderRadius: 6 }} />
      <div style={{ height: 320, background: '#F3F4F6', borderRadius: 10 }} />
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ height: 16, width: 180, background: '#F3F4F6', borderRadius: 6 }} />
        <div style={{ height: 12, width: 240, background: '#F3F4F6', borderRadius: 6 }} />
      </div>
      <div>
        <div style={{ height: 16, width: 140, background: '#F3F4F6', borderRadius: 6, marginBottom: 8 }} />
        <div style={{ height: 48, background: '#F3F4F6', borderRadius: 8 }} />
      </div>
    </div>
  );
}

