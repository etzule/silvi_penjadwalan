"use client";

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function EmailPushButton() {
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const handleProcess = async (mode) => {
        setShowModal(false);
        setLoading(true);

        const isToday = mode === 'today';
        const label = isToday ? 'Hari Ini' : 'H-1';
        const targetDateStr = isToday
            ? dayjs().format('YYYY-MM-DD')
            : dayjs().add(1, 'day').format('YYYY-MM-DD');

        const toastId = toast.loading(`Memproses email untuk kegiatan ${label}...`);

        try {
            // 1. Fetch
            const resEvents = await fetch('/api/schedule');
            if (!resEvents.ok) throw new Error('Gagal mengambil jadwal');
            const events = await resEvents.json();

            // 2. Filter
            const targetEvents = events.filter(ev => {
                const evDate = dayjs(ev.schedule_date).format('YYYY-MM-DD');
                return evDate === targetDateStr;
            });

            if (targetEvents.length === 0) {
                toast.dismiss(toastId);
                toast(`Tidak ada kegiatan untuk ${label.toLowerCase()}`, { icon: 'ℹ️' });
                return; // exit finally block handles loading
            }

            // 3. Send
            let success = 0;
            let fail = 0;

            for (const ev of targetEvents) {
                try {
                    const res = await fetch('/api/push-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            eventId: ev.id,
                            notifType: label, // 'Hari Ini' or 'H-1'
                            broadcastToAll: true
                        }),
                    });
                    const data = await res.json();
                    if (data.ok) success++;
                    else fail++;
                } catch (e) {
                    fail++;
                }
            }

            toast.dismiss(toastId);
            if (success > 0) toast.success(`Sukses: ${success} email terkirim (${label})`);
            if (fail > 0) toast.error(`Gagal: ${fail} email (${label})`);

        } catch (err) {
            console.error(err);
            toast.dismiss(toastId);
            toast.error('Terjadi kesalahan sistem');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                disabled={loading}
                className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Kirim notifikasi email manual"
            >
                {loading ? (
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full" />
                ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                )}
                Push Email
            </button>

            {/* Selection Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">Pilih Target Notifikasi</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="text-sm text-gray-600 mb-4 text-center">
                                Pilih jadwal kegiatan yang ingin dikirimkan notifikasi emailnya:
                            </p>

                            <button
                                onClick={() => handleProcess('today')}
                                className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl transition-all group"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="font-bold text-base">Jadwal Hari Ini</span>
                                    <span className="text-xs opacity-75">{dayjs().format('DD MMMM YYYY')}</span>
                                </div>
                                <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            <button
                                onClick={() => handleProcess('tomorrow')}
                                className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-xl transition-all group"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="font-bold text-base">Jadwal Besok (H-1)</span>
                                    <span className="text-xs opacity-75">{dayjs().add(1, 'day').format('DD MMMM YYYY')}</span>
                                </div>
                                <svg className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
