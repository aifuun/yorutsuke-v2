// Simple calendar component for date selection
import { useMemo } from 'react';
import { useTranslation } from '../../../i18n';

interface CalendarViewProps {
  year: number;
  month: number; // 0-indexed (January = 0)
  selectedDate: string | null; // YYYY-MM-DD
  transactionDates: Set<string>; // Dates that have transactions
  onDateSelect: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarView({
  year,
  month,
  selectedDate,
  transactionDates,
  onDateSelect,
  onMonthChange,
}: CalendarViewProps) {
  const { t } = useTranslation();

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const days: Array<{ date: string | null; day: number | null }> = [];

    // Add empty cells for days before the 1st
    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, day: null });
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({ date: dateStr, day });
    }

    return days;
  }, [year, month]);

  const monthLabel = useMemo(() => {
    const date = new Date(year, month);
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
  }, [year, month]);

  const handlePrevMonth = () => {
    if (month === 0) {
      onMonthChange(year - 1, 11);
    } else {
      onMonthChange(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      onMonthChange(year + 1, 0);
    } else {
      onMonthChange(year, month + 1);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="calendar-view">
      <div className="calendar-header">
        <button
          type="button"
          className="btn-nav"
          onClick={handlePrevMonth}
          aria-label={t('history.prevMonth')}
        >
          &lt;
        </button>
        <span className="month-label">{monthLabel}</span>
        <button
          type="button"
          className="btn-nav"
          onClick={handleNextMonth}
          aria-label={t('history.nextMonth')}
        >
          &gt;
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAYS.map(day => (
          <div key={day} className="weekday">{day}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarDays.map((cell, index) => {
          if (cell.date === null) {
            return <div key={`empty-${index}`} className="calendar-day empty" />;
          }

          const hasTransactions = transactionDates.has(cell.date);
          const isSelected = cell.date === selectedDate;
          const isToday = cell.date === today;

          return (
            <button
              key={cell.date}
              type="button"
              className={`calendar-day ${hasTransactions ? 'has-data' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => onDateSelect(cell.date!)}
            >
              <span className="day-number">{cell.day}</span>
              {hasTransactions && <span className="data-indicator" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
