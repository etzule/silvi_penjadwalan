"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import dayjs from "dayjs";

export default function ScheduleForm({ selectedDate, onSaved, events = [], currentUser }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [targetRoles, setTargetRoles] = useState(["Lurah"]);
  const [scheduleForId, setScheduleForId] = useState(""); // For Admin to select user
  const [availableUsers, setAvailableUsers] = useState([]); // List of users
  const [keywordsInput, setKeywordsInput] = useState('');
  const [conflictError, setConflictError] = useState("");
  const [timeRangeError, setTimeRangeError] = useState("");
  const [customRoleInput, setCustomRoleInput] = useState("");

  const PRESET_ROLES = [
    "Lurah",
    "Sekretaris Kelurahan",
  ];

  const toggleRole = (role) => {
    setTargetRoles((prev) => {
      if (prev.includes(role)) {
        const next = prev.filter((r) => r !== role);
        // minimal safeguard: always keep at least one role selected
        return next.length === 0 ? prev : next;
      }
      return [...prev, role];
    });
  };

  // Fetch users if Admin
  useState(() => {
    if (currentUser?.role === 'admin') {
      fetch('/api/users')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setAvailableUsers(data);
          }
        })
        .catch(err => console.error('Failed to load users:', err));
    }
  }, [currentUser]);

  // Helper function to convert time string to minutes
  const timeToMinutes = (time) => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Check if two time ranges overlap
  const checkTimeRangeOverlap = (start1, end1, start2, end2) => {
    const s1 = timeToMinutes(start1);
    const e1 = end1 ? timeToMinutes(end1) : s1;
    const s2 = timeToMinutes(start2);
    const e2 = end2 ? timeToMinutes(end2) : s2;

    // Two ranges overlap if: (start1 <= end2) AND (end1 >= start2)
    // Using <= and >= to include exact time matches
    return (s1 <= e2) && (e1 >= s2);
  };

  // Centralized conflict checking logic
  const findConflictingEvent = (checkStartTime, checkEndTime) => {
    if (!checkStartTime || !selectedDate) return undefined;

    const selectedDateStr = selectedDate.format("YYYY-MM-DD");

    return events.find((e) => {
      try {
        const eventDate = dayjs(e.schedule_date).format("YYYY-MM-DD");
        if (eventDate !== selectedDateStr) return false;

        // Check for time range overlap
        const eventStart = e.schedule_time || "";
        const eventEnd = e.schedule_end_time || "";

        const timeOverlap = checkTimeRangeOverlap(
          checkStartTime, checkEndTime || checkStartTime,
          eventStart, eventEnd || eventStart
        );

        if (!timeOverlap) return false;

        // If time overlaps, check ownership
        // Backend logic: Overlap is allowed if creator is different
        if (currentUser && e.creator_id) {
          // Determine the "effective" creator of the NEW event being scheduled
          // If Admin selected a user, THAT user is the creator.
          // Otherwise, the current user is the creator.
          const effectiveCreatorId = scheduleForId ? Number(scheduleForId) : Number(currentUser.id);

          // Loose equality (==) to handle potential string/number mismatch
          const isSameUser = Number(e.creator_id) === effectiveCreatorId;

          if (isSameUser) {
            console.log('[ScheduleForm] Conflict detected: Same user overlap', e.title);
            return true;
          }
          // Different user -> Allow overlap
          return false;
        }

        // If we can't verify ownership (e.g. data missing), fallback to stricter check
        console.log('[ScheduleForm] Fallback conflict check (missing user info)');
        return true;
      } catch (err) {
        console.error('[ScheduleForm] Error checking conflict:', err);
        return false;
      }
    });
  };

  const submit = async () => {
    if (!title || !selectedDate) {
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

    // Check for conflict in frontend
    setConflictError("");
    if (startTime) {
      const conflict = findConflictingEvent(startTime, endTime);
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          title,
          description,
          location: location || null,
          schedule_date: selectedDate.format("YYYY-MM-DD"),
          schedule_time: startTime || null,
          schedule_end_time: endTime || null,
          // send as array; backend akan mengubah ke string untuk disimpan
          target_role: targetRoles,
          keywords: keywordsInput.split(',').map(s => s.trim()).filter(Boolean),
          creator_id: scheduleForId || null,
        }),
      });
    } catch (err) {
      console.error("Network error when saving schedule:", err);
      toast.error("Gagal menyimpan jadwal (koneksi ke server gagal)");
      return;
    }

    if (!res.ok) {
      try {
        const errorData = await res.json();
        if (errorData.conflict) {
          setConflictError(errorData.message || "Jadwal bentrok dengan kegiatan lain");
          toast.error(errorData.message || "Jadwal bentrok dengan kegiatan lain");
        } else {
          toast.error(errorData.message || "Gagal menyimpan jadwal");
        }
      } catch (e) {
        toast.error("Gagal menyimpan jadwal");
      }
      return;
    }

    toast.success("Jadwal tersimpan");
    // register keywords to server-side chatbot storage (best-effort)
    try {
      const kws = keywordsInput.split(',').map(s => s.trim()).filter(Boolean);
      if (kws.length > 0) {
        await fetch('/api/chatbot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keywords: kws, date: selectedDate.format('YYYY-MM-DD'), title }), });
      }

      // also store locally for immediate access by client chatbot
      const key = `${selectedDate.format("YYYY-MM-DD")}|${startTime || ''}|${title}`;
      const existing = JSON.parse(localStorage.getItem('eventKeywords') || '{}');
      existing[key] = keywordsInput.split(',').map(s => s.trim()).filter(Boolean);
      localStorage.setItem('eventKeywords', JSON.stringify(existing));
    } catch (e) {
      // ignore
    }

    onSaved();
    setTitle("");
    setDescription("");
    setLocation("");
    setStartTime("");
    setEndTime("");
    setTargetRoles(["Lurah"]);
    setKeywordsInput('');
    setConflictError("");
    setTimeRangeError("");
  };

  return (
    <div className="">
      <h2 className="font-semibold mb-2">Tambah Jadwal</h2>

      <p className="text-sm text-gray-500 mb-2">
        Tanggal: {selectedDate.format("DD MMMM YYYY")}
      </p>

      {/* Admin "Schedule For" Selection */}
      {currentUser?.role === 'admin' && (
        <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
          <label className="block text-xs font-bold text-yellow-800 mb-1">
            ⚠️ Mode Admin: Buat Jadwal Atas Nama
          </label>
          <select
            className="w-full border p-1 rounded text-sm"
            value={scheduleForId}
            onChange={(e) => setScheduleForId(e.target.value)}
          >
            <option value="">-- Diri Sendiri (Admin) --</option>
            {availableUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.username} ({u.role})
              </option>
            ))}
          </select>
          <p className="text-[10px] text-gray-500 mt-1">
            *Jika memilih orang lain, jadwal tidak akan bentrok dengan jadwal Admin sendiri.
          </p>
        </div>
      )}

      <input
        className="border p-2 w-full rounded mb-2"
        placeholder="Judul kegiatan"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

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

                // Validate time range
                if (newStartTime && endTime && timeToMinutes(endTime) <= timeToMinutes(newStartTime)) {
                  setTimeRangeError("Waktu selesai harus lebih besar dari waktu mulai");
                }

                // Real-time conflict check
                if (newStartTime && selectedDate) {
                  const conflict = findConflictingEvent(newStartTime, endTime);
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

                // Validate time range
                if (startTime && newEndTime && timeToMinutes(newEndTime) <= timeToMinutes(startTime)) {
                  setTimeRangeError("Waktu selesai harus lebih besar dari waktu mulai");
                }

                // Real-time conflict check
                if (startTime && selectedDate) {
                  const conflict = findConflictingEvent(startTime, newEndTime);
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

      <textarea
        className="border p-2 w-full rounded mb-2"
        placeholder="Deskripsi"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="mb-2">
        <label className="block text-sm text-gray-600 mb-1">📍 Lokasi/Tempat (opsional)</label>
        <input
          type="text"
          className="border p-2 w-full rounded"
          placeholder="Contoh: Kantor Kelurahan, Balai RW 05, Lapangan Desa"
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

            {/* Selected Custom Roles Display (exclude presets) */}
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
        <input value={keywordsInput} onChange={e => setKeywordsInput(e.target.value)} placeholder="contoh: rapat, vaksin" className="border p-2 w-full rounded" />
      </div>

      <button
        onClick={submit}
        className="bg-blue-600 text-white w-full py-2 rounded"
      >
        Simpan
      </button>
    </div>
  );
}
