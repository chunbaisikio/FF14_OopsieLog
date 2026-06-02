import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
  value: { start: string | null; end: string | null };
  onChange: (range: { start: string | null; end: string | null }) => void;
  availableDates: string[]; // ['2023-10-01', ...]
}

export default function DateRangePicker({ value: dateRange, onChange, availableDates: activeDates }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (dateRange.end) return new Date(dateRange.end);
    if (activeDates.length > 0) return new Date(activeDates[activeDates.length - 1]);
    return new Date();
  });

  const activeDatesSet = useMemo(() => new Set(activeDates), [activeDates]);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const handleDateClick = (dayStr: string) => {
    if (!dateRange.start || (dateRange.start && dateRange.end)) {
      // Start new range
      onChange({ start: dayStr, end: null });
    } else {
      // Pick end date
      if (dayStr < dateRange.start) {
        onChange({ start: dayStr, end: dateRange.start });
      } else {
        onChange({ start: dateRange.start, end: dayStr });
      }
    }
  };

  const getDayClass = (dayStr: string) => {
    const isStart = dateRange.start === dayStr;
    const isEnd = dateRange.end === dayStr;
    const isInRange = dateRange.start && dateRange.end && dayStr > dateRange.start && dayStr < dateRange.end;
    const hasRecord = activeDatesSet.has(dayStr);
    
    let cls = "relative w-full aspect-square flex flex-col items-center justify-center text-sm rounded transition-colors ";
    
    if (isStart || isEnd) {
      cls += "bg-blue-600 text-white font-bold z-10 ";
    } else if (isInRange) {
      cls += "bg-blue-900/40 text-blue-100 ";
    } else {
      cls += "text-slate-300 hover:bg-slate-700 cursor-pointer ";
    }

    if (!isStart && !isEnd && hasRecord) {
      cls += "font-semibold text-emerald-400 ";
    }

    return cls;
  };

  const renderDays = () => {
    const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => <div key={`blank-${i}`} />);
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasRecord = activeDatesSet.has(dateStr);

      return (
        <button
          key={dateStr}
          onClick={() => handleDateClick(dateStr)}
          className={getDayClass(dateStr)}
        >
          <span>{d}</span>
          {hasRecord && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500"></div>}
        </button>
      );
    });

    return [...blanks, ...days];
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`text-sm px-3 py-1 rounded transition-colors border ${
          dateRange.start 
            ? 'bg-blue-900/50 text-blue-400 border-blue-500/50' 
            : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
        }`}
      >
        {dateRange.start ? `${dateRange.start} ~ ${dateRange.end || dateRange.start}` : '选择日期范围...'}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-xl w-80 shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-slate-900/80 p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-white text-sm">选择日期范围</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
        
        <div className="p-4">
          <div className="flex justify-between items-center mb-4 text-slate-200">
            <button onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded"><ChevronLeft size={20} /></button>
            <span className="font-medium text-sm">{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</span>
            <button onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded"><ChevronRight size={20} /></button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2">
            <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {renderDays()}
          </div>
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-between items-center">
          <div className="text-xs text-slate-400">
            {dateRange.start ? `${dateRange.start}` : '开始'} ~ {dateRange.end ? `${dateRange.end}` : '结束'}
          </div>
          <button 
            onClick={() => onChange({ start: null, end: null })}
            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1"
          >
            清除范围
          </button>
        </div>
          </div>
        </div>
      )}
    </>
  );
}
