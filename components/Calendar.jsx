"use client";

import { useState, useEffect } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";

export default function Calendar({ events, onSelectDate, selectedDate: propSelectedDate, onDeleted, onEdit, currentUser, onViewChange }) {
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState(propSelectedDate ?? null);

  // Notify parent of view changes
  useEffect(() => {
    if (onViewChange) {
      onViewChange(currentMonth);
    }
  }, [currentMonth, onViewChange]);

  // keep internal selectedDate in sync if parent passes a different value
  if (propSelectedDate && (!selectedDate || propSelectedDate.format("YYYY-MM-DD") !== selectedDate.format("YYYY-MM-DD"))) {
    setSelectedDate(propSelectedDate);
  }

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const currentYear = currentMonth.year();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const daysInMonth = currentMonth.daysInMonth();
  const startDay = currentMonth.startOf("month").day();

  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
    "bg-yellow-100 text-yellow-700",
    "bg-red-100 text-red-700",
    "bg-purple-100 text-purple-700",
  ];

  const colorFor = (ev) => {
    const s = String(ev.id ?? ev.title ?? "");
    let num = 0;
    for (let i = 0; i < s.length; i++) num += s.charCodeAt(i);
    return colors[num % colors.length];
  };

  // Helper untuk mengambil daftar jabatan dari event
  const getTargetRolesText = (ev) => {
    try {
      if (ev.tujuan_jabatan) {
        // kolom JSON: bisa sudah diparse atau masih string
        const raw = typeof ev.tujuan_jabatan === 'string'
          ? JSON.parse(ev.tujuan_jabatan)
          : ev.tujuan_jabatan;
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.join(', ');
        }
      }
    } catch (e) {
      // fallback ke target_role di bawah
    }
    return ev.target_role || '';
  };

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Implementasi fungsi delete
  const deleteEvent = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus kegiatan ini?")) return;

    try {
      const res = await fetch("/api/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Kegiatan berhasil dihapus");
        closeModal();
        if (onDeleted) onDeleted();
      } else {
        toast.error(data.message || "Gagal menghapus kegiatan");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan sistem");
    }
  };

  // Close modal with animation
  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsModalOpen(false);
      setIsClosing(false);
    }, 300); // match animation duration
  };

  // Close modal on escape key
  if (typeof window !== 'undefined') {
    window.onkeydown = (e) => {
      if (e.key === 'Escape') closeModal();
    };
  }

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  const borderColors = [
    "border-red-400", "border-orange-400", "border-amber-400",
    "border-green-400", "border-teal-400", "border-cyan-400",
    "border-blue-400", "border-indigo-400", "border-violet-400",
    "border-purple-400", "border-fuchsia-400", "border-pink-400",
    "border-rose-400"
  ];

  const getEventColor = (dateStr) => {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    return borderColors[Math.abs(hash) % borderColors.length];
  };

  const renderDay = (i) => {
    const date = currentMonth.date(i + 1);
    const dayEvents = events.filter((e) => {
      try {
        const eventDate = dayjs(e.schedule_date);
        if (!eventDate.isValid()) return false;
        return eventDate.format("YYYY-MM-DD") === date.format("YYYY-MM-DD");
      } catch (err) {
        return false;
      }
    });

    // Sort events
    const sortedEvents = dayEvents.sort((a, b) => {
      try {
        const aDate = dayjs(a.schedule_date);
        const bDate = dayjs(b.schedule_date);
        const today = dayjs().startOf("day");
        const aIsPast = aDate.isBefore(today, "day");
        const bIsPast = bDate.isBefore(today, "day");
        if (aIsPast && !bIsPast) return 1;
        if (!aIsPast && bIsPast) return -1;
        if (a.schedule_time && b.schedule_time) return a.schedule_time.localeCompare(b.schedule_time);
        return 0;
      } catch (err) { return 0; }
    });

    const hasEvents = dayEvents.length > 0;
    const isToday = date.format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD");
    const dateStr = date.format("YYYY-MM-DD");
    const markerColor = hasEvents ? getEventColor(dateStr) : "border-transparent";

    return (
      <div
        key={i}
        onClick={() => {
          setSelectedDate(date);
          if (onSelectDate) onSelectDate(date);
        }}
        onDoubleClick={() => {
          setSelectedDate(date);
          setIsModalOpen(true);
        }}
        className={`border rounded p-2 min-h-[100px] cursor-pointer hover:bg-blue-50 flex flex-col justify-start transition-colors duration-200 ${hasEvents ? "bg-gradient-to-b from-white to-gray-50" : "bg-white"
          } ${isToday ? "ring-2 ring-blue-400" : ""}`}
      >
        <div className="flex items-center justify-between">
          <div
            className={`font-semibold text-sm inline-block px-2 py-1 rounded-full border-2 ${hasEvents ? `bg-white ${markerColor}` : "text-gray-700 border-transparent"
              }`}
          >
            {i + 1}
          </div>
        </div>

        <div className="mt-2 space-y-1">
          {sortedEvents.slice(0, 3).map((ev) => {
            const evDate = dayjs(ev.schedule_date);
            const isEventPast = evDate.isBefore(dayjs(), "day");
            return (
              <div
                key={ev.id}
                className={`text-xs rounded px-1 py-0.5 whitespace-normal break-words ${colorFor(ev)} ${isEventPast ? "opacity-60" : ""
                  }`}
                title={ev.title}
              >
                {ev.schedule_time ? (
                  ev.schedule_end_time
                    ? `${ev.schedule_time}-${ev.schedule_end_time} `
                    : `${ev.schedule_time} `
                ) : ""}
                {ev.title}
              </div>
            );
          })}
          {sortedEvents.length > 3 && (
            <div className="text-xs text-gray-500">+{sortedEvents.length - 3} lagi</div>
          )}
        </div>
      </div>
    );
  };

  const selectedEvents = selectedDate
    ? events.filter((e) => {
      try {
        const eventDate = dayjs(e.schedule_date);
        const match = eventDate.isValid() && eventDate.format("YYYY-MM-DD") === selectedDate.format("YYYY-MM-DD");
        // console.log(`Debug Event: ${e.title}, Date: ${eventDate.format("YYYY-MM-DD")}, Selected: ${selectedDate.format("YYYY-MM-DD")}, Match: ${match}`);
        return match;
      } catch (err) { return false; }
    })
    : [];


  return (
    <>
      <div className="bg-white p-4 rounded shadow">
        <div className="flex justify-between items-center mb-3 gap-2">
          <div className="flex items-center gap-2">
            <select
              value={currentMonth.month()}
              onChange={(e) => setCurrentMonth(currentMonth.month(Number(e.target.value)))}
              className="border rounded px-2 py-1 cursor-pointer hover:bg-gray-50"
            >
              {months.map((m, idx) => <option value={idx} key={m}>{m}</option>)}
            </select>
            <select
              value={currentMonth.year()}
              onChange={(e) => setCurrentMonth(currentMonth.year(Number(e.target.value)))}
              className="border rounded px-2 py-1 cursor-pointer hover:bg-gray-50"
            >
              {years.map((y) => <option value={y} key={y}>{y}</option>)}
            </select>
          </div>

          {/* Month/Year Display with Navigation Arrows */}
          <div className="flex items-center gap-2">
            <div className="font-semibold text-lg text-gray-800">{currentMonth.format("MMMM YYYY")}</div>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentMonth(currentMonth.subtract(1, 'month'))}
                className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors group"
                title="Bulan Sebelumnya"
              >
                <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={() => setCurrentMonth(currentMonth.add(1, 'month'))}
                className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors group"
                title="Bulan Berikutnya"
              >
                <svg className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 text-center text-sm mb-2 pb-2 border-b min-w-[700px]">
            {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((d) => (
              <div key={d} className="font-bold text-gray-500">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 min-w-[700px]">
            {Array.from({ length: startDay }).map((_, i) => <div key={`blank-${i}`}></div>)}
            {Array.from({ length: daysInMonth }, (_, i) => renderDay(i))}
          </div>
        </div>
      </div>

      {/* Modal Popup with Animation */}
      {isModalOpen && selectedDate && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
          onClick={closeModal}
        >
          <style jsx>{`
            @keyframes popIn {
              0% { transform: scale(0.9); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes popOut {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(0.9); opacity: 0; }
            }
          `}</style>
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            style={{
              animation: isClosing ? 'popOut 0.3s ease-in forwards' : 'popIn 0.3s ease-out forwards',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex justify-between items-center text-white flex-none">
              <h3 className="font-bold text-lg">
                Detail {selectedDate.format("DD MMMM YYYY")}
              </h3>
              <button onClick={closeModal} className="hover:bg-white/20 rounded-full p-1 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {selectedEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>Tidak ada kegiatan pada tanggal ini.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedEvents.map((ev) => (
                    <div key={ev.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-gray-50 border-gray-100">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className={`font-bold text-lg ${colorFor(ev).split(" ")[1]}`}>{ev.title}</h4>
                          <span className="inline-flex items-center text-sm text-gray-600 bg-white px-2 py-0.5 rounded border mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {ev.schedule_time
                              ? (ev.schedule_end_time
                                ? `${ev.schedule_time} - ${ev.schedule_end_time}`
                                : ev.schedule_time)
                              : "-"}
                          </span>
                        </div>
                        {currentUser && currentUser.role === 'admin' && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                if (onEdit) onEdit(ev);
                              }}
                              className="text-blue-500 hover:text-blue-700 p-1.5 hover:bg-blue-100 rounded transition-colors"
                              title="Edit Kegiatan"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteEvent(ev.id)}
                              className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-100 rounded transition-colors"
                              title="Hapus Kegiatan"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {ev.description && (
                        <p className="text-gray-700 text-sm mb-3 whitespace-pre-line leading-relaxed">{ev.description}</p>
                      )}

                      {ev.location && (
                        <div className="flex items-start gap-2 mb-3 text-sm text-gray-700 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <div>
                            <span className="font-semibold text-blue-900">Lokasi:</span>
                            <span className="ml-2">{ev.location}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-1 mt-3 pt-3 border-t text-xs text-gray-500">
                        {getTargetRolesText(ev) && (
                          <div className="flex items-start">
                            <span className="font-semibold w-20">Ditujukan:</span>
                            <span className="flex-1">{getTargetRolesText(ev)}</span>
                          </div>
                        )}
                        {(ev.creator_full_name || ev.creator_username || ev.creator_role) && (
                          <div className="flex items-start">
                            <span className="font-semibold w-20">Dibuat oleh:</span>
                            <span className="flex-1">{ev.creator_full_name || ev.creator_username || '-'} ({ev.creator_role || '-'})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 flex justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}