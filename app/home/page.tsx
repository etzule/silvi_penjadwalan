"use client";

import React, { useEffect, useRef, useState } from "react";
import Calendar from "@/components/Calendar";
import ScheduleForm from "@/components/ScheduleForm";
import EditScheduleForm from "@/components/EditScheduleForm";
import AuthPanel from "@/components/AuthPanel";
import dayjs, { Dayjs } from "dayjs";
import { Toaster } from "react-hot-toast";
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Chatbot from '@/components/Chatbot';
import NotificationBell from "@/components/NotificationBell";
import MiniCalendar from "@/components/MiniCalendar";
import UpcomingEvents from "@/components/UpcomingEvents";
import ProfileDropdown from "@/components/ProfileDropdown";
import NavigationMenu from "@/components/NavigationMenu";
import WhatsAppSender from "@/components/WhatsAppSender";

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
}

import WhatsAppButton from "@/components/WhatsAppButton";
import EmailPushButton from "@/components/EmailPushButton";

export default function Home() {
    // undefined = not loaded yet; null = loaded and no user; object = user
    const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);
    const [events, setEvents] = useState<Event[]>([]);
    const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
    const [showNotifPrompt, setShowNotifPrompt] = useState(false);
    const [reminderActive, setReminderActive] = useState(false);
    const reminderInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const [refreshSignal, setRefreshSignal] = useState(0);
    const [viewDate, setViewDate] = useState<Dayjs>(dayjs());
    const [isAddEventOpen, setIsAddEventOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | null>(null);
    const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);

    // Resize Sidebar state
    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const router = useRouter();

    const startResizing = React.useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = React.useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = React.useCallback(
        (mouseMoveEvent: MouseEvent) => {
            if (isResizing) {
                const newWidth = mouseMoveEvent.clientX - (sidebarRef.current?.getBoundingClientRect().left || 0);
                if (newWidth > 200 && newWidth < 600) {
                    setSidebarWidth(newWidth);
                }
            }
        },
        [isResizing]
    );

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [resize, stopResizing]);

    // In-app notifications (H-1)
    const [notifOpen, setNotifOpen] = useState(false);
    const [readNotifIds, setReadNotifIds] = useState<Record<string, true>>({});
    const [activeFloating, setActiveFloating] = useState<'chatbot' | 'notif' | null>(null);

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
        // creator always sees
        if (ev?.creator_id && user?.id && Number(ev.creator_id) === Number(user.id)) return true;
        const role = String(user?.role || '').toLowerCase().trim();
        if (!role) return false;
        // multi-role JSON column
        const roles = safeParseTujuanJabatan(ev).map((r) => String(r).toLowerCase().trim());
        if (roles.includes(role)) return true;
        // fallback single column
        const tr = String(ev?.target_role || '').toLowerCase().trim();
        return tr === role;
    };

    const buildNotifId = (ev: Event) => {
        // unique and stable enough: id + date + time + type
        const d = normalizeDateStr(ev.schedule_date);
        const today = dayjs().format('YYYY-MM-DD');
        const type = d === today ? 'H-0' : 'H-1';
        return `${ev?.id || ''}|${ev?.schedule_date || ''}|${ev?.schedule_time || ''}|${type}`;
    };

    const normalizeDateStr = (d: string | Date | Dayjs) => {
        try {
            const dd = dayjs(d);
            if (!dd.isValid()) return '';
            return dd.format('YYYY-MM-DD');
        } catch (e) {
            return '';
        }
    };

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

    // load current user (if logged in) on mount
    const loadCurrentUser = async () => {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await res.json();
            const user = data.user || null;
            setCurrentUser(user);

            if (!user) {
                // if no user, render loading or redirect? 
                // For now, if undefined, we show loading. If null, we might want to redirect.
                // Let's rely on the render check.
            }
        } catch (err) {
            setCurrentUser(null);
        }
    };

    useEffect(() => {
        loadCurrentUser();
    }, []);

    // load read-notification state for this user
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

    // Load events and setup notifications only if user is logged in
    useEffect(() => {
        if (!currentUser) return; // Don't load if user is not logged in

        loadEvents();

        // NOTIFIKASI H-1 (CLIENT SIDE REMOVED)
        // Kita matikan trigger dari browser agar tidak ada notifikasi spam/duplikat.
        // Notifikasi H-1 sekarang 100% dihandle oleh Server Cron (jam 17:00 & 20:00).

        // --- Scheduled Notification Polling (Cron Trigger) ---
        // Panggil endpoint check setiap 60 detik untuk trigger automasi server-side
        const cronInterval = setInterval(() => {
            fetch('/api/cron/check')
                .then(res => res.json())
                .then(data => {
                    if (data.results && Array.isArray(data.results)) {
                        console.log('Scheduled Notification Triggered:', data.results);
                        loadEvents(); // Refresh UI jika ada notif terkirim
                    }
                })
                .catch(err => console.error('Cron check failed:', err));
        }, 60000);

        return () => {
            clearInterval(cronInterval);
        };
    }, [currentUser]);

    const todayStr = dayjs().format('YYYY-MM-DD');
    const besokStr = dayjs().add(1, 'day').format('YYYY-MM-DD');

    const notifItems = (events || [])
        .filter((ev: Event) => {
            try {
                const evDate = normalizeDateStr(ev?.schedule_date);
                return (evDate === besokStr || evDate === todayStr) && currentUser && isEventForCurrentUser(ev, currentUser);
            } catch (e) {
                return false;
            }
        })
        .sort((a: Event, b: Event) => {
            // Sort by date then time
            const dateA = normalizeDateStr(a?.schedule_date);
            const dateB = normalizeDateStr(b?.schedule_date);
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return String(a?.schedule_time || '').localeCompare(String(b?.schedule_time || ''));
        })
        .map((ev: Event) => {
            const tujuan = safeParseTujuanJabatan(ev);
            const tujuanText = tujuan.length > 0 ? tujuan.join(', ') : (ev?.target_role || '-');
            const d = normalizeDateStr(ev?.schedule_date);
            const isToday = d === todayStr;

            return {
                id: buildNotifId(ev),
                ev,
                title: ev?.title || '(tanpa judul)',
                time: ev?.schedule_time || '-',
                date: d,
                tujuanText,
                type: isToday ? 'today' : 'tomorrow'
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


    // show notification permission prompt on first visit
    useEffect(() => {
        // only run in browser
        try {
            if (typeof window !== 'undefined' && 'Notification' in window) {
                const answered = localStorage.getItem("notifPromptAnswered");
                // Always show prompt if permission is default (not granted/denied) and not answered
                if (Notification.permission === 'default' && !answered) {
                    setShowNotifPrompt(true);
                }
            }
        } catch (err) {
            // ignore
        }
    }, []);

    useEffect(() => {
        // cleanup on unmount
        return () => {
            if (reminderInterval.current) clearInterval(reminderInterval.current);
        };
    }, []);

    // if permission already granted (user previously allowed), start reminders automatically
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (!("Notification" in window)) return;

        try {
            const answered = localStorage.getItem("notifPromptAnswered");
            if (Notification.permission === "granted" && !reminderActive) {
                // if user previously accepted or permission is granted, start reminders
                if (answered === "yes" || answered === null) {
                    startReminders();
                }
            }
        } catch (err) {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [events]);

    const sendReminders = () => {
        if (!events || events.length === 0) return;
        const now = dayjs();

        const matched = events.filter((ev: Event) => {
            try {
                const d = dayjs(ev.schedule_date);
                const diff = d.startOf("day").diff(now.startOf("day"), "day");
                return diff === 3 || diff === 1;
            } catch (err) {
                return false;
            }
        });

        if (matched.length === 0) return;

        matched.forEach((ev: Event) => {
            const title = `Reminder: ${ev.title}`;
            const body = `${ev.schedule_time || "(waktu belum diatur)"} — ${ev.description || ""}`;

            // show browser notification if permitted
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                try {
                    new Notification(title, { body });
                } catch (err) {
                    // fallback to toast
                    // do nothing here
                }
            }

            // also show an in-app toast if available
            try {
                // lazy require react-hot-toast to avoid SSR issues
                // eslint-disable-next-line global-require
                const toast = (require("react-hot-toast").default as any);
                toast(`🔔 ${title} — ${ev.schedule_time || "(waktu)"}`);
            } catch (err) {
                // ignore
            }
        });
    };

    const startReminders = () => {
        // prevent double-start
        if (reminderInterval.current) return;

        // run immediately then every 5 minutes
        sendReminders();
        reminderInterval.current = setInterval(sendReminders, 5 * 60 * 1000) as ReturnType<typeof setInterval>;
        setReminderActive(true);
    };

    const stopReminders = () => {
        if (reminderInterval.current) {
            clearInterval(reminderInterval.current);
            reminderInterval.current = null;
        }
        setReminderActive(false);
    };

    const handleNotifAnswer = async (allow: boolean) => {
        try {
            localStorage.setItem("notifPromptAnswered", allow ? "yes" : "no");
        } catch (err) { }

        setShowNotifPrompt(false);

        if (allow) {
            // request permission
            if (typeof window !== "undefined" && "Notification" in window) {
                const perm = await Notification.requestPermission();
                if (perm === "granted") {
                    startReminders();
                }
                // If denied, do nothing (user can allow later via browser settings)
            }
        }
    };

    // Check authentication
    useEffect(() => {
        if (currentUser === null) {
            router.push('/login');
        }
    }, [currentUser, router]);

    // Show loading state or null if redirecting
    if (currentUser === null) {
        return null;
    }

    // Show loading state while checking authentication
    if (currentUser === undefined) {
        return (
            <>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-gray-500">Loading...</div>
                </div>
            </>
        );
    }

    // Show dashboard if user is logged in
    return (
        <div className="flex flex-col h-screen overflow-hidden">
            <Toaster position="top-right" />

            {/* Fixed Header */}
            <div className="flex-none p-3 md:p-4 lg:p-6 pb-0">
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
                        <button
                            className="px-2.5 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                            onClick={async () => {
                                const month = viewDate.month() + 1;
                                const year = viewDate.year();
                                const res = await fetch(`/api/export?month=${month}&year=${year}`);
                                if (res.ok) {
                                    const blob = await res.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `Rekap-Kegiatan-${month}-${year}.xlsx`;
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                } else {
                                    toast.error('Gagal export Excel');
                                }
                            }}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            Export Excel
                        </button>

                        {/* WhatsApp Button - Admin Only */}
                        {currentUser && currentUser.role === 'admin' && (
                            <>
                                <WhatsAppButton />
                                <EmailPushButton />
                            </>
                        )}

                        {/* Bulk Delete Button - Admin Only */}
                        {currentUser && currentUser.role === 'admin' && (
                            <button
                                className="px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-xs font-medium transition-colors flex items-center gap-1.5"
                                onClick={async () => {
                                    const month = viewDate.month() + 1;
                                    const year = viewDate.year();
                                    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

                                    const confirmed = confirm(
                                        `⚠️ PERINGATAN!\n\nAnda akan menghapus SEMUA kegiatan pada bulan ${monthNames[month - 1]} ${year}.\n\nTindakan ini TIDAK DAPAT dibatalkan!\n\nApakah Anda yakin?`
                                    );

                                    if (!confirmed) return;

                                    // Double confirmation
                                    const doubleConfirm = confirm(
                                        `Konfirmasi terakhir!\n\nApakah Anda BENAR-BENAR yakin ingin menghapus semua kegiatan pada ${monthNames[month - 1]} ${year}?`
                                    );

                                    if (!doubleConfirm) return;

                                    try {
                                        const res = await fetch(`/api/schedule/bulk-delete?month=${month}&year=${year}`, {
                                            method: 'DELETE',
                                            credentials: 'include'
                                        });

                                        const data = await res.json();

                                        if (res.ok && data.success) {
                                            toast.success(data.message);
                                            loadEvents(); // Refresh events
                                        } else {
                                            toast.error(data.message || 'Gagal menghapus kegiatan');
                                        }
                                    } catch (err) {
                                        console.error('Error deleting schedules:', err);
                                        toast.error('Terjadi kesalahan saat menghapus kegiatan');
                                    }
                                }}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                                Hapus Semua
                            </button>
                        )}

                        {/* Auth area */}
                        {currentUser ? (
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
                                    router.push('/'); // Redirect to landing
                                }}
                            />
                        ) : (
                            <AuthPanel initialMode="login" onAuth={(user: User) => { setCurrentUser(user); }} onRegistered={() => { /* no-op */ }} />
                        )}
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-hidden px-3 md:px-4 lg:px-6 pb-3 md:pb-4 lg:pb-6">
                <div className="flex flex-col lg:flex-row gap-0 lg:gap-0 h-full">
                    {/* Left Sidebar - Independent Scroll & Resizable */}
                    <div
                        ref={sidebarRef}
                        className="resizable-sidebar flex flex-col w-full lg:w-[var(--sidebar-width)] lg:flex-none gap-3 overflow-y-auto custom-scrollbar pr-2 pb-2 lg:pb-0"
                        style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
                    >
                        {/* Sidebar Header */}
                        <div className="flex items-center gap-2 text-blue-700 px-1 flex-none">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            <span className="font-bold text-base">Penjadwalan</span>
                        </div>

                        <MiniCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} events={events} />

                        <UpcomingEvents events={events} />
                    </div>

                    {/* Resizer Handle (Desktop Only) */}
                    <div
                        className="resizer-handle w-4 -ml-2 z-10 cursor-col-resize hidden lg:flex items-center justify-center group hover:scale-x-110 transition-transform select-none"
                        onMouseDown={startResizing}
                    >
                        {/* Visual line */}
                        <div className="w-1 h-full bg-gray-100 group-hover:bg-blue-400 rounded transition-colors" />
                    </div>

                    {/* Right Calendar - Independent Scroll */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pl-2">
                        {/* Welcome Section */}
                        <div className="mb-4 pt-1">
                            <h2 className="text-xl font-bold text-gray-800">
                                Selamat Datang, {currentUser?.full_name || currentUser?.username}!
                            </h2>
                            <p className="text-sm text-gray-500">
                                Berikut adalah jadwal kegiatan di Kelurahan Pulo Gebang.
                            </p>
                        </div>

                        <Calendar
                            events={events}
                            onSelectDate={setSelectedDate}
                            selectedDate={selectedDate}
                            onDeleted={loadEvents}
                            onEdit={(event) => setEditingEvent(event)}
                            currentUser={currentUser}
                            onViewChange={setViewDate}
                        />
                    </div>
                </div>
            </div>

            {/* Add Event Modal */}
            {isAddEventOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeInScale relative max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between flex-none">
                            <h3 className="font-bold text-lg text-gray-800">Tambah Jadwal Baru</h3>
                            <button onClick={() => setIsAddEventOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <ScheduleForm
                                selectedDate={selectedDate}
                                events={events}
                                // @ts-ignore
                                currentUser={currentUser}
                                onSaved={() => {
                                    loadEvents();
                                    setRefreshSignal(s => s + 1);
                                    setIsAddEventOpen(false); // Close on save
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Event Modal */}
            {editingEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeInScale relative max-h-[90vh] flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between flex-none">
                            <h3 className="font-bold text-lg text-gray-800">Edit Jadwal</h3>
                            <button onClick={() => setEditingEvent(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <EditScheduleForm
                                event={editingEvent}
                                events={events}
                                onSaved={() => {
                                    loadEvents();
                                    setRefreshSignal(s => s + 1);
                                    setEditingEvent(null);
                                }}
                                onCancel={() => setEditingEvent(null)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Chatbot floating */}
            <Chatbot
                events={events}
                refreshSignal={refreshSignal}
                isOpen={activeFloating === 'chatbot'}
                onToggle={(val) => setActiveFloating(val ? 'chatbot' : null)}
            />

            {/* Notifikasi floating */}
            {
                currentUser && (
                    <NotificationBell
                        unreadCount={unreadCount}
                        items={notifItems}
                        onOpen={() => markAllNotifsRead()}
                        onSelectItem={(n: { date: string }) => setSelectedDate(dayjs(n.date))}
                        isOpen={activeFloating === 'notif'}
                        onToggle={(val) => setActiveFloating(val ? 'notif' : null)}
                    />
                )
            }

            {/* Floating Tambah Jadwal Button - Center Bottom */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 group">
                <button
                    onClick={() => setIsAddEventOpen(true)}
                    className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 relative"
                    aria-label="Tambah Jadwal"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>

                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                        Tambah Jadwal
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                </button>
            </div>

            {/* blocking notification permission prompt shown on first visit */}
            {
                showNotifPrompt && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                        <div className="bg-white rounded p-6 w-full max-w-md">
                            <h2 className="text-lg font-semibold mb-2">Izin Notifikasi</h2>
                            {typeof window !== "undefined" && "Notification" in window ? (
                                Notification.permission === "denied" ? (
                                    <>
                                        <p className="text-sm text-gray-600 mb-4">Anda telah memblokir notifikasi untuk situs ini pada browser. Untuk mengaktifkan kembali, buka pengaturan situs (ikon gembok di address bar) dan izinkan notifikasi, lalu kembali ke halaman ini.</p>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setShowNotifPrompt(false)}
                                                className="px-4 py-2 rounded border"
                                            >
                                                Tutup
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm text-gray-600 mb-4">Aplikasi ingin mengirim pengingat untuk kegiatan Anda (H-3 dan H-1). Izinkan notifikasi?</p>

                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleNotifAnswer(false)}
                                                className="px-4 py-2 rounded border"
                                            >
                                                Tidak
                                            </button>
                                            <button
                                                onClick={() => handleNotifAnswer(true)}
                                                className="px-4 py-2 rounded bg-blue-600 text-white"
                                            >
                                                Ya
                                            </button>
                                        </div>
                                    </>
                                )
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600 mb-4">Browser Anda tidak mendukung Notification API.</p>
                                    <div className="flex justify-end">
                                        <button onClick={() => setShowNotifPrompt(false)} className="px-4 py-2 rounded border">Tutup</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Navigation Menu */}
            <NavigationMenu isOpen={isNavMenuOpen} onClose={() => setIsNavMenuOpen(false)} currentUser={currentUser} />

        </div>
    );
}
