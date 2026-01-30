"use client";

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

export default function WhatsAppSender() {
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
                // Generate QR code image from string
                const qrUrl = await QRCode.toDataURL(data.qrCode);
                setQrCodeUrl(qrUrl);
            } else {
                setQrCodeUrl(null);
            }
        } catch (error) {
            console.error('Error checking status:', error);
            toast.error('Gagal memeriksa status WhatsApp');
        } finally {
            setCheckingStatus(false);
        }
    };

    // Check status when popup opens
    useEffect(() => {
        if (isOpen) {
            checkStatus();
            // Auto-refresh status every 5 seconds when popup is open
            const interval = setInterval(checkStatus, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

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

    return (
        <>
            {/* Floating WhatsApp Button - Bottom Right */}
            <div className="fixed bottom-6 right-6 z-50">
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 group relative"
                    aria-label="Kirim WhatsApp"
                >
                    {/* WhatsApp Icon */}
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>

                    {/* Connection Status Indicator */}
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${connected ? 'bg-green-400' : 'bg-red-400'}`} />

                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 right-0 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                        Kirim WhatsApp
                        <div className="absolute top-full right-4 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                </button>
            </div>

            {/* WhatsApp Form Popup */}
            {isOpen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeInScale">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 flex items-center justify-between">
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
                        <div className="p-6">
                            {/* QR Code Section */}
                            {!connected && qrCodeUrl && (
                                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-800 mb-3 font-medium">
                                        📱 Scan QR Code untuk menghubungkan WhatsApp
                                    </p>
                                    <div className="flex justify-center">
                                        <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 border-4 border-white shadow-lg rounded-lg" />
                                    </div>
                                    <p className="text-xs text-yellow-700 mt-3 text-center">
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

                            {/* Refresh Button */}
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
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
