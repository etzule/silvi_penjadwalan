"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import dayjs from "dayjs";

export default function EditScheduleForm({ event, onSaved, onCancel, events = [] }) {
    const [title, setTitle] = useState(event.title || "");
    const [description, setDescription] = useState(event.description || "");
    const [location, setLocation] = useState(event.location || "");
    const [scheduleDate, setScheduleDate] = useState(event.schedule_date || "");
    const [startTime, setStartTime] = useState(event.schedule_time || "");
    const [endTime, setEndTime] = useState(event.schedule_end_time || "");
    const [targetRoles, setTargetRoles] = useState(() => {
        try {
            if (event.tujuan_jabatan) {
                const parsed = JSON.parse(event.tujuan_jabatan);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Normalize legacy lowercase roles to Title Case
                    return parsed.map(r => {
                        if (r === 'lurah') return 'Lurah';
                        if (r === 'sekretaris kelurahan') return 'Sekretaris Kelurahan';
                        return r;
                    });
                }
                return ["Lurah"];
            }
        } catch (e) { }
        return ["Lurah"];
    });
    const [conflictError, setConflictError] = useState("");
    const [timeRangeError, setTimeRangeError] = useState("");
    const [customRoleInput, setCustomRoleInput] = useState("");
    const [keywordsInput, setKeywordsInput] = useState("");

    // Load keywords from local storage on mount
    useEffect(() => {
        try {
            if (event.schedule_date) {
                const dateStr = dayjs(event.schedule_date).format("YYYY-MM-DD");
                const key = `${dateStr}|${event.schedule_time || ''}|${event.title}`;
                const existing = JSON.parse(localStorage.getItem('eventKeywords') || '{}');
                if (existing[key]) {
                    setKeywordsInput(existing[key].join(', '));
                }
            }
        } catch (e) {
            console.error('Failed to load keywords', e);
        }
    }, [event]);

    const PRESET_ROLES = [
        "Lurah",
        "Sekretaris Kelurahan",
    ];

    const toggleRole = (role) => {
        setTargetRoles((prev) => {
            if (prev.includes(role)) {
                const next = prev.filter((r) => r !== role);
                return next.length === 0 ? prev : next;
            }
            return [...prev, role];
        });
    };

    const timeToMinutes = (time) => {
        if (!time) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };

    const checkTimeRangeOverlap = (start1, end1, start2, end2) => {
        const s1 = timeToMinutes(start1);
        const e1 = end1 ? timeToMinutes(end1) : s1;
        const s2 = timeToMinutes(start2);
        const e2 = end2 ? timeToMinutes(end2) : s2;

        // Two ranges overlap if: (start1 <= end2) AND (end1 >= start2)
        // Using <= and >= to include exact time matches
        return (s1 <= e2) && (e1 >= s2);
    };

    const checkConflict = () => {
        if (!startTime || !scheduleDate) return undefined;

        console.log('[EditScheduleForm] Checking conflicts for date:', scheduleDate, 'roles:', targetRoles);

        const conflict = events.find((e) => {
            if (e.id === event.id) return false; // Exclude current event

            try {
                const eventDate = dayjs(e.schedule_date).format("YYYY-MM-DD");
                if (eventDate !== scheduleDate) return false;

                const eventStart = e.schedule_time || "";
                const eventEnd = e.schedule_end_time || "";

                const timeOverlap = checkTimeRangeOverlap(
                    startTime, endTime || startTime,
                    eventStart, eventEnd || eventStart
                );

                console.log('[EditScheduleForm] Time overlap:', timeOverlap, 'for event:', e.title);

                // If time doesn't overlap, no conflict
                if (!timeOverlap) return false;

                // If time overlaps, check if target roles overlap
                // Parse tujuan_jabatan (JSON array) from existing event
                let eventRoles = [];
                try {
                    if (e.tujuan_jabatan) {
                        eventRoles = typeof e.tujuan_jabatan === 'string'
                            ? JSON.parse(e.tujuan_jabatan)
                            : (Array.isArray(e.tujuan_jabatan) ? e.tujuan_jabatan : []);
                    }

                    // Fallback to target_role if tujuan_jabatan is empty
                    if (eventRoles.length === 0 && e.target_role) {
                        eventRoles = [e.target_role];
                    }
                } catch {
                    // Fallback to target_role if parsing fails
                    if (e.target_role) {
                        eventRoles = [e.target_role];
                    }
                }

                console.log('[EditScheduleForm] Event roles:', eventRoles, 'Current roles:', targetRoles);

                // Check if there's any overlap between target roles
                const roleOverlap = targetRoles.some(role => eventRoles.includes(role));

                console.log('[EditScheduleForm] Role overlap:', roleOverlap);

                // Conflict only exists if BOTH time AND roles overlap
                return roleOverlap;
            } catch (err) {
                console.error('[EditScheduleForm] Error checking conflict:', err);
                return false;
            }
        });

        if (conflict) {
            console.log('[EditScheduleForm] CONFLICT FOUND:', conflict.title);
        }

        return conflict;
    };

    const submit = async () => {
        if (!title || !scheduleDate) {
            toast.error("Judul dan tanggal wajib diisi");
            return;
        }

        // Validate time range
        setTimeRangeError("");
        if (startTime && endTime) {
            if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
                const errorMsg = "Waktu selesai harus lebih besar dari waktu mulai";
                setTimeRangeError(errorMsg);
                toast.error(errorMsg);
                return;
            }
        }

        // Check for conflict
        setConflictError("");
        if (startTime) {
            const conflict = checkConflict();
            if (conflict) {
                const conflictTimeRange = conflict.schedule_end_time
                    ? `${conflict.schedule_time} - ${conflict.schedule_end_time}`
                    : conflict.schedule_time;
                const errorMsg = `Jadwal bentrok! Sudah ada kegiatan "${conflict.title}" pada waktu ${conflictTimeRange}.`;
                setConflictError(errorMsg);
                toast.error(errorMsg);
                return;
            }
        }

        let res;
        try {
            res = await fetch("/api/schedule", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({
                    id: event.id,
                    title,
                    description,
                    location: location || null,
                    schedule_date: scheduleDate,
                    schedule_time: startTime || null,
                    schedule_end_time: endTime || null,
                    target_role: targetRoles,
                }),
            });
        } catch (err) {
            console.error("Network error when updating schedule:", err);
            toast.error("Gagal update jadwal (koneksi ke server gagal)");
            return;
        }

        if (!res.ok) {
            try {
                const errorData = await res.json();
                if (errorData.conflict) {
                    setConflictError(errorData.message || "Jadwal bentrok dengan kegiatan lain");
                    toast.error(errorData.message || "Jadwal bentrok dengan kegiatan lain");
                } else {
                    toast.error(errorData.message || "Gagal update jadwal");
                }
            } catch (e) {
                toast.error("Gagal update jadwal");
            }
            return;
        }

        toast.success("Jadwal berhasil diupdate");

        // Update keywords in chatbot/local storage
        try {
            const kws = keywordsInput.split(',').map(s => s.trim()).filter(Boolean);
            if (kws.length > 0) {
                // Determine valid date string
                const dateStr = scheduleDate ? dayjs(scheduleDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');

                await fetch('/api/chatbot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keywords: kws, date: dateStr, title }),
                });
            }

            // Update local storage
            const dateStr = scheduleDate ? dayjs(scheduleDate).format("YYYY-MM-DD") : "";
            const key = `${dateStr}|${startTime || ''}|${title}`;

            // Note: If title/date/time changed, the old key is orphaned. That's acceptable for this simple implementation.
            const existing = JSON.parse(localStorage.getItem('eventKeywords') || '{}');
            existing[key] = kws;
            localStorage.setItem('eventKeywords', JSON.stringify(existing));
        } catch (e) {
            // ignore
        }

        onSaved();
    };

    return (
        <div className="space-y-4">
            <h2 className="font-semibold text-lg">Edit Jadwal</h2>

            <div>
                <label className="block text-sm text-gray-600 mb-1">Judul Kegiatan</label>
                <input
                    className="border p-2 w-full rounded"
                    placeholder="Judul kegiatan"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />
            </div>

            <div>
                <label className="block text-sm text-gray-600 mb-1">Tanggal</label>
                <input
                    type="date"
                    className="border p-2 w-full rounded"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                />
            </div>

            <div className="mb-2">
                <label className="block text-sm text-gray-600 mb-1">Waktu Kegiatan</label>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Jam Mulai</label>
                        <input
                            type="time"
                            className={`border p-2 w-full rounded ${conflictError || timeRangeError ? 'border-red-500' : ''}`}
                            value={startTime}
                            onChange={(e) => {
                                const newStartTime = e.target.value;
                                setStartTime(newStartTime);
                                setConflictError("");
                                setTimeRangeError("");

                                if (newStartTime && endTime && timeToMinutes(endTime) <= timeToMinutes(newStartTime)) {
                                    setTimeRangeError("Waktu selesai harus lebih besar dari waktu mulai");
                                }

                                if (newStartTime && scheduleDate) {
                                    const conflict = checkConflict();
                                    if (conflict) {
                                        const conflictTimeRange = conflict.schedule_end_time
                                            ? `${conflict.schedule_time} - ${conflict.schedule_end_time}`
                                            : conflict.schedule_time;
                                        setConflictError(`⚠️ Bentrok dengan "${conflict.title}" (${conflictTimeRange})`);
                                    }
                                }
                            }}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Jam Selesai (opsional)</label>
                        <input
                            type="time"
                            className={`border p-2 w-full rounded ${conflictError || timeRangeError ? 'border-red-500' : ''}`}
                            value={endTime}
                            onChange={(e) => {
                                const newEndTime = e.target.value;
                                setEndTime(newEndTime);
                                setConflictError("");
                                setTimeRangeError("");

                                if (startTime && newEndTime && timeToMinutes(newEndTime) <= timeToMinutes(startTime)) {
                                    setTimeRangeError("Waktu selesai harus lebih besar dari waktu mulai");
                                }

                                if (startTime && scheduleDate) {
                                    const conflict = checkConflict();
                                    if (conflict) {
                                        const conflictTimeRange = conflict.schedule_end_time
                                            ? `${conflict.schedule_time} - ${conflict.schedule_end_time}`
                                            : conflict.schedule_time;
                                        setConflictError(`⚠️ Bentrok dengan "${conflict.title}" (${conflictTimeRange})`);
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
                {timeRangeError && (
                    <p className="text-red-600 text-xs mt-1">{timeRangeError}</p>
                )}
                {conflictError && (
                    <p className="text-red-600 text-xs mt-1">{conflictError}</p>
                )}
            </div>

            <div>
                <label className="block text-sm text-gray-600 mb-1">Deskripsi</label>
                <textarea
                    className="border p-2 w-full rounded"
                    placeholder="Deskripsi"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                />
            </div>

            <div>
                <label className="block text-sm text-gray-600 mb-1">📍 Lokasi/Tempat (opsional)</label>
                <input
                    type="text"
                    className="border p-2 w-full rounded"
                    placeholder="Contoh: Kantor Kelurahan, Balai RW 05"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                />
            </div>

            <div className="mb-2">
                <label className="block text-sm text-gray-600 mb-1">Target Jabatan</label>
                <div className="border rounded p-2 space-y-2">
                    {/* Preset Roles */}
                    <div className="space-y-1">
                        {PRESET_ROLES.map((role) => (
                            <label key={role} className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={targetRoles.includes(role)}
                                    onChange={() => toggleRole(role)}
                                />
                                <span>{role}</span>
                            </label>
                        ))}
                    </div>

                    <div className="mt-4 pt-3 border-t">
                        <label className="block text-xs text-gray-500 mb-1">Jabatan Tambahan (Custom)</label>
                        <div className="flex gap-2 mb-2">
                            <input
                                value={customRoleInput}
                                onChange={(e) => setCustomRoleInput(e.target.value)}
                                placeholder="Ketik jabatan lain..."
                                className="border p-1 text-sm flex-1 rounded"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (customRoleInput.trim()) {
                                            const newRole = customRoleInput.trim();
                                            if (!targetRoles.includes(newRole)) {
                                                setTargetRoles([...targetRoles, newRole]);
                                            }
                                            setCustomRoleInput("");
                                        }
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    if (customRoleInput.trim()) {
                                        const newRole = customRoleInput.trim();
                                        if (!targetRoles.includes(newRole)) {
                                            setTargetRoles([...targetRoles, newRole]);
                                        }
                                        setCustomRoleInput("");
                                    }
                                }}
                                className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700"
                            >
                                +
                            </button>
                        </div>

                        {/* Selected Custom Roles Display */}
                        <div className="flex flex-wrap gap-1">
                            {targetRoles
                                .filter(r => !PRESET_ROLES.includes(r))
                                .map(role => (
                                    <span key={role} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                        {role}
                                        <button
                                            onClick={() => toggleRole(role)}
                                            className="hover:text-red-500 font-bold"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-2">
                <label className="block text-sm text-gray-600 mb-1">Keywords (pisahkan koma)</label>
                <input
                    value={keywordsInput}
                    onChange={e => setKeywordsInput(e.target.value)}
                    placeholder="contoh: rapat, vaksin"
                    className="border p-2 w-full rounded"
                />
            </div>

            <div className="flex gap-2">
                <button
                    onClick={submit}
                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
                >
                    Simpan Perubahan
                </button>
                <button
                    onClick={onCancel}
                    className="px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
                >
                    Batal
                </button>
            </div>
        </div>
    );
}
