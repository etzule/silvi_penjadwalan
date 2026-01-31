"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Image from 'next/image';

interface User {
    id: number;
    username: string;
    role: string;
    email?: string;
}

interface LandingPageProps {
    currentUser?: User | null;
}

export default function Landing({ currentUser }: LandingPageProps) {
    const router = useRouter();


    const handleLoginClick = () => {
        router.push('/login');
    };

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Hero Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/kantor-kelurahan.jpg"
                    alt="Kantor Kelurahan"
                    fill
                    className="object-cover"
                    priority
                    quality={100}
                />
                {/* Gradient Overlays for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/85 via-indigo-900/80 to-purple-900/85"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
            </div>

            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full mix-blend-overlay filter blur-3xl animate-blob"></div>
                <div className="absolute top-40 right-10 w-72 h-72 bg-purple-500/10 rounded-full mix-blend-overlay filter blur-3xl animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-20 left-1/2 w-72 h-72 bg-indigo-500/10 rounded-full mix-blend-overlay filter blur-3xl animate-blob animation-delay-4000"></div>
            </div>

            {/* Navigation Bar */}
            <nav className="relative z-20 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                        <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-lg">SILVI</h2>
                        <p className="text-white/70 text-xs">Sistem Informasi Jadwal & Kegiatan Secara Virtual</p>
                        <p className="text-white/70 text-[10px] sm:text-xs font-light">Kelurahan Pulo Gebang, Jakarta Timur</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        if (currentUser) {
                            router.push('/home');
                        } else {
                            handleLoginClick();
                        }
                    }}
                    className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-xl transition-all font-medium shadow-lg backdrop-blur-md hover:scale-105 transform duration-200"
                >
                    Masuk
                </button>
            </nav>

            {/* Main Hero Content */}
            <div className="relative z-20 min-h-[calc(100vh-80px)] flex items-center justify-center px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center space-y-8">
                        {/* Main Heading */}
                        <div className="space-y-4 animate-fade-in">
                            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight">
                                Kelola Jadwal
                                <span className="block bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent">
                                    Lebih Mudah
                                </span>
                            </h1>
                            <p className="text-xl md:text-2xl text-white/90 font-light max-w-3xl mx-auto leading-relaxed">
                                Sistem informasi terintegrasi untuk mengelola jadwal dan kegiatan virtual kelurahan dengan efisien
                            </p>
                        </div>

                        {/* Feature Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 animate-slide-up">
                            {/* Card 1 */}
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl group">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-semibold text-lg mb-2">Penjadwalan Cerdas</h3>
                                <p className="text-white/70 text-sm">Atur dan kelola jadwal kegiatan dengan mudah dan terorganisir</p>
                            </div>

                            {/* Card 2 */}
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl group">
                                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-semibold text-lg mb-2">Notifikasi Otomatis</h3>
                                <p className="text-white/70 text-sm">Dapatkan pengingat otomatis untuk setiap kegiatan penting</p>
                            </div>

                            {/* Card 3 */}
                            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl group">
                                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <h3 className="text-white font-semibold text-lg mb-2">Laporan Lengkap</h3>
                                <p className="text-white/70 text-sm">Export dan analisis data kegiatan dengan mudah</p>
                            </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 animate-slide-up animation-delay-200">
                            <button
                                onClick={() => {
                                    if (currentUser) {
                                        router.push('/home');
                                    } else {
                                        handleLoginClick();
                                    }
                                }}
                                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-lg shadow-2xl hover:shadow-blue-500/50 transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                            >
                                <span>Atur Jadwal</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-20 pb-6 text-center">
                <p className="text-white/60 text-sm">
                    © 2026 Sistem Informasi Jadwal & Kegiatan Secara Virtual
                    <br />
                    <span className="text-xs">Kelurahan Pulo Gebang, Jakarta Timur</span>
                </p>
            </div>



            <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animation-delay-200 {
          animation-delay: 0.3s;
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out 0.2s both;
        }
      `}</style>
        </div>
    );
}
