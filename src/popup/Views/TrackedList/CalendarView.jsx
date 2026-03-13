import { useState, useMemo, useEffect } from 'preact/hooks';
import { TimeService } from '../../../utils/time.js';
import { TrackedList } from './TrackedList.jsx';
import { TimerService } from '../../../utils/timer.js';
import { StorageService } from '../../../utils/storage.js';
import { STORAGE_KEYS } from '../../../utils/constants.js';
import { IconChevronLeft, IconChevronRight, IconSearch, IconClock } from '../../../icons.jsx';

export function CalendarView({ tracked }) {
  const getLocalDate = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const [currentDate, setCurrentDate] = useState(getLocalDate());
  const [selectedDate, setSelectedDate] = useState(getLocalDate());
  const [activeIssue, setActiveIssue] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [currentTimes, setCurrentTimes] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadActiveData = async () => {
      const [active, start] = await Promise.all([
        StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE),
        StorageService.get(STORAGE_KEYS.START_TIME),
      ]);
      setActiveIssue(active);
      setStartTime(start);

      if (active && start && !isNaN(new Date(start).getTime())) {
        const totalTime = await TimerService.getTotalTimeForIssue(active);
        const elapsed = (Date.now() - new Date(start).getTime()) / 1000;
        setCurrentTimes((prev) => ({
          ...prev,
          [active]: TimeService.formatTime(elapsed + totalTime),
        }));
      }
    };
    loadActiveData();

    const listener = (changes) => {
      if (changes[STORAGE_KEYS.ACTIVE_ISSUE]) {
        setActiveIssue(changes[STORAGE_KEYS.ACTIVE_ISSUE].newValue);
      }
      if (changes[STORAGE_KEYS.START_TIME]) {
        setStartTime(changes[STORAGE_KEYS.START_TIME].newValue);
      }
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!activeIssue || !startTime || isNaN(new Date(startTime).getTime())) {
      setCurrentTimes((prev) => {
        const newTimes = { ...prev };
        delete newTimes[activeIssue];
        return newTimes;
      });
      return;
    }

    const updateTotalTime = async () => {
      const totalTime = await TimerService.getTotalTimeForIssue(activeIssue);
      const intervalId = setInterval(() => {
        const elapsed = (Date.now() - new Date(startTime).getTime()) / 1000;
        setCurrentTimes((prev) => ({
          ...prev,
          [activeIssue]: TimeService.formatTime(elapsed + totalTime),
        }));
      }, 1000);
      return intervalId;
    };

    let intervalId;
    updateTotalTime().then((id) => { intervalId = id; });
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [activeIssue, startTime]);

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  lastDayOfMonth.setHours(0, 0, 0, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const firstDayWeekday = firstDayOfMonth.getDay();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array(firstDayWeekday).fill(null);

  const trackedDates = useMemo(() => {
    const dates = new Set();
    tracked.forEach((entry) => {
      const entryDate = new Date(entry.date);
      if (!isNaN(entryDate.getTime())) {
        entryDate.setHours(0, 0, 0, 0);
        dates.add(entryDate.toISOString().split('T')[0]);
      }
    });
    return Array.from(dates);
  }, [tracked]);

  const selectedDayTracked = useMemo(() => {
    const startOfSelected = new Date(selectedDate);
    startOfSelected.setHours(0, 0, 0, 0);
    const endOfSelected = new Date(startOfSelected);
    endOfSelected.setDate(startOfSelected.getDate() + 1);
    return tracked.filter((entry) => {
      const entryDate = new Date(entry.date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate >= startOfSelected && entryDate < endOfSelected;
    });
  }, [tracked, selectedDate]);

  const selectedDayTotalTime = useMemo(() => {
    const totalSeconds = selectedDayTracked.reduce((sum, entry) => sum + (entry.seconds || 0), 0);
    return TimeService.formatTime(totalSeconds);
  }, [selectedDayTracked]);

  const filteredTracked = useMemo(() => {
    if (!searchTerm) return selectedDayTracked;
    return selectedDayTracked.filter((entry) =>
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.issueUrl.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [selectedDayTracked, searchTerm]);

  const entries = useMemo(() => {
    const grouped = filteredTracked.reduce((acc, entry) => {
      if (!acc[entry.issueUrl]) {
        acc[entry.issueUrl] = { title: entry.title, seconds: 0, issueUrl: entry.issueUrl };
      }
      acc[entry.issueUrl].seconds += entry.seconds;
      return acc;
    }, {});
    return Object.values(grouped).map((e) => ({
      ...e,
      displayTime:
        e.issueUrl === activeIssue && currentTimes[e.issueUrl]
          ? currentTimes[e.issueUrl]
          : TimeService.formatTime(e.seconds),
    }));
  }, [filteredTracked, currentTimes, activeIssue]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const selectDay = (day) => {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    d.setHours(0, 0, 0, 0);
    setSelectedDate(d);
  };

  const isDayTracked = (day) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split('T')[0];
    const today = getLocalDate();
    const todayStr = today.toISOString().split('T')[0];
    return trackedDates.includes(dateStr) || dateStr === todayStr;
  };

  const isSelectedDay = (day) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    return date.toDateString() === selectedDate.toDateString();
  };

  const isToday = (day) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    date.setHours(0, 0, 0, 0);
    return date.toDateString() === getLocalDate().toDateString();
  };

  return (
    <div className="p-4">
      {/* Month navigation */}
      <div className="flex justify-between items-center mb-3">
        <button
          onClick={prevMonth}
          className="p-1 text-muted hover:text-secondary hover:bg-surface rounded-lg cursor-pointer transition-colors"
        >
          <IconChevronLeft size={16} />
        </button>
        <span className="text-[13px] font-semibold text-primary">
          {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 text-muted hover:text-secondary hover:bg-surface rounded-lg cursor-pointer transition-colors"
        >
          <IconChevronRight size={16} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 text-center mb-4">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={i} className="text-[10px] font-medium text-muted py-1">{day}</div>
        ))}
        {paddingDays.map((_, i) => (
          <div key={`pad-${i}`} className="h-8" />
        ))}
        {daysArray.map((day) => {
          const tracked = isDayTracked(day);
          const selected = isSelectedDay(day);
          const today = isToday(day);
          return (
            <div
              key={day}
              className={`h-8 flex items-center justify-center rounded-lg text-[12px] transition-colors ${selected
                ? 'bg-accent text-white font-medium cursor-pointer'
                : tracked
                  ? 'bg-accent-subtle text-accent-text cursor-pointer hover:bg-accent-ring font-medium'
                  : today
                    ? 'text-primary font-medium'
                    : 'text-faint'
                } ${tracked || today ? 'cursor-pointer' : ''}`}
              onClick={() => (tracked || today) && selectDay(day)}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Selected day summary */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border-subtle">
        <div className="text-[13px] text-secondary font-medium">
          {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
        <div className="flex items-center gap-1 text-[13px] font-mono font-semibold text-primary tabular-nums">
          <IconClock size={13} className="text-muted" />
          {selectedDayTotalTime}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          <IconSearch size={13} />
        </div>
        <input
          type="text"
          placeholder="Search entries..."
          value={searchTerm}
          onInput={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-surface border border-border-default rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-muted"
        />
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="text-[13px] text-muted text-center py-6">
          No entries for this day
        </div>
      ) : (
        <TrackedList entries={entries} showTimerControls={true} />
      )}
    </div>
  );
}