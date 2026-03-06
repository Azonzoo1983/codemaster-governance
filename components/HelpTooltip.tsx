import React, { useState, useRef, useId } from 'react';

interface HelpTooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ text, position = 'top' }) => {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(true);
  };

  const hide = () => {
    timeoutRef.current = setTimeout(() => setVisible(false), 150);
  };

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 dark:border-t-slate-600 border-l-transparent border-r-transparent border-b-transparent border-[5px]',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 dark:border-b-slate-600 border-l-transparent border-r-transparent border-t-transparent border-[5px]',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 dark:border-l-slate-600 border-t-transparent border-b-transparent border-r-transparent border-[5px]',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 dark:border-r-slate-600 border-t-transparent border-b-transparent border-l-transparent border-[5px]',
  };

  return (
    <span
      className="relative inline-flex items-center ml-1.5"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold leading-none flex items-center justify-center hover:bg-blue-400 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-1 dark:focus:ring-offset-slate-800"
        aria-describedby={tooltipId}
        tabIndex={0}
        aria-label="Help information"
      >
        i
      </button>
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`absolute z-50 ${positionClasses[position]} pointer-events-none animate-tooltip-fade-in`}
        >
          <span className="block max-w-[250px] px-3 py-2 rounded-lg bg-slate-800 dark:bg-slate-600 text-white text-xs leading-relaxed shadow-lg">
            {text}
          </span>
          <span className={`absolute w-0 h-0 ${arrowClasses[position]}`} />
        </span>
      )}
    </span>
  );
};
