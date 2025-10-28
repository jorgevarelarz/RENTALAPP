import React from 'react';

type Column<T> = {
  header: string;
  accessor: keyof T;
};

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
}

function DataTable<T extends Record<string, any>>({ columns, data }: DataTableProps<T>) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12 }}>
      <thead>
        <tr>
          {columns.map(column => (
            <th key={String(column.accessor)} style={thStyle}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, index) => (
          <tr key={index} style={{ borderTop: '1px solid #f1f5f9' }}>
            {columns.map(column => (
              <td key={String(column.accessor)} style={tdStyle}>{String(row[column.accessor] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 12,
  textTransform: 'uppercase',
  color: '#94a3b8',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 14,
  color: '#0f172a',
};

export default DataTable;
