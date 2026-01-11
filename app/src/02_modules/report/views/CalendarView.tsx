// Pillar L: Pure UI component for calendar grid
import { useMemo } from 'react';
import { useTranslation } from '../../../i18n';
import '../styles/calendar.css';

interface CalendarViewProps {
  year: number;
  month: number; // 0-indexed (January = 0)
  selectedDate: string | null; // YYYY-MM-DD
  transactionCounts: Record<string, number>; // date -> count
  onDateSelect: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
  onMonthHeaderClick?: () => void; // Optional: click month title to show monthly summary
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function CalendarView({
  year,
  month,
  selectedDate,
  transactionCounts,
  onDateSelect,
  onMonthChange,
  onMonthHeaderClick,
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

    // Fill to complete 6 weeks (42 cells) for consistent height
    while (days.length < 42) {
      days.push({ date: null, day: null });
    }

    return days;
  }, [year, month]);

  const monthLabel = useMemo(() => {
    const date = new Date(year, month);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
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

  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD in local TZ

  return (
    <div className="calendar">
      {/* Month Header */}
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav calendar-nav--prev"
          onClick={handlePrevMonth}
          aria-label={t('calendar.prevMonth')}
        >
          ←
        </button>

        {onMonthHeaderClick ? (
          <button
            type="button"
            className="calendar-month-title"
            onClick={onMonthHeaderClick}
            aria-label={t('calendar.monthSummary')}
          >
            {monthLabel}
          </button>
        ) : (
          <span className="calendar-month-title calendar-month-title--static">
            {monthLabel}
          </span>
        )}

        <button
          type="button"
          className="calendar-nav calendar-nav--next"
          onClick={handleNextMonth}
          aria-label={t('calendar.nextMonth')}
        >
          →
        </button>
      </div>

      {/* Day Headers */}
      <div className="calendar-weekdays">
        {WEEKDAYS.map((day) => (
          <div key={day} className="calendar-weekday">
            {t(`calendar.days.${day}`)}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {calendarDays.map((cell, index) => {
          if (!cell.date || !cell.day) {
            return <div key={`empty-${index}`} className="calendar-cell calendar-cell--empty" />;
          }

          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          const count = transactionCounts[cell.date] || 0;
          const hasData = count > 0;

          return (
            <button
              key={cell.date}
              type="button"
              className={`calendar-cell ${isToday ? 'calendar-cell--today' : ''} ${isSelected ? 'calendar-cell--selected' : ''} ${hasData ? 'calendar-cell--has-data' : ''}`}
              onClick={() => onDateSelect(cell.date!)}
              aria-label={`${cell.date}${count > 0 ? ` (${count} ${t('calendar.transactions')})` : ''}`}
              aria-current={isToday ? 'date' : undefined}
              aria-selected={isSelected ? 'true' : 'false'}
            >
              <span className="calendar-cell-day">{cell.day}</span>
              {hasData && (
                <span
                  className={`calendar-cell-indicator ${count > 5 ? 'calendar-cell-indicator--high' : ''}`}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
