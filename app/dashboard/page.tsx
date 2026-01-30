"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import NavigationMenu from "@/components/NavigationMenu";
import ProfileDropdown from "@/components/ProfileDropdown";
import Landing from "@/components/Landing";
import Chatbot from "@/components/Chatbot";
import NotificationBell from "@/components/NotificationBell";

interface User {
    id: number;
    username: string;
    role: string;
    email?: string;
    full_name?: string;
}

interface Event {
    id: string;
    title: string;
    description?: string;
    schedule_date: string;
    schedule_time?: string;
    schedule_end_time?: string;
    target_role?: string;
    tujuan_jabatan?: string;
    creator_id?: number;
    creator_username?: string;
    creator_role?: string;
}

export default function Dashboard() {
    const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
    const [events, setEvents] = useState<Event[]>([]);
    const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
    const [activeFloating, setActiveFloating] = useState<'chatbot' | 'notif' | null>(null);
    const [refreshSignal, setRefreshSignal] = useState(0);
    const [readNotifIds, setReadNotifIds] = useState<Record<string, true>>({});
    const router = useRouter();

    // Load current user
    const loadCurrentUser = async () => {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await res.json();
            setCurrentUser(data.user || null);
        } catch (err) {
            setCurrentUser(null);
        }
    };

    // Load events
    const loadEvents = async () => {
        try {
            const res = await fetch("/api/schedule");
            if (!res.ok) {
                console.error("Failed to load events, status:", res.status);
                return;
            }
            const data = await res.json();
            setEvents(data);
        } catch (err) {
            console.error("Network error when loading events:", err);
        }
    };

    useEffect(() => {
        loadCurrentUser();
    }, []);

    useEffect(() => {
        if (currentUser) {
            loadEvents();
        }
    }, [currentUser]);

    // Load read-notification state
    useEffect(() => {
        if (!currentUser) return;
        try {
            const key = getNotifStorageKey(currentUser);
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : {};
            if (parsed && typeof parsed === 'object') {
                setReadNotifIds(parsed);
            } else {
                setReadNotifIds({});
            }
        } catch (e) {
            setReadNotifIds({});
        }
    }, [currentUser]);

    // Show landing page if user is not logged in
    if (currentUser === null) {
        return <Landing />;
    }

    // Show loading state while checking authentication
    if (currentUser === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    // Calculate statistics
    const today = dayjs().startOf('day');
    const totalEvents = events.length;

    const upcomingEvents = events.filter((ev) => {
        const evDate = dayjs(ev.schedule_date).startOf('day');
        return evDate.isSame(today) || evDate.isAfter(today);
    });

    const pastEvents = events.filter((ev) => {
        const evDate = dayjs(ev.schedule_date).startOf('day');
        return evDate.isBefore(today);
    });

    const todayEvents = events.filter((ev) => {
        const evDate = dayjs(ev.schedule_date).startOf('day');
        return evDate.isSame(today);
    });

    // Events by role
    const eventsByRole: Record<string, number> = {};
    events.forEach((ev) => {
        try {
            if (ev.tujuan_jabatan) {
                const raw = typeof ev.tujuan_jabatan === 'string'
                    ? JSON.parse(ev.tujuan_jabatan)
                    : ev.tujuan_jabatan;
                if (Array.isArray(raw)) {
                    raw.forEach((role: string) => {
                        eventsByRole[role] = (eventsByRole[role] || 0) + 1;
                    });
                }
            } else if (ev.target_role) {
                eventsByRole[ev.target_role] = (eventsByRole[ev.target_role] || 0) + 1;
            }
        } catch (e) {
            // ignore parse errors
        }
    });

    // Recent events (last 5)
    const recentEvents = [...events]
        .sort((a, b) => {
            const dateA = dayjs(a.schedule_date + " " + (a.schedule_time || "00:00"));
            const dateB = dayjs(b.schedule_date + " " + (b.schedule_time || "00:00"));
            return dateB.diff(dateA);
        })
        .slice(0, 5);

    // Notification logic (H-1)
    const getNotifStorageKey = (user: User | null) => `readNotifs_v1_${user?.id || 'guest'}`;

    const safeParseTujuanJabatan = (ev: Event): string[] => {
        try {
            if (!ev?.tujuan_jabatan) return [];
            const raw = typeof ev.tujuan_jabatan === 'string' ? JSON.parse(ev.tujuan_jabatan) : ev.tujuan_jabatan;
            return Array.isArray(raw) ? raw.map((x) => String(x)) : [];
        } catch (e) {
            return [];
        }
    };

    const isEventForCurrentUser = (ev: Event, user: User | null) => {
        if (!user) return false;
        if (ev?.creator_id && user?.id && Number(ev.creator_id) === Number(user.id)) return true;
        const role = String(user?.role || '').toLowerCase().trim();
        if (!role) return false;
        const roles = safeParseTujuanJabatan(ev).map((r) => String(r).toLowerCase().trim());
        if (roles.includes(role)) return true;
        const tr = String(ev?.target_role || '').toLowerCase().trim();
        return tr === role;
    };

    const buildNotifId = (ev: Event) => {
        return `${ev?.id || ''}|${ev?.schedule_date || ''}|${ev?.schedule_time || ''}|H-1`;
    };

    const normalizeDateStr = (d: string | Date) => {
        try {
            const dd = dayjs(d);
            if (!dd.isValid()) return '';
            return dd.format('YYYY-MM-DD');
        } catch (e) {
            return '';
        }
    };

    const besokStr = dayjs().add(1, 'day').format('YYYY-MM-DD');
    const notifItems = (events || [])
        .filter((ev: Event) => {
            try {
                const evDate = normalizeDateStr(ev?.schedule_date);
                return evDate === besokStr && currentUser && isEventForCurrentUser(ev, currentUser);
            } catch (e) {
                return false;
            }
        })
        .sort((a: Event, b: Event) => String(a?.schedule_time || '').localeCompare(String(b?.schedule_time || '')))
        .map((ev: Event) => {
            const tujuan = safeParseTujuanJabatan(ev);
            const tujuanText = tujuan.length > 0 ? tujuan.join(', ') : (ev?.target_role || '-');
            return {
                id: buildNotifId(ev),
                ev,
                title: ev?.title || '(tanpa judul)',
                time: ev?.schedule_time || '-',
                date: normalizeDateStr(ev?.schedule_date) || besokStr,
                tujuanText,
            };
        });

    const unreadCount = notifItems.filter((n) => !readNotifIds[n.id]).length;

    const markAllNotifsRead = () => {
        if (!currentUser) return;
        const next: Record<string, true> = { ...readNotifIds };
        notifItems.forEach((n) => { next[n.id] = true; });
        setReadNotifIds(next);
        try {
            localStorage.setItem(getNotifStorageKey(currentUser), JSON.stringify(next));
        } catch (e) { }
    };

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
            {/* Fixed Header */}
            <div className="flex-none p-3 md:p-4 lg:p-6 pb-0 bg-white shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between mb-3 gap-3">
                    <div className="text-center md:text-left flex items-center gap-3">
                        {/* Hamburger Menu Button */}
                        <button
                            onClick={() => setIsNavMenuOpen(true)}
                            className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
                            aria-label="Open Navigation Menu"
                        >
                            <svg className="w-6 h-6 text-gray-700 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
                            </svg>
                        </button>

                        <div>
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">SILVI</h1>
                            <p className="text-gray-500 text-xs">Sistem Informasi Jadwal & Kegiatan Secara Virtual</p>
                            <p className="text-gray-400 text-[10px]">Kelurahan Pulo Gebang, Jakarta Timur</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {currentUser && (
                            <ProfileDropdown
                                user={{
                                    username: currentUser.username,
                                    role: currentUser.role,
                                    email: currentUser.email
                                }}
                                onLogout={async () => {
                                    try {
                                        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                                    } catch (err) { }
                                    setCurrentUser(null);
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Dashboard Content */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Welcome Section */}
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            Selamat Datang, {currentUser.full_name || currentUser.username}!
                        </h2>
                        <p className="text-gray-600">
                            Berikut adalah ringkasan kegiatan dan statistik Anda
                        </p>
                    </div>

                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {/* Total Events */}
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium opacity-90">Total Kegiatan</h3>
                                <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                </svg>
                            </div>
                            <p className="text-4xl font-bold">{totalEvents}</p>
                        </div>

                        {/* Upcoming Events */}
                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium opacity-90">Kegiatan Mendatang</h3>
                                <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                                </svg>
                            </div>
                            <p className="text-4xl font-bold">{upcomingEvents.length}</p>
                        </div>

                        {/* Today's Events */}
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium opacity-90">Kegiatan Hari Ini</h3>
                                <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                            <p className="text-4xl font-bold">{todayEvents.length}</p>
                        </div>

                        {/* Past Events */}
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-medium opacity-90">Kegiatan Selesai</h3>
                                <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                            <p className="text-4xl font-bold">{pastEvents.length}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Events by Role */}
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                </svg>
                                Kegiatan per Jabatan
                            </h3>
                            <div className="space-y-3">
                                {Object.entries(eventsByRole).length > 0 ? (
                                    Object.entries(eventsByRole)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([role, count]) => (
                                            <div key={role} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <span className="font-medium text-gray-700 capitalize">{role}</span>
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                                                    {count} kegiatan
                                                </span>
                                            </div>
                                        ))
                                ) : (
                                    <p className="text-gray-500 text-center py-4">Belum ada data</p>
                                )}
                            </div>
                        </div>

                        {/* Recent Events */}
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                Kegiatan Terbaru
                            </h3>
                            <div className="space-y-3">
                                {recentEvents.length > 0 ? (
                                    recentEvents.map((ev) => (
                                        <div key={ev.id} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                            <h4 className="font-semibold text-gray-800 mb-1">{ev.title}</h4>
                                            <div className="flex items-center gap-3 text-xs text-gray-600">
                                                <span className="flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                                    </svg>
                                                    {dayjs(ev.schedule_date).format('DD MMM YYYY')}
                                                </span>
                                                {ev.schedule_time && (
                                                    <span className="flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                        </svg>
                                                        {ev.schedule_time}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-center py-4">Belum ada kegiatan</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Menu */}
            <NavigationMenu isOpen={isNavMenuOpen} onClose={() => setIsNavMenuOpen(false)} currentUser={currentUser} />

            {/* Chatbot floating */}
            <Chatbot
                events={events}
                refreshSignal={refreshSignal}
                isOpen={activeFloating === 'chatbot'}
                onToggle={(val) => setActiveFloating(val ? 'chatbot' : null)}
            />

            {/* Notifikasi floating */}
            {currentUser && (
                <NotificationBell
                    unreadCount={unreadCount}
                    items={notifItems}
                    onOpen={() => markAllNotifsRead()}
                    onSelectItem={(n: { date: string }) => router.push('/')}
                    isOpen={activeFloating === 'notif'}
                    onToggle={(val) => setActiveFloating(val ? 'notif' : null)}
                />
            )}
        </div>
    );
}
