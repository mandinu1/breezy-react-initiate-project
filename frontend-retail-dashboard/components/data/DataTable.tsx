import React from 'react';

interface ColumnDefinition {
  Header: string;
  // The accessor can be a string key of the data object, or a function that receives the row and returns a value.
  accessor: string | ((row: any) => React.ReactNode);
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
    <div className="overflow-x-auto rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index} // Use index for key as accessor can be a function
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
              {columns.map((column, colIndex) => {
                // CORRECTED LOGIC: Check if the accessor is a function or a string.
                const cellData = typeof column.accessor === 'function'
                    ? column.accessor(row)
                    : row[column.accessor as keyof typeof row];

                return (
                  <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                    {cellData !== undefined && cellData !== null ? String(cellData) : ' - '}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;