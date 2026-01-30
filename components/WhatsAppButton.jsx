"use client";

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import dayjs from 'dayjs';

export default function WhatsAppButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [connected, setConnected] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState(null);
    const [checkingStatus, setCheckingStatus] = useState(false);

    // Check WhatsApp connection status
    const checkStatus = async () => {
        setCheckingStatus(true);
        try {
            const res = await fetch('/api/whatsapp/status');
            const data = await res.json();

            setConnected(data.connected);

            if (data.qrCode && !data.connected) {
                const qrUrl = await QRCode.toDataURL(data.qrCode);
                setQrCodeUrl(qrUrl);
            } else {
                setQrCodeUrl(null);
            }
        } catch (error) {
            console.error('Error checking status:', error);
        } finally {
            setCheckingStatus(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            checkStatus();
            const interval = setInterval(checkStatus, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    // Background status polling (even when modal is closed) to update button indicator
    useEffect(() => {
        // Initial check
        checkStatus();

        // Poll every 15 seconds to keep button status updated (reduced load)
        const backgroundInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/whatsapp/status');
                const data = await res.json();
                setConnected(data.connected);
            } catch (error) {
                console.error('Background status check error:', error);
            }
        }, 15000); // Check every 15 seconds (reduced from 5s)

        return () => clearInterval(backgroundInterval);
    }, []);

    const handleSend = async (e) => {
        e.preventDefault();

        if (!phoneNumber || !message) {
            toast.error('Nomor telepon dan pesan harus diisi');
            return;
        }

        if (!connected) {
            toast.error('WhatsApp belum terhubung. Scan QR code terlebih dahulu.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phoneNumber, message })
            });

            const data = await res.json();

            if (data.success) {
                toast.success('Pesan berhasil dikirim!');
                setPhoneNumber('');
                setMessage('');
                setIsOpen(false);
            } else {
                toast.error(data.error || 'Gagal mengirim pesan');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Terjadi kesalahan saat mengirim pesan');
        } finally {
            setLoading(false);
        }
    };

    const handleBroadcast = async (mode) => {
        // Confirmation
        const label = mode === 'today' ? 'HARI INI' : 'BESOK (H-1)';
        if (!confirm(`Kirim broadcast WhatsApp untuk kegiatan ${label}?`)) return;

        setLoading(true);
        const toastId = toast.loading(`Memproses broadcast ${label}...`);

        try {
            // 1. Fetch events
            const resEvents = await fetch('/api/schedule');
            if (!resEvents.ok) throw new Error('Gagal mengambil data jadwal');
            const events = await resEvents.json();

            // 2. Filter target events
            const targetDateStr = mode === 'today'
                ? dayjs().format('YYYY-MM-DD')
                : dayjs().add(1, 'day').format('YYYY-MM-DD');

            const targetEvents = events.filter(ev => {
                const evDate = dayjs(ev.schedule_date).format('YYYY-MM-DD');
                return evDate === targetDateStr;
            });

            if (targetEvents.length === 0) {
                toast.dismiss(toastId);
                toast(`Tidak ada kegiatan untuk ${mode === 'today' ? 'hari ini' : 'besok'}`, { icon: 'ℹ️' });
                return;
            }

            // 3. Send broadcast
            let success = 0;
            let fail = 0;

            for (const ev of targetEvents) {
                try {
                    const res = await fetch('/api/push-whatsapp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            eventId: ev.id,
                            notifType: mode === 'today' ? 'Hari Ini' : 'H-1',
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
            if (success > 0) toast.success(`Sukses broadcast ${success} kegiatan`);
            if (fail > 0) toast.error(`Gagal broadcast ${fail} kegiatan`);

        } catch (error) {
            console.error('Broadcast error:', error);
            toast.dismiss(toastId);
            toast.error('Gagal melakukan broadcast');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Header Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="px-2.5 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded text-xs font-medium transition-colors flex items-center gap-1.5 relative"
            >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
                {/* Connection Status Indicator */}
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            </button>

            {/* WhatsApp Form Popup */}
            {isOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden animate-fadeInScale">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 shrink-0 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-lg">Kirim WhatsApp</h3>
                                    <p className="text-white/80 text-xs">
                                        {connected ? '✓ Terhubung' : '○ Tidak terhubung'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white/80 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            {/* QR Code Section */}
                            {!connected && qrCodeUrl && (
                                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-800 mb-3 font-medium text-center">
                                        📱 Scan QR Code untuk menghubungkan WhatsApp
                                    </p>
                                    <div className="flex justify-center items-center">
                                        <img
                                            src={qrCodeUrl}
                                            alt="QR Code"
                                            className="w-full max-w-[200px] sm:max-w-[240px] h-auto border-4 border-white shadow-lg rounded-lg"
                                        />
                                    </div>
                                    <p className="text-xs text-yellow-700 mt-3 text-center leading-relaxed">
                                        Buka WhatsApp → Pengaturan → Perangkat Tertaut → Tautkan Perangkat
                                    </p>
                                </div>
                            )}

                            {/* Connection Status */}
                            {!connected && !qrCodeUrl && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                                    <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                                    <p className="text-sm text-blue-800">Menghubungkan ke WhatsApp...</p>
                                </div>
                            )}

                            {connected && (
                                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <p className="text-sm text-green-800 font-medium">WhatsApp terhubung!</p>
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={handleSend} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nomor WhatsApp
                                    </label>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="08123456789"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                                        disabled={!connected}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Format: 08xxx atau 628xxx</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Pesan
                                    </label>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Tulis pesan Anda di sini..."
                                        rows={4}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all resize-none"
                                        disabled={!connected}
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsOpen(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || !connected}
                                        className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                                Mengirim...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                                </svg>
                                                Kirim
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>

                            {/* Refresh and Reset Buttons */}
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={checkStatus}
                                    disabled={checkingStatus}
                                    className="flex-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh
                                </button>

                                {!connected && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('/api/whatsapp/reset', { method: 'POST' });
                                                const data = await res.json();
                                                if (data.success) {
                                                    toast.success('Reset berhasil! QR code baru akan muncul.');
                                                    setTimeout(checkStatus, 2000);
                                                } else {
                                                    toast.error('Gagal reset: ' + data.error);
                                                }
                                            } catch (error) {
                                                toast.error('Terjadi kesalahan saat reset');
                                            }
                                        }}
                                        className="flex-1 px-3 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Reset QR
                                    </button>
                                )}
                            </div>
                            {/* Broadcast Section */}
                            {connected && (
                                <div className="mt-8 pt-6 border-t border-gray-100">
                                    <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                        </svg>
                                        Broadcast Otomatis
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleBroadcast('today')}
                                            disabled={loading}
                                            className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-medium transition-colors flex flex-col items-center gap-1 disabled:opacity-50"
                                        >
                                            <span className="font-bold">Hari Ini</span>
                                            <span className="text-[10px] opacity-75">{dayjs().format('DD/MM')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleBroadcast('tomorrow')}
                                            disabled={loading}
                                            className="px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-medium transition-colors flex flex-col items-center gap-1 disabled:opacity-50"
                                        >
                                            <span className="font-bold">Besok (H-1)</span>
                                            <span className="text-[10px] opacity-75">{dayjs().add(1, 'day').format('DD/MM')}</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 text-center">
                                        Mengirim pesan otomatis ke semua peserta yang relevan
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
