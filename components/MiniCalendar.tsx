"use client";

import { useState, useEffect } from "react";
import dayjs, { Dayjs } from "dayjs";

interface MiniCalendarProps {
    selectedDate: Dayjs;
    onSelectDate: (date: Dayjs) => void;
    events?: any[];
}

export default function MiniCalendar({ selectedDate, onSelectDate, events = [] }: MiniCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(dayjs());

    // Sync current month when selectedDate changes significantly (optional, but good UX)
    useEffect(() => {
        if (selectedDate && !selectedDate.isSame(currentMonth, 'month')) {
            setCurrentMonth(selectedDate);
        }
    }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

    const daysInMonth = currentMonth.daysInMonth();
    const startDay = currentMonth.startOf("month").day(); // 0 = Sunday

    const handlePrevMonth = () => setCurrentMonth(currentMonth.subtract(1, "month"));
    const handleNextMonth = () => setCurrentMonth(currentMonth.add(1, "month"));

    // Consistent "random" colors based on date
    const borderColors = [
        "border-red-400", "border-orange-400", "border-amber-400",
        "border-green-400", "border-teal-400", "border-cyan-400",
        "border-blue-400", "border-indigo-400", "border-violet-400",
        "border-purple-400", "border-fuchsia-400", "border-pink-400",
        "border-rose-400"
    ];

    const getEventColor = (dateStr: string) => {
        // simple hash to pick a color consistently for a specific date
        let hash = 0;
        for (let i = 0; i < dateStr.length; i++) {
            hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        return borderColors[Math.abs(hash) % borderColors.length];
    };

    const renderDay = (i: number) => {
        const day = i + 1;
        const date = currentMonth.date(day);
        const dateStr = date.format("YYYY-MM-DD");

        const isSelected = selectedDate && date.isSame(selectedDate, "day");
        const isToday = date.isSame(dayjs(), "day");

        // Check if this date has any events
        const hasEvent = events.some((ev) => {
            try {
                const evDate = dayjs(ev.schedule_date).format("YYYY-MM-DD");
                return evDate === dateStr;
            } catch { return false; }
        });

        // Use deterministic random color if event exists
        const eventBorderClass = hasEvent ? `border-2 ${getEventColor(dateStr)}` : "";

        return (
            <div
                key={`day-${i}`}
                onClick={() => onSelectDate(date)}
                className={`
          w-8 h-8 flex items-center justify-center text-sm rounded-full cursor-pointer transition-all box-border
          ${isSelected ? "bg-blue-600 text-white shadow-md scale-105 border-0" : "hover:bg-blue-50 text-gray-700"}
          ${!isSelected && isToday ? "text-blue-600 font-bold bg-blue-50" : ""}
          ${!isSelected && !isToday && hasEvent ? eventBorderClass : ""}
        `}
            >
                {day}
            </div>
        );
    };

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg">
                    {currentMonth.format("MMMM YYYY")}
                </h3>
                <div className="flex gap-1">
                    <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 text-center mb-2">
                {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => (
                    <div key={i} className="text-xs font-medium text-gray-400 py-1">
                        {d}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-y-2 place-items-center">
                {Array.from({ length: startDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-8 h-8" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => renderDay(i))}
            </div>
        </div>
    );
}
