import React from 'react';

// Simple table, for more complex needs consider react-table or similar

interface ColumnDefinition {
  Header: string;
  accessor: string; // Key in data objects
}

interface DataTableProps {
  columns: ColumnDefinition[];
  data: any[];
}

const DataTable: React.FC<DataTableProps> = ({ columns, data }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 p-4 text-center">No data available.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {columns.map(column => (
              <th
                key={column.accessor}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
              >
                {column.Header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
              {columns.map(column => (
                <td key={column.accessor} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                  {row[column.accessor] !== undefined && row[column.accessor] !== null ? String(row[column.accessor]) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;