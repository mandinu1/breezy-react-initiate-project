import React from 'react';

interface ErrorMessageProps {
  message: string;
  title?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, title = "Error" }) => {
  return (
    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md dark:bg-red-900 dark:border-red-700 dark:text-red-200" role="alert">
      <p className="font-bold">{title}</p>
      <p>{message}</p>
    </div>
  );
};

export default ErrorMessage;