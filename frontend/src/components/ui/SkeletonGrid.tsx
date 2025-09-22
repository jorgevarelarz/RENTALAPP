import React from 'react';

export default function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="aspect-video bg-gray-100 animate-pulse" />
          <div className="p-3 space-y-2">
            <div className="h-6 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
            <div className="h-8 bg-gray-100 rounded animate-pulse w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

