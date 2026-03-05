import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: {
    wrapper: 'py-8 px-4',
    iconContainer: 'w-16 h-16',
    title: 'text-sm font-semibold',
    description: 'text-xs mt-1',
    button: 'mt-3 px-4 py-1.5 text-xs',
    secondary: 'mt-2 text-xs',
  },
  md: {
    wrapper: 'py-12 px-6',
    iconContainer: 'w-20 h-20',
    title: 'text-base font-semibold',
    description: 'text-sm mt-1.5',
    button: 'mt-4 px-5 py-2 text-sm',
    secondary: 'mt-2.5 text-sm',
  },
  lg: {
    wrapper: 'py-20 px-8',
    iconContainer: 'w-24 h-24',
    title: 'text-lg font-semibold',
    description: 'text-sm mt-2',
    button: 'mt-5 px-6 py-2.5 text-sm',
    secondary: 'mt-3 text-sm',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  size = 'md',
}) => {
  const styles = sizeStyles[size];

  return (
    <div
      className={`${styles.wrapper} text-center animate-fadeIn`}
      role="status"
    >
      <div className="flex flex-col items-center">
        {/* Decorative background circle behind icon */}
        <div
          className={`${styles.iconContainer} rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mb-4`}
        >
          <div className="text-slate-400 dark:text-slate-500">{icon}</div>
        </div>

        <p className={`${styles.title} text-slate-600 dark:text-slate-300`}>
          {title}
        </p>
        <p className={`${styles.description} text-slate-400 dark:text-slate-500 max-w-sm mx-auto`}>
          {description}
        </p>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className={`${styles.button} btn-primary text-white rounded-lg font-medium shadow-sm transition`}
          >
            {actionLabel}
          </button>
        )}

        {secondaryActionLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className={`${styles.secondary} text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition`}
          >
            {secondaryActionLabel}
          </button>
        )}
      </div>
    </div>
  );
};
