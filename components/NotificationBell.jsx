"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";

export default function NotificationBell({
  unreadCount = 0,
  items = [],
  onOpen,
  onClose,
  onSelectItem,
  isOpen,
  onToggle
}) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [activeTab, setActiveTab] = useState('notifications'); // 'notifications' or 'history'
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const open = isOpen;
  const setOpen = (val) => {
    if (onToggle) onToggle(val);
  };

  useEffect(() => {
    if (open) {
      setVisible(true);
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 250);
      return () => clearTimeout(t);
    }
    setAnimating(true);
    const t1 = setTimeout(() => setVisible(false), 250);
    const t2 = setTimeout(() => setAnimating(false), 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open]);

  // Fetch history logic
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/logs');
      const json = await res.json();
      if (json.success) {
        setHistoryItems(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch when switching to history tab
  useEffect(() => {
    if (open && activeTab === 'history') {
      fetchHistory();
    }
  }, [open, activeTab]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) onOpen && onOpen();
    else onClose && onClose();
  };

  return (
    <>
      <div className="fixed bottom-6 right-24 z-50">
        <button
          type="button"
          onClick={toggle}
          className="relative w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center transition-transform duration-200 hover:scale-110"
          title="Notifikasi"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Z" fill="currentColor" />
            <path
              d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>

          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 ring-2 ring-indigo-600"
              aria-label={`${unreadCount} notifikasi belum dibaca`}
            />
          )}
        </button>
      </div>

      {visible && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            style={{ background: "transparent" }}
          />

          <div className="fixed inset-0 z-[100] flex items-end justify-end pointer-events-none">
            <div
              className={
                `pointer-events-auto bg-white w-full max-w-sm m-6 rounded-lg shadow-lg border overflow-hidden transition-all duration-250 ` +
                (open && animating ? "opacity-0 scale-90 translate-y-6" : "") +
                (open && !animating ? "opacity-100 scale-100 translate-y-0" : "") +
                (!open && animating ? "opacity-0 scale-90 translate-y-6" : "")
              }
            >
              <div className="flex flex-col h-[450px]">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50">
                  <div className="flex gap-4">
                    <button
                      onClick={() => setActiveTab('notifications')}
                      className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === 'notifications' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                      Notifikasi
                    </button>
                    <button
                      onClick={() => setActiveTab('history')}
                      className={`text-sm font-semibold pb-1 border-b-2 transition-colors ${activeTab === 'history' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                      Riwayat Perubahan
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:text-gray-900"
                    onClick={() => setOpen(false)}
                  >
                    Tutup
                  </button>
                </div>

                <div className="flex-1 overflow-auto bg-white">
                  {activeTab === 'notifications' ? (
                    items.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 text-center mt-10">Tidak ada jadwal untuk hari ini atau besok.</div>
                    ) : (
                      items.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                          onClick={() => {
                            onSelectItem && onSelectItem(n);
                            setOpen(false);
                          }}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${n.type === 'today' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {n.type === 'today' ? 'Hari Ini' : 'Besok (H-1)'}
                            </span>
                            <span className="text-[10px] text-gray-400">{n.time}</span>
                          </div>
                          <div className="text-sm font-medium mb-0.5 line-clamp-1">{n.title}</div>
                          <div className="text-xs text-gray-600">
                            {dayjs(n.date).format("DD MMM YYYY")}
                          </div>
                          {n.tujuanText && (
                            <div className="text-xs text-gray-600 mt-0.5 truncate">
                              Untuk: <span className="font-medium">{n.tujuanText}</span>
                            </div>
                          )}
                        </button>
                      ))
                    )
                  ) : (
                    // History Tab
                    loadingHistory ? (
                      <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                      </div>
                    ) : historyItems.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500 text-center mt-10">Belum ada riwayat perubahan.</div>
                    ) : (
                      <div className="divide-y">
                        {historyItems.map((log) => {
                          const oldData = log.old_data; // JSON parsed automatically by mysql2 usually, but might need parsing if string
                          const parsedOld = typeof oldData === 'string' ? JSON.parse(oldData) : oldData;
                          const actionColor = log.action_type === 'DELETE' ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50';

                          return (
                            <div key={log.id} className="px-4 py-3 hover:bg-gray-50">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${actionColor}`}>
                                  {log.action_type === 'DELETE' ? 'DIHAPUS' : 'DIEDIT'}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  {dayjs(log.created_at).format("DD MMM HH:mm")}
                                </span>
                              </div>

                              {log.action_type === 'DELETE' ? (
                                <div className="text-sm font-medium text-gray-600 line-through">
                                  {parsedOld?.title || 'Kegiatan Tanpa Judul'}
                                </div>
                              ) : (
                                <div className="text-sm font-medium mb-1">
                                  {parsedOld?.title || 'Kegiatan Tanpa Judul'}
                                  {(() => {
                                    // Check if title changed
                                    try {
                                      const neu = typeof log.new_data === 'string' ? JSON.parse(log.new_data) : log.new_data;
                                      if (neu?.title && neu.title !== (parsedOld?.title)) {
                                        return <div className="text-xs text-green-600 mt-0.5">Menjadi: {neu.title}</div>
                                      }
                                    } catch (e) { }
                                    return null;
                                  })()}
                                </div>
                              )}

                              <div className="text-xs text-gray-600 mb-2">
                                Oleh: <span className="font-semibold">{log.editor_name || 'Admin'}</span>
                              </div>

                              {log.action_type === 'UPDATE' && log.new_data && (
                                <div className="space-y-1.5">
                                  {(() => {
                                    try {
                                      const old = parsedOld || {};
                                      const neu = typeof log.new_data === 'string' ? JSON.parse(log.new_data) : log.new_data;
                                      const changes = [];

                                      const fmtDate = (d) => d ? dayjs(d).format("DD MMM YYYY") : '-';

                                      if (old.schedule_date !== neu.schedule_date)
                                        changes.push({ l: 'Tanggal', f: fmtDate(old.schedule_date), t: fmtDate(neu.schedule_date) });
                                      if (old.schedule_time !== neu.schedule_time)
                                        changes.push({ l: 'Waktu Mulai', f: old.schedule_time, t: neu.schedule_time });
                                      if (old.schedule_end_time !== neu.schedule_end_time)
                                        changes.push({ l: 'Waktu Selesai', f: old.schedule_end_time || '-', t: neu.schedule_end_time || '-' });
                                      if (old.location !== neu.location)
                                        changes.push({ l: 'Lokasi', f: old.location || '-', t: neu.location || '-' });
                                      if (old.description !== neu.description)
                                        changes.push({ l: 'Deskripsi', f: old.description, t: neu.description, truncate: true });

                                      // Role compare
                                      const oldR = old.tujuan_jabatan || '[]';
                                      const newR = neu.tujuanJabatan || neu.tujuan_jabatan || '[]';
                                      if (oldR !== newR) {
                                        const parseR = (s) => {
                                          try { const p = typeof s === 'string' ? JSON.parse(s) : s; return Array.isArray(p) ? p.join(', ') : s; } catch (e) { return s; }
                                        };
                                        changes.push({ l: 'Target', f: parseR(oldR), t: parseR(newR) });
                                      }

                                      if (changes.length === 0) return <div className="text-xs text-gray-400 italic">Detail tidak tersedia</div>;

                                      return changes.map((c, idx) => (
                                        <div key={idx} className="text-xs bg-indigo-50/50 p-2 rounded border border-indigo-100/50">
                                          <div className="font-semibold text-indigo-900 mb-1">{c.l}:</div>
                                          <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-center text-[10px] sm:text-xs">
                                            <div className={`text-gray-500 line-through ${c.truncate ? 'line-clamp-2' : ''}`}>{c.f}</div>
                                            <div className="text-gray-400">➜</div>
                                            <div className={`text-indigo-700 font-medium ${c.truncate ? 'line-clamp-2' : ''}`}>{c.t}</div>
                                          </div>
                                        </div>
                                      ));
                                    } catch (e) {
                                      return <div className="text-xs text-gray-400 italic">Error parsing changes</div>;
                                    }
                                  })()}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

