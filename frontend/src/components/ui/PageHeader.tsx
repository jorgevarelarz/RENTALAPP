import React from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  cta?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, cta }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {cta && <div className="flex items-center gap-2">{cta}</div>}
    </div>
  );
}
