import { useState, useEffect } from "react";
import dayjs from "dayjs";

interface UpcomingEventsProps {
    events: any[];
}

export default function UpcomingEvents({ events }: UpcomingEventsProps) {
    const [showAll, setShowAll] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    // Filter events: future or today
    const futureEvents = events
        .filter((ev) => {
            const today = dayjs().startOf('day');
            const evDate = dayjs(ev.schedule_date).startOf('day');
            return evDate.isSame(today) || evDate.isAfter(today);
        })
        .sort((a, b) => {
            const dateA = dayjs(a.schedule_date + " " + (a.schedule_time || "00:00"));
            const dateB = dayjs(b.schedule_date + " " + (b.schedule_time || "00:00"));
            return dateA.diff(dateB);
        });

    const displayedEvents = showAll ? futureEvents : futureEvents.slice(0, 3);

    const colorClasses = [
        "bg-blue-100 border-l-4 border-blue-500",
        "bg-purple-100 border-l-4 border-purple-500",
        "bg-green-100 border-l-4 border-green-500",
        "bg-orange-100 border-l-4 border-orange-500",
        "bg-pink-100 border-l-4 border-pink-500",
    ];

    const getColor = (index: number) => colorClasses[index % colorClasses.length];

    // Helper untuk mengambil daftar jabatan dari event
    const getTargetRolesText = (ev: any) => {
        try {
            if (ev.tujuan_jabatan) {
                const raw = typeof ev.tujuan_jabatan === 'string'
                    ? JSON.parse(ev.tujuan_jabatan)
                    : ev.tujuan_jabatan;
                if (Array.isArray(raw) && raw.length > 0) {
                    return raw.join(', ');
                }
            }
        } catch (e) {
            // fallback ke target_role
        }
        return ev.target_role || '';
    };

    // Close modal with animation
    const closeModal = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsModalOpen(false);
            setIsClosing(false);
            setSelectedEvent(null);
        }, 300);
    };

    // Handle event click
    const handleEventClick = (ev: any) => {
        setSelectedEvent(ev);
        setIsModalOpen(true);
    };

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

    // Close modal on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isModalOpen) {
                closeModal();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isModalOpen]);

    return (
        <>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col overflow-hidden min-h-[300px]">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800 text-md">Acara Mendatang</h3>
                    {futureEvents.length > 3 && (
                        <button
                            onClick={() => setShowAll(!showAll)}
                            className="text-xs text-blue-600 font-medium hover:underline"
                        >
                            {showAll ? "Tutup" : "Lihat Semua"}
                        </button>
                    )}
                </div>

                <div className="overflow-y-auto space-y-3 pr-1 custom-scrollbar flex-1">
                    {displayedEvents.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">Tidak ada acara mendatang.</p>
                    ) : (
                        displayedEvents.map((ev, idx) => (
                            <div
                                key={ev.id}
                                onClick={() => handleEventClick(ev)}
                                className={`p-3 rounded-md shadow-sm transition-all hover:scale-[1.02] cursor-pointer ${getColor(idx)}`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    <span className="text-xs font-semibold text-gray-700">
                                        {ev.schedule_time ? ev.schedule_time : "Seharian"}
                                    </span>
                                    <span className="text-[10px] text-gray-500 ml-auto">
                                        {dayjs(ev.schedule_date).format('DD MMM')}
                                    </span>
                                </div>
                                <h4 className="font-bold text-gray-800 text-sm line-clamp-2">{ev.title}</h4>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal Popup with Animation */}
            {isModalOpen && selectedEvent && (
                <div
                    className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 p-4 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
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
                                Detail Kegiatan
                            </h3>
                            <button onClick={closeModal} className="hover:bg-white/20 rounded-full p-1 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-bold text-xl text-gray-800 mb-2">{selectedEvent.title}</h4>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span className="inline-flex items-center bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            {dayjs(selectedEvent.schedule_date).format('DD MMMM YYYY')}
                                        </span>
                                        <span className="inline-flex items-center bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {selectedEvent.schedule_time
                                                ? (selectedEvent.schedule_end_time
                                                    ? `${selectedEvent.schedule_time} - ${selectedEvent.schedule_end_time}`
                                                    : selectedEvent.schedule_time)
                                                : "Seharian"}
                                        </span>
                                    </div>
                                </div>

                                {selectedEvent.description && (
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <p className="text-sm font-semibold text-gray-700 mb-2">Deskripsi:</p>
                                        <p className="text-gray-700 text-sm whitespace-pre-line leading-relaxed">{selectedEvent.description}</p>
                                    </div>
                                )}

                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-2">
                                    {getTargetRolesText(selectedEvent) && (
                                        <div className="flex items-start">
                                            <span className="font-semibold text-sm text-gray-700 w-28">Ditujukan:</span>
                                            <span className="flex-1 text-sm text-gray-600">{getTargetRolesText(selectedEvent)}</span>
                                        </div>
                                    )}
                                    {(selectedEvent.creator_full_name || selectedEvent.creator_username || selectedEvent.creator_role) && (
                                        <div className="flex items-start">
                                            <span className="font-semibold text-sm text-gray-700 w-28">Dibuat oleh:</span>
                                            <span className="flex-1 text-sm text-gray-600">
                                                {selectedEvent.creator_full_name || selectedEvent.creator_username || '-'} ({selectedEvent.creator_role || '-'})
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-gray-50 p-4 flex justify-end border-t">
                            <button
                                onClick={closeModal}
                                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg"
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
