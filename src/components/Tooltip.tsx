import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: ReactNode;
  children?: ReactNode;
  iconSize?: number;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, iconSize = 14, className = '', position = 'top' }: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-700 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-700 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-700 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-700 border-t-transparent border-b-transparent border-l-transparent',
  };

  return (
    <div className={`relative inline-flex items-center group cursor-help ${className}`}>
      {children || <HelpCircle size={iconSize} className="text-slate-400 group-hover:text-blue-400 transition-colors" />}
      
      <div className={`absolute ${positionClasses[position]} w-max max-w-xs p-2.5 bg-slate-700 text-slate-100 text-xs font-normal leading-relaxed rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none text-left`}>
        <div className="whitespace-pre-wrap">{content}</div>
        <div className={`absolute border-[6px] ${arrowClasses[position]}`}></div>
      </div>
    </div>
  );
}
