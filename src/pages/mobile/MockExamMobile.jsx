/**
 * MockExamMobile.jsx
 * Giao diện làm bài trắc nghiệm dành riêng cho Điện thoại di động.
 *
 * Kiến trúc:
 * - Duplicate toàn bộ state / logic / anti-cheat từ MockExam.jsx
 * - Thay thế toàn bộ UI render bằng giao diện Mobile-first:
 *    ✅ Bottom Navigation Bar cố định (Câu trước | Ma trận câu | Câu sau)
 *    ✅ Swipe trái/phải để chuyển câu hỏi
 *    ✅ Touch targets >= 48px cho các đáp án A, B, C, D
 *    ✅ Header gọn gàng (timer + tiến độ)
 *    ✅ Bottom Sheet Ma trận câu hỏi
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { storage } from '../../utils/storage';
import {
  AlertTriangle, Clock, Flag, Lock, Play, CheckCircle2,
  ShieldAlert, ChevronLeft, ChevronRight, Grid3X3, X, Loader2
} from 'lucide-react';
import { storageV2 } from '../../utils/storageV2';

// ── Helpers (copy từ MockExam.jsx) ──────────────────────────────────────────

const isSessionExpired = (code) => {
  if (!code) return false;
  try { return JSON.parse(localStorage.getItem('qm_expired_sessions') || '[]').includes(code); }
  catch { return false; }
};

const markSessionAsExpired = (code) => {
  if (!code) return;
  try {
    const expired = JSON.parse(localStorage.getItem('qm_expired_sessions') || '[]');
    if (!expired.includes(code)) { expired.push(code); localStorage.setItem('qm_expired_sessions', JSON.stringify(expired)); }
  } catch {}
};

const clearExpiredSession = (code) => {
  if (!code) return;
  try {
    const expired = JSON.parse(localStorage.getItem('qm_expired_sessions') || '[]');
    const filtered = expired.filter(c => c !== code);
    if (filtered.length !== expired.length) localStorage.setItem('qm_expired_sessions', JSON.stringify(filtered));
  } catch {}
};

const formatQuestionText = (text) => text ? text.replace(/\n/g, '<br>') : '';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// ── Option Labels ──────────────────────────────────────────────────────────
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ── Helper Hook cho Touch-Drag & Drop trên Mobile ──────────────────────────
function useTouchDrag({ onDrop }) {
  const [dragState, setDragState] = useState(null);
  const touchStartRef = useRef({ x: 0, y: 0, isDragging: false, itemValue: null, sourceType: null, sourceId: null });

  const handleTouchStart = (e, itemValue, sourceType, sourceId) => {
    if (itemValue == null) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      isDragging: false,
      itemValue,
      sourceType,
      sourceId
    };
  };

  const handleTouchMove = (e) => {
    if (touchStartRef.current.itemValue == null) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);

    if (!touchStartRef.current.isDragging && (dx > 8 || dy > 8)) {
      touchStartRef.current.isDragging = true;
    }

    if (touchStartRef.current.isDragging) {
      if (e.cancelable) e.preventDefault();

      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropZoneElem = elem?.closest('[data-drop-zone]');
      const activeDropTarget = dropZoneElem ? dropZoneElem.getAttribute('data-drop-zone') : null;

      setDragState({
        itemValue: touchStartRef.current.itemValue,
        sourceType: touchStartRef.current.sourceType,
        sourceId: touchStartRef.current.sourceId,
        x: touch.clientX,
        y: touch.clientY,
        activeDropTarget
      });
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartRef.current.itemValue == null) return;

    if (touchStartRef.current.isDragging && dragState) {
      if (e.cancelable) e.preventDefault();
      const touch = e.changedTouches[0];
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const dropZoneElem = elem?.closest('[data-drop-zone]');
      const dropTarget = dropZoneElem ? dropZoneElem.getAttribute('data-drop-zone') : null;

      if (dropTarget) {
        onDrop(dragState.itemValue, dropTarget, dragState.sourceType, dragState.sourceId);
      }
    }

    touchStartRef.current = { x: 0, y: 0, isDragging: false, itemValue: null, sourceType: null, sourceId: null };
    setDragState(null);
  };

  return {
    dragState,
    getTouchProps: (itemValue, sourceType, sourceId) => ({
      onTouchStart: (e) => handleTouchStart(e, itemValue, sourceType, sourceId),
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    })
  };
}

// ── DragQuestion — Ngân hàng từ khóa + Hàng ghép cặp (Hỗ trợ Touch Drag + Tap) ────────
function DragQuestion({ pairs, currentMap, onAnswer }) {
  const [selectedPoolItem, setSelectedPoolItem] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const validPairs = (pairs || []).filter(p => p && p.left && p.left.toString().trim() !== '');
  const activeMap = currentMap || {};

  const allRights = validPairs.map(p => p.right).filter(Boolean);
  const usedRights = Object.values(activeMap);
  const poolItems = [...allRights];
  usedRights.forEach(used => {
    const idx = poolItems.indexOf(used);
    if (idx !== -1) poolItems.splice(idx, 1);
  });

  const handleDrop = (itemValue, targetZone, sourceType, sourceId) => {
    if (targetZone.startsWith('slot:')) {
      const leftKey = targetZone.replace('slot:', '');
      const next = { ...activeMap };
      // Xóa ở vế trái cũ nếu kéo từ 1 vế trái khác sang
      if (sourceType === 'slot' && sourceId && sourceId !== leftKey) {
        delete next[sourceId];
      }
      next[leftKey] = itemValue;
      onAnswer(next);
      setSelectedPoolItem(null);
      setSelectedSlot(null);
    } else if (targetZone === 'pool' && sourceType === 'slot') {
      const next = { ...activeMap };
      delete next[sourceId];
      onAnswer(next);
      setSelectedPoolItem(null);
      setSelectedSlot(null);
    }
  };

  const { dragState, getTouchProps } = useTouchDrag({ onDrop: handleDrop });

  const handlePoolTap = (rVal) => {
    if (selectedSlot) {
      const next = { ...activeMap };
      // Nếu selectedSlot là ô vế trái, gán từ rVal vào ô đó
      next[selectedSlot] = rVal;
      onAnswer(next);
      setSelectedSlot(null);
      setSelectedPoolItem(null);
    } else {
      setSelectedPoolItem(prev => prev === rVal ? null : rVal);
    }
  };

  const handleSlotTap = (leftKey) => {
    const assignedVal = activeMap[leftKey];
    if (selectedPoolItem) {
      const next = { ...activeMap };
      if (selectedSlot && selectedSlot !== leftKey) {
        delete next[selectedSlot];
      }
      next[leftKey] = selectedPoolItem;
      onAnswer(next);
      setSelectedPoolItem(null);
      setSelectedSlot(null);
    } else if (assignedVal) {
      if (selectedSlot === leftKey) {
        // Chạm lại lần 2 vào ô đã có từ -> Hủy chọn / Xóa từ khỏi ô
        const next = { ...activeMap };
        delete next[leftKey];
        onAnswer(next);
        setSelectedSlot(null);
        setSelectedPoolItem(null);
      } else {
        setSelectedSlot(leftKey);
        setSelectedPoolItem(assignedVal);
      }
    } else {
      setSelectedSlot(prev => prev === leftKey ? null : leftKey);
    }
  };

  const handleRemoveAssigned = (leftKey, e) => {
    if (e) e.stopPropagation();
    const next = { ...activeMap };
    delete next[leftKey];
    onAnswer(next);
    if (selectedSlot === leftKey) {
      setSelectedSlot(null);
      setSelectedPoolItem(null);
    }
  };

  const handleClearAll = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa tất cả kết nối?")) {
      onAnswer({});
      setSelectedPoolItem(null);
      setSelectedSlot(null);
    }
  };

  return (
    <div className="space-y-4 relative">
      {/* Floating Ghost Proxy Card khi đang vuốt kéo */}
      {dragState && (
        <div
          className="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-1/2 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-black text-sm shadow-2xl border-2 border-amber-300 animate-pulse scale-105"
          style={{ left: dragState.x, top: dragState.y }}
        >
          {dragState.itemValue}
        </div>
      )}

      {/* Ngân hàng từ khóa */}
      <div
        data-drop-zone="pool"
        className={`bg-amber-50/70 dark:bg-amber-950/20 border-2 border-dashed rounded-2xl p-4 shadow-inner relative transition-colors ${
          dragState?.activeDropTarget === 'pool' ? 'border-red-400 bg-red-50/40 dark:bg-red-950/30 ring-2 ring-red-300' : 'border-amber-300 dark:border-amber-800/50'
        }`}
      >
        {Object.keys(activeMap).length > 0 && (
          <button onClick={handleClearAll} className="absolute top-2 right-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 px-2.5 py-1 rounded-lg text-xs font-bold border border-red-200 dark:border-red-900 transition-all active:scale-95">
            ✕ Xóa tất cả
          </button>
        )}
        <div className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3 text-center">
          🏷️ NGÂN HÀNG TỪ KHÓA
          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
            (Giữ & Vuốt kéo thả HOẶC Chạm để chọn)
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 justify-center">
          {poolItems.length > 0 ? (
            poolItems.map((rVal, idx) => (
              <button
                key={idx}
                {...getTouchProps(rVal, 'pool', idx)}
                onClick={() => handlePoolTap(rVal)}
                className={`px-4 py-2.5 rounded-xl text-sm font-extrabold border-2 transition-all active:scale-95 select-none touch-none cursor-grab
                  ${selectedPoolItem === rVal
                    ? 'bg-amber-400 dark:bg-amber-500 border-amber-600 dark:border-amber-400 text-white scale-105 shadow-lg ring-2 ring-amber-300'
                    : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200'}`}
              >
                {rVal}
              </button>
            ))
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓ Đã phân bổ hết tất cả từ khóa!</span>
          )}
        </div>
      </div>

      {/* Danh sách ghép cặp vế trái → vế phải */}
      <div className="space-y-2.5">
        {validPairs.map((p, idx) => {
          const assignedVal = activeMap[p.left];
          const isSelected = selectedSlot === p.left;
          const isDropActive = dragState?.activeDropTarget === `slot:${p.left}`;
          return (
            <div key={idx} className="flex gap-2 items-stretch">
              {/* Vế trái */}
              <div className={`flex-1 bg-white dark:bg-slate-900 border px-3 py-3 rounded-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center shadow-sm text-sm min-h-[54px] transition-all
                ${isSelected ? 'border-emerald-400 dark:border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900/50' : 'border-slate-200 dark:border-slate-800'}`}>
                {p.left}
              </div>
              {/* Ô thả */}
              <div
                data-drop-zone={`slot:${p.left}`}
                onClick={() => handleSlotTap(p.left)}
                className={`flex-1 border-2 border-dashed rounded-2xl px-2.5 py-2 flex items-center justify-center min-h-[54px] cursor-pointer transition-all active:scale-[0.98] relative
                  ${isDropActive
                    ? 'border-emerald-500 bg-emerald-100/70 dark:bg-emerald-950/60 scale-[1.02] ring-2 ring-emerald-400 shadow-md'
                    : isSelected
                      ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                      : assignedVal
                        ? 'border-amber-400 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/30'
                        : selectedPoolItem
                          ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 animate-pulse'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'}`}
              >
                {assignedVal ? (
                  <div className="relative group w-full h-full flex items-center justify-center">
                    <span
                      {...getTouchProps(assignedVal, 'slot', p.left)}
                      className="bg-amber-200 dark:bg-amber-900/60 border-2 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-black px-3 py-1.5 rounded-xl text-sm shadow-sm select-none touch-none active:scale-95 transition inline-block text-center w-full break-words cursor-grab"
                    >
                      {assignedVal}
                    </span>
                    <button
                      onClick={(e) => handleRemoveAssigned(p.left, e)}
                      className="absolute -top-3 -right-3 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-600 active:scale-90 z-10"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 text-xs italic font-medium">
                    {isDropActive ? 'Thả vào đây!' : isSelected ? '⬇ Chạm từ khóa' : selectedPoolItem ? '⬇ Chạm để thả' : 'Thả / Chạm từ'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── GroupDragQuestion — Ngân hàng từ khóa + Khung nhóm (Hỗ trợ Touch Drag + Tap) ──────
function GroupDragQuestion({ groups, currentAssign, onAnswer }) {
  const [selectedPoolItem, setSelectedPoolItem] = useState(null);

  const activeGroups = groups || [];
  const activeAssign = currentAssign || {};

  const allItems = activeGroups.flatMap(g => g?.items || []);
  const poolItems = allItems.filter(item => !activeAssign[item]);

  const handleDrop = (itemValue, targetZone, sourceType, sourceId) => {
    if (targetZone.startsWith('group:')) {
      const groupName = targetZone.replace('group:', '');
      onAnswer({ ...activeAssign, [itemValue]: groupName });
      setSelectedPoolItem(null);
    } else if (targetZone === 'pool' && sourceType === 'group') {
      const next = { ...activeAssign };
      delete next[itemValue];
      onAnswer(next);
      setSelectedPoolItem(null);
    }
  };

  const { dragState, getTouchProps } = useTouchDrag({ onDrop: handleDrop });

  const handlePoolTap = (item) => {
    setSelectedPoolItem(prev => prev === item ? null : item);
  };

  const handleGroupTap = (groupName) => {
    if (!selectedPoolItem) return;
    onAnswer({ ...activeAssign, [selectedPoolItem]: groupName });
    setSelectedPoolItem(null);
  };

  const handleItemInGroupTap = (item, e) => {
    if (e) e.stopPropagation();
    const next = { ...activeAssign };
    delete next[item];
    onAnswer(next);
    setSelectedPoolItem(null);
  };

  const cols = activeGroups.length === 2 ? 'grid-cols-2' : activeGroups.length >= 4 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className="space-y-4 relative">
      {/* Floating Ghost Proxy Card */}
      {dragState && (
        <div
          className="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-1/2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-sm shadow-2xl border-2 border-indigo-300 animate-pulse scale-105"
          style={{ left: dragState.x, top: dragState.y }}
        >
          {dragState.itemValue}
        </div>
      )}

      {/* Ngân hàng từ khóa */}
      <div
        data-drop-zone="pool"
        className={`bg-indigo-50/70 dark:bg-blue-950/20 border-2 border-dashed rounded-2xl p-4 shadow-inner relative transition-colors ${
          dragState?.activeDropTarget === 'pool' ? 'border-red-400 bg-red-50/40 dark:bg-red-950/30 ring-2 ring-red-300' : 'border-indigo-300 dark:border-blue-800/50'
        }`}
      >
        <div className="text-xs font-black uppercase tracking-wider text-indigo-700 dark:text-blue-400 mb-3 text-center">
          🏷️ NGÂN HÀNG TỪ KHÓA
          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
            (Giữ & Vuốt kéo vào nhóm HOẶC Chạm để chọn)
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 justify-center">
          {poolItems.length > 0 ? (
            poolItems.map((item, idx) => (
              <button
                key={idx}
                {...getTouchProps(item, 'pool', idx)}
                onClick={() => handlePoolTap(item)}
                className={`px-4 py-2.5 rounded-xl text-sm font-extrabold border-2 transition-all active:scale-95 select-none touch-none cursor-grab
                  ${selectedPoolItem === item
                    ? 'bg-indigo-500 dark:bg-indigo-600 border-indigo-700 text-white scale-105 shadow-lg ring-2 ring-indigo-300'
                    : 'bg-indigo-100 hover:bg-indigo-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 border-indigo-400 dark:border-blue-700 text-indigo-900 dark:text-blue-200'}`}
              >
                {item}
              </button>
            ))
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓ Đã xếp hết từ khóa vào nhóm!</span>
          )}
        </div>
      </div>

      {/* Khung các nhóm */}
      <div className={`grid ${cols} gap-3`}>
        {activeGroups.map((g, gIdx) => {
          const groupItems = allItems.filter(item => activeAssign[item] === g.name);
          const isDropActive = dragState?.activeDropTarget === `group:${g.name}`;
          return (
            <div
              key={gIdx}
              data-drop-zone={`group:${g.name}`}
              onClick={() => handleGroupTap(g.name)}
              className={`bg-white dark:bg-slate-900 border-2 rounded-2xl p-3 flex flex-col cursor-pointer transition-all active:scale-[0.98] shadow-sm relative ${
                isDropActive
                  ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/60 scale-[1.02] ring-2 ring-indigo-400 shadow-md'
                  : selectedPoolItem
                    ? 'border-indigo-400 dark:border-indigo-600 shadow-indigo-100 dark:shadow-none animate-pulse'
                    : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="text-center font-extrabold text-indigo-700 dark:text-blue-400 text-sm mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                {g.name}
              </div>
              <div className="flex-1 border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-xl p-2 flex flex-wrap content-start items-start gap-2 min-h-[80px]">
                {groupItems.length > 0 ? (
                  groupItems.map((item, idx) => (
                    <button
                      key={idx}
                      {...getTouchProps(item, 'group', g.name)}
                      onClick={(e) => handleItemInGroupTap(item, e)}
                      className="bg-indigo-100 hover:bg-indigo-200 dark:bg-blue-900/50 border-2 border-indigo-400 dark:border-blue-700 text-indigo-900 dark:text-blue-200 font-extrabold px-2.5 py-1.5 rounded-xl text-xs shadow-sm active:scale-95 transition select-none touch-none cursor-grab"
                    >
                      {item}
                    </button>
                  ))
                ) : (
                  <span className="text-slate-400 dark:text-slate-600 text-xs italic font-medium m-auto text-center">
                    {isDropActive ? 'Thả vào đây!' : selectedPoolItem ? '⬇ Chạm để thả' : 'Thả / Chạm từ'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ClozeDragQuestion — Kéo thả từ vào chỗ trống đoạn văn trên Mobile ────────
function ClozeDragQuestion({ content, allAnswers, clozeAnswers, onAnswer }) {
  const [selectedPoolItem, setSelectedPoolItem] = useState(null);
  const [selectedBlankIdx, setSelectedBlankIdx] = useState(null);

  let filledArray = [];
  if (Array.isArray(clozeAnswers)) {
    filledArray = clozeAnswers;
  } else if (clozeAnswers && typeof clozeAnswers === 'object') {
    filledArray = Object.values(clozeAnswers);
  }

  const usedItems = filledArray.filter(Boolean);
  const poolItems = (allAnswers || []).filter(ans => !usedItems.includes(ans));

  const parts = (content || '').split('___');

  const handleDrop = (itemValue, targetZone, sourceType, sourceId) => {
    if (targetZone.startsWith('cloze:')) {
      const idx = parseInt(targetZone.replace('cloze:', ''), 10);
      const next = [...filledArray];
      if (sourceType === 'cloze' && sourceId != null && sourceId !== idx) {
        next[sourceId] = '';
      }
      next[idx] = itemValue;
      onAnswer(next);
      setSelectedPoolItem(null);
      setSelectedBlankIdx(null);
    } else if (targetZone === 'pool' && sourceType === 'cloze') {
      const next = [...filledArray];
      if (sourceId != null) {
        next[sourceId] = '';
      }
      onAnswer(next);
      setSelectedPoolItem(null);
      setSelectedBlankIdx(null);
    }
  };

  const { dragState, getTouchProps } = useTouchDrag({ onDrop: handleDrop });

  const handlePoolTap = (ans) => {
    if (selectedBlankIdx !== null) {
      const next = [...filledArray];
      next[selectedBlankIdx] = ans;
      onAnswer(next);
      setSelectedBlankIdx(null);
      setSelectedPoolItem(null);
    } else {
      setSelectedPoolItem(prev => prev === ans ? null : ans);
    }
  };

  const handleBlankTap = (idx) => {
    const filledVal = filledArray[idx];
    if (selectedPoolItem) {
      const next = [...filledArray];
      if (selectedBlankIdx != null && selectedBlankIdx !== idx) {
        next[selectedBlankIdx] = '';
      }
      next[idx] = selectedPoolItem;
      onAnswer(next);
      setSelectedPoolItem(null);
      setSelectedBlankIdx(null);
    } else if (filledVal) {
      if (selectedBlankIdx === idx) {
        const next = [...filledArray];
        next[idx] = '';
        onAnswer(next);
        setSelectedBlankIdx(null);
        setSelectedPoolItem(null);
      } else {
        setSelectedBlankIdx(idx);
        setSelectedPoolItem(filledVal);
      }
    } else {
      setSelectedBlankIdx(prev => prev === idx ? null : idx);
    }
  };

  const handleClearAll = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa tất cả chỗ trống?")) {
      onAnswer([]);
      setSelectedPoolItem(null);
      setSelectedBlankIdx(null);
    }
  };

  return (
    <div className="space-y-4 relative">
      {/* Floating Ghost Proxy Card */}
      {dragState && (
        <div
          className="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-purple-600 text-white font-black text-sm shadow-2xl border-2 border-purple-300 animate-pulse scale-105"
          style={{ left: dragState.x, top: dragState.y }}
        >
          {dragState.itemValue}
        </div>
      )}

      {/* Ngân hàng từ khóa */}
      <div
        data-drop-zone="pool"
        className={`bg-purple-50/70 dark:bg-purple-950/20 border-2 border-dashed rounded-2xl p-4 shadow-inner relative transition-colors ${
          dragState?.activeDropTarget === 'pool' ? 'border-red-400 bg-red-50/40 dark:bg-red-950/30 ring-2 ring-red-300' : 'border-purple-300 dark:border-purple-800/50'
        }`}
      >
        {usedItems.length > 0 && (
          <button onClick={handleClearAll} className="absolute top-2 right-2 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/50 px-2.5 py-1 rounded-lg text-xs font-bold border border-red-200 dark:border-red-900 transition-all active:scale-95">
            ✕ Xóa tất cả
          </button>
        )}
        <div className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-3 text-center">
          🏷️ NGÂN HÀNG TỪ KHÓA
          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
            (Giữ & Vuốt kéo thả HOẢC Chạm để chọn)
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 justify-center">
          {poolItems.length > 0 ? (
            poolItems.map((ans, idx) => (
              <button
                key={idx}
                {...getTouchProps(ans, 'pool', idx)}
                onClick={() => handlePoolTap(ans)}
                className={`px-4 py-2 rounded-xl text-sm font-extrabold border-2 transition-all active:scale-95 select-none touch-none cursor-grab
                  ${selectedPoolItem === ans
                    ? 'bg-purple-500 dark:bg-purple-600 border-purple-700 text-white scale-105 shadow-lg ring-2 ring-purple-300'
                    : 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/40 dark:hover:bg-purple-900/60 border-purple-400 dark:border-purple-700 text-purple-900 dark:text-purple-200'}`}
              >
                {ans}
              </button>
            ))
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">✓ Đã điền xong tất cả chỗ trống!</span>
          )}
        </div>
      </div>

      {/* Nội dung đoạn văn chứa khoảng trống */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-4 rounded-2xl text-slate-800 dark:text-slate-200 leading-relaxed text-sm md:text-base">
        {parts.map((part, pIdx) => {
          if (pIdx === parts.length - 1) {
            return <span key={pIdx} dangerouslySetInnerHTML={{ __html: part }} />;
          }
          const filledVal = filledArray[pIdx] || '';
          const isDropActive = dragState?.activeDropTarget === `cloze:${pIdx}`;
          const isSelected = selectedBlankIdx === pIdx;
          return (
            <span key={pIdx} className="inline">
              <span dangerouslySetInnerHTML={{ __html: part }} />
              <span
                data-drop-zone={`cloze:${pIdx}`}
                onClick={() => handleBlankTap(pIdx)}
                className={`inline-flex items-center gap-1 border-2 border-dashed rounded-xl px-2.5 py-1 mx-1 my-0.5 align-middle transition-all cursor-pointer ${
                  isDropActive
                    ? 'border-purple-500 bg-purple-100 dark:bg-purple-950/80 scale-105 ring-2 ring-purple-400 shadow-md text-purple-900 dark:text-purple-200 font-bold'
                    : filledVal
                      ? 'border-purple-400 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-bold'
                      : isSelected
                        ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold ring-2 ring-emerald-300'
                        : selectedPoolItem
                          ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-500 animate-pulse'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-400'
                }`}
              >
                {filledVal ? (
                  <span
                    {...getTouchProps(filledVal, 'cloze', pIdx)}
                    className="font-black text-purple-900 dark:text-purple-200 touch-none select-none cursor-grab"
                  >
                    {filledVal}
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 text-xs italic">
                    {isDropActive ? 'Thả!' : isSelected ? 'Chạm từ' : '...'}
                  </span>
                )}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}


// ── Sub-components ─────────────────────────────────────────────────────────

/** Màn hình lỗi (session không hợp lệ, bị khóa, v.v.) */
function ErrorScreen({ icon: Icon, title, subtitle, color = 'amber', onBack }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-[999] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col items-center justify-center p-6 text-center">
      <div className={`w-20 h-20 rounded-full border-2 ${color === 'red' ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/40 bg-amber-500/10'} flex items-center justify-center mb-5`}>
        <Icon className={`w-10 h-10 ${color === 'red' ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'} animate-bounce`} />
      </div>
      <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">{title}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs mb-8">{subtitle}</p>
      <button
        onClick={() => navigate('/client/dashboard')}
        className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold active:scale-95 shadow-md"
      >
        Quay về Trang chính
      </button>
    </div>
  );
}

/** Màn hình bắt đầu thi */
function StartScreen({ title, questions, timeLimit, mode, onStart }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col items-center justify-center p-6 transition-colors">
      <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-500/40 flex items-center justify-center mb-5 shadow-sm">
        <Play className="w-8 h-8 text-indigo-600 dark:text-indigo-400 ml-1" />
      </div>
      <h1 className="text-xl font-black text-center text-slate-900 dark:text-white mb-2">{title || 'Bài Thi Trắc Nghiệm'}</h1>
      <div className="flex gap-4 mt-4 mb-8">
        <div className="text-center px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xl font-black text-slate-900 dark:text-white">{questions.length}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Câu hỏi</p>
        </div>
        <div className="text-center px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
          <p className="text-xl font-black text-slate-900 dark:text-white">{Math.floor(timeLimit / 60)}'</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Phút</p>
        </div>
        {mode === 'simulation' && (
          <div className="text-center px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700/50 shadow-sm">
            <p className="text-xl font-black text-red-600 dark:text-red-400">🎯</p>
            <p className="text-[10px] text-red-600 dark:text-red-400 uppercase font-bold">Mô phỏng</p>
          </div>
        )}
      </div>
      {mode === 'simulation' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 text-center max-w-xs mb-6 leading-relaxed font-medium">
          ⚠️ Chế độ mô phỏng: Không được chuyển ứng dụng hoặc khóa màn hình trong khi làm bài.
        </p>
      )}
      <button
        onClick={onStart}
        className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-base font-black
                   shadow-lg shadow-indigo-600/30 dark:shadow-indigo-900/50 active:scale-95 transition-all"
        style={{ minHeight: 56 }}
      >
        Bắt Đầu Làm Bài
      </button>
    </div>
  );
}

/** Màn hình nhập mật khẩu đề thi */
function PasswordScreen({ onSubmit, error }) {
  const [val, setVal] = useState('');
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center transition-colors">
      <Lock className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mb-4" />
      <h2 className="text-lg font-black text-slate-900 dark:text-white mb-1">Bài Thi Có Mật Khẩu</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Nhập mật khẩu do giáo viên cung cấp để tiếp tục.</p>
      <input
        type="password"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit(val); }}
        placeholder="Nhập mật khẩu..."
        className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center
                   text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-3 font-semibold">Mật khẩu không đúng. Thử lại.</p>}
      <button
        onClick={() => onSubmit(val)}
        className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black active:scale-95 shadow-md"
        style={{ minHeight: 48 }}
      >
        Xác Nhận
      </button>
    </div>
  );
}

/** Bottom Sheet Ma trận câu hỏi */
function QuestionGridSheet({ questions, answers, flagged, currentQuestion, onJump, onClose }) {
  const getStatus = (qNum) => {
    if (answers[qNum] !== undefined) return 'answered';
    if (flagged.includes(qNum)) return 'flagged';
    return 'unanswered';
  };
  const statusStyle = {
    answered: 'bg-indigo-600 text-white border-indigo-600',
    flagged: 'bg-amber-500 text-white border-amber-500',
    unanswered: 'bg-slate-800 text-slate-400 border-slate-700',
  };
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border-t border-slate-700 rounded-t-3xl px-4 pt-4 pb-6 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h3 className="text-sm font-black text-white">Ma Trận Câu Hỏi</h3>
          <div className="flex gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" /> Đã trả lời
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Đánh dấu
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-7 gap-2">
            {questions.map((_, idx) => {
              const qNum = idx + 1;
              const status = getStatus(qNum);
              const isActive = qNum === currentQuestion;
              return (
                <button
                  key={qNum}
                  onClick={() => { onJump(qNum); onClose(); }}
                  className={`w-full aspect-square rounded-xl text-xs font-black border-2 flex items-center justify-center
                              transition-all active:scale-90
                              ${isActive ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 ' : ''}
                              ${statusStyle[status]}`}
                >
                  {qNum}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Modal xác nhận nộp bài */
function SubmitModal({ answeredCount, totalCount, onConfirm, onCancel }) {
  const unanswered = totalCount - answeredCount;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl px-5 py-6 shadow-2xl">
        <h3 className="text-base font-black text-slate-800 dark:text-white mb-2">Xác Nhận Nộp Bài</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Bạn đã trả lời <span className="font-black text-indigo-600 dark:text-indigo-400">{answeredCount}</span>/{totalCount} câu.
          {unanswered > 0 && <span className="text-red-500 font-bold"> Còn {unanswered} câu chưa trả lời.</span>}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold active:scale-95"
          >
            Tiếp tục làm
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-xl bg-red-600 text-white text-sm font-black active:scale-95"
            style={{ minHeight: 48 }}
          >
            Nộp Bài
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function MockExamMobile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId: urlSessionId } = useParams();
  const { currentUser } = useAuth();

  // ── Load session (giống MockExam gốc) ──
  const savedSession = (() => {
    try {
      const sessionStr = localStorage.getItem('qm_active_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session.userId === currentUser?.id) {
          if (urlSessionId && session.examSessionCode === urlSessionId) return session;
          if (!urlSessionId && (!location.state || location.state.examId === session.examId)) return session;
        }
      }
    } catch {}
    return null;
  })();

  const examData = savedSession?.examData || location.state || null;
  const { examId, title, timeLimit = 15 * 60, mode, subjectName } = examData || {};
  
  const [questions, setQuestions] = useState(examData?.questions || []);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  const [examSessionCode] = useState(() => {
    const code = urlSessionId || savedSession?.examSessionCode || location.state?.examSessionCode || `exam_${currentUser?.id || 'guest'}_${examId || 'quiz'}`;
    if (location.state?.examSessionCode) clearExpiredSession(location.state.examSessionCode);
    return code;
  });

  const [isInvalidSession] = useState(() => {
    const code = savedSession?.examSessionCode || location.state?.examSessionCode;
    return isSessionExpired(code);
  });

  // ── Core State ──
  const [timeLeft, setTimeLeft] = useState(() => savedSession ? savedSession.timeLeft : timeLimit);
  const [answers, setAnswers] = useState(() => savedSession ? savedSession.answers : {});
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [flagged, setFlagged] = useState(() => savedSession?.flagged || []);
  const [warningCount, setWarningCount] = useState(() => savedSession ? savedSession.warningCount : 0);
  const [showWarning, setShowWarning] = useState(false);
  const [warningText, setWarningText] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showGridSheet, setShowGridSheet] = useState(false);
  const [isBlockedByDupTab, setIsBlockedByDupTab] = useState(false);
  const [isTerminatedByAdmin, setIsTerminatedByAdmin] = useState(false);
  const [isDeletedByAdmin, setIsDeletedByAdmin] = useState(false);
  const [actionLogs, setActionLogs] = useState([]);

  // Screen flow
  const examPassword = examData?.password || examData?.config?.password || '';
  const [screen, setScreen] = useState(() => {
    if (savedSession) return 'quiz';
    if (examPassword) return 'login';
    return 'start';
  });
  const [passwordError, setPasswordError] = useState(false);

  // Refs
  const isSubmittedRef = useRef(false);
  const warningCountRef = useRef(savedSession ? savedSession.warningCount : 0);
  const lastWarningTimeRef = useRef(0);
  const answersRef = useRef(savedSession ? savedSession.answers : {});
  const timeLeftRef = useRef(savedSession ? savedSession.timeLeft : timeLimit);
  const isLockOrDeletedRef = useRef(false);
  const isReloadingRef = useRef(false);
  const lastAdminMsgTimeRef = useRef(null);
  const submitExamRef = useRef(null);

  // Swipe refs
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  // ── Sync Refs ──
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  const updateWarningCount = (val) => { warningCountRef.current = val; setWarningCount(val); };

  const logAction = (detail) => {
    setActionLogs(prev => [{ time: new Date().toLocaleTimeString('vi-VN'), detail }, ...prev].slice(0, 30));
  };

  // ── BroadcastChannel (Simulation only) ──
  useEffect(() => {
    if (mode !== 'simulation' || !examSessionCode) return;
    let bc;
    try { bc = new BroadcastChannel(`qm_sim_${examSessionCode}`); } catch { return; }
    bc.postMessage({ type: 'HELLO', from: 'new_tab' });
    bc.onmessage = (e) => {
      if (e.data?.type === 'HELLO') bc.postMessage({ type: 'DUPLICATE_REJECTED' });
      if (e.data?.type === 'DUPLICATE_REJECTED') setIsBlockedByDupTab(true);
    };
    return () => { try { bc.close(); } catch {} };
  }, [mode, examSessionCode]);

  // ── Fetch Questions V2 ──
  useEffect(() => {
    if (questions.length === 0 && examId) {
      setIsLoadingQuestions(true);
      storageV2.loadQuestionsV2(examId).then(qs => {
        setQuestions(qs || []);
      }).finally(() => {
        setIsLoadingQuestions(false);
      });
    }
  }, [examId, questions.length]);

  // ── Realtime Sync V2 ──
  useEffect(() => {
    if (isSubmittedRef.current || isInvalidSession || isTerminatedByAdmin || isDeletedByAdmin || isLockOrDeletedRef.current) return;
    try {
      const session = { userId: currentUser?.id, examId, examData, answers, flagged, timeLeft: timeLeftRef.current, warningCount, examSessionCode };
      localStorage.setItem('qm_active_session', JSON.stringify(session));
      
      if (examSessionCode) {
        const answeredGrid = {};
        questions.forEach((_, idx) => {
          const qNum = idx + 1;
          if (answers && answers[qNum] !== undefined) answeredGrid[qNum] = 'answered';
          else if (flagged && flagged.includes(qNum)) answeredGrid[qNum] = 'flagged';
          else answeredGrid[qNum] = 'unanswered';
        });

        // V2: Cập nhật metadata phiên làm bài
        storageV2.updateActiveSessionV2(examSessionCode, {
          sessionId: examSessionCode, userId: currentUser?.id || 'guest',
          studentName: currentUser?.fullName || currentUser?.username || 'Học sinh',
          examId, examTitle: examData?.title || title || 'Bài thi trắc nghiệm',
          mode: mode || 'simulation', currentQuestion: currentQuestion || 1,
          totalQuestions: questions.length || 1,
          answeredCount: answers ? Object.keys(answers).length : 0,
          answeredGrid, actionLogs, timeLeft: timeLeftRef.current,
          warningCount: warningCount || 0, status: 'online',
        });
      }
    } catch {}
  }, [answers, flagged, warningCount, currentUser, examId, examData, examSessionCode, isInvalidSession, currentQuestion, questions, title, mode, actionLogs, isTerminatedByAdmin, isDeletedByAdmin]);

  // Delta Sync lưu từng đáp án vào Subcollection
  const handleAnswerChange = (qNum, answerData) => {
    setAnswers(prev => ({ ...prev, [qNum]: answerData }));
    if (examSessionCode && !isSubmittedRef.current) {
      storageV2.saveAnswerDeltaV2(examSessionCode, String(qNum), answerData);
    }
  };

  // ── Heartbeat ──
  useEffect(() => {
    if (screen !== 'quiz' || !examSessionCode) return;
    if (isSubmittedRef.current || isLockOrDeletedRef.current) return;
    const hb = setInterval(() => {
      if (isSubmittedRef.current || isLockOrDeletedRef.current) return;
      storageV2.updateActiveSessionV2(examSessionCode, { status: 'online' });
    }, 15000);
    return () => clearInterval(hb);
  }, [screen, examSessionCode]);

  // ── Admin Remote Commands ──
  useEffect(() => {
    if (!examSessionCode) return;
    const hasSeenRef = { current: false };
    const unsub = storage.subscribeActiveSessions((allSessions) => {
      const mySession = allSessions.find(s => s.id === examSessionCode);
      if (mySession) {
        hasSeenRef.current = true;
        if (mySession.status === 'terminated' && !isSubmittedRef.current) {
          isLockOrDeletedRef.current = true;
          markSessionAsExpired(examSessionCode);
          localStorage.removeItem('qm_active_session');
          setIsTerminatedByAdmin(true);
          if (typeof submitExamRef.current === 'function') submitExamRef.current(warningCountRef.current, 'Bị khóa từ xa');
        } else if (mySession.status === 'deleted' && !isSubmittedRef.current) {
          isLockOrDeletedRef.current = true;
          markSessionAsExpired(examSessionCode);
          localStorage.removeItem('qm_active_session');
          setIsDeletedByAdmin(true);
          storage.removeActiveSession(examSessionCode);
        } else if (mySession.adminMessage && mySession.adminMessageTime !== lastAdminMsgTimeRef.current) {
          lastAdminMsgTimeRef.current = mySession.adminMessageTime;
          alert(`💬 THÔNG BÁO TỪ GIÁM THỊ:\n"${mySession.adminMessage}"`);
        }
      } else if (hasSeenRef.current && !isSubmittedRef.current && !isLockOrDeletedRef.current) {
        isLockOrDeletedRef.current = true;
        markSessionAsExpired(examSessionCode);
        localStorage.removeItem('qm_active_session');
        setIsDeletedByAdmin(true);
        storage.removeActiveSession(examSessionCode);
      }
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [examSessionCode]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    const handleBeforeUnload = () => { isReloadingRef.current = true; };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      if (!isReloadingRef.current && !isSubmittedRef.current && !isInvalidSession && examSessionCode && !isLockOrDeletedRef.current) {
        markSessionAsExpired(examSessionCode);
        localStorage.removeItem('qm_active_session');
        storageV2.updateActiveSessionV2(examSessionCode, { status: 'abandoned', abandonedAt: new Date().toISOString(), abandonedReason: 'Học sinh tự ý thoát / Lùi trang' });
      }
    };
  }, [examSessionCode, isInvalidSession]);

  // ── Timer ──
  useEffect(() => {
    if (screen !== 'quiz') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!isSubmittedRef.current) {
            alert('Hết giờ làm bài! Hệ thống tự động nộp bài. (Mã lỗi: SIM-01)');
            submitExam(warningCountRef.current, 'Hết giờ');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screen]);

  // ── submitExam ──
  const submitExam = async (finalWarnings = warningCount, reason = 'Chủ động') => {
    submitExamRef.current = submitExam;
    if (isSubmittedRef.current && reason === 'Chủ động') return;
    isSubmittedRef.current = true;
    let correctCount = 0;
    const reviewedQuestions = questions.map((q, index) => {
      const qNum = index + 1;
      const userAnswer = answersRef.current[qNum];
      const qType = q.type || 'single';
      let isCorrect = false;
      let correctAnswer = null;
      if (qType === 'single') { correctAnswer = q.answer !== undefined ? q.answer : q.correct; isCorrect = userAnswer === correctAnswer; }
      else if (qType === 'multiselect') { correctAnswer = q.corrects || []; const uArr = userAnswer || []; isCorrect = uArr.length === correctAnswer.length && uArr.every(x => correctAnswer.includes(x)); }
      else if (qType === 'fill') { correctAnswer = q.answer || ''; isCorrect = userAnswer !== undefined && userAnswer !== null && userAnswer.toString().trim().toLowerCase() === correctAnswer.toString().trim().toLowerCase(); }
      else if (qType === 'truefalse') { correctAnswer = q.correct; isCorrect = userAnswer === correctAnswer; }
      else if (qType === 'drag') {
        const validPairs = (q.pairs || []).filter(p => p && p.left && p.left.toString().trim() !== '');
        correctAnswer = validPairs;
        isCorrect = validPairs.length > 0 && validPairs.every(p => (userAnswer || {})[p.left] === p.right);
      }
      else if (qType === 'groupdrag') {
        const allItems = (q.groups || []).reduce((acc, g) => [...acc, ...(g?.items || [])], []);
        correctAnswer = q.groups;
        isCorrect = allItems.length > 0 && allItems.every(item => {
          const userGroup = (userAnswer || {})[item];
          const correctGroup = (q.groups || []).find(g => (g?.items || []).includes(item))?.name;
          return userGroup === correctGroup;
        });
      }
      else if (qType === 'clozedrag') {
        const correctAnswers = q.answers || [];
        correctAnswer = correctAnswers;
        let uArr = [];
        if (Array.isArray(userAnswer)) uArr = userAnswer;
        else if (userAnswer && typeof userAnswer === 'object') uArr = Object.values(userAnswer);
        isCorrect = correctAnswers.length > 0 && correctAnswers.every((ans, idx) => uArr[idx] === ans);
      }
      else if (qType === 'order') {
        const items = q.items || [];
        const correctOrder = q.correctOrder || items.map((_, i) => i);
        correctAnswer = correctOrder;
        const uOrder = userAnswer || items.map((_, i) => i);
        isCorrect = JSON.stringify(uOrder) === JSON.stringify(correctOrder);
      }
      if (isCorrect) correctCount++;
      return {
        id: q.id,
        type: qType,
        text: q.content || q.question,
        options: q.options || [],
        userAnswer: userAnswer !== undefined ? userAnswer : null,
        correctAnswer,
        isCorrect,
        pairs: q.pairs,
        groups: q.groups,
        answers: q.answers,
        items: q.items
      };
    });
    const score = parseFloat(((correctCount / questions.length) * 10).toFixed(1));
    const timeTaken = timeLimit - timeLeftRef.current;
    const results = JSON.parse(localStorage.getItem('qm_exam_results') || '[]');
    const newResult = { id: 'res_' + Date.now(), examId, title, subjectName, mode: mode || 'practice', userId: currentUser?.id, score, timeTaken, correctCount, totalCount: questions.length, warnings: finalWarnings, date: new Date().toLocaleDateString('vi-VN'), questions: reviewedQuestions };
    results.unshift(newResult);
    localStorage.setItem('qm_exam_results', JSON.stringify(results));
    storage.saveExamResult(newResult);
    localStorage.removeItem('qm_active_session');
    markSessionAsExpired(examSessionCode);
    await storage.removeActiveSession(examSessionCode);
    storage.addAuditLog({ user: currentUser?.username || 'student', role: 'Student', category: 'Exam', action: `Nộp bài thi: ${title} | Điểm: ${score}/10 | Vi phạm: ${finalWarnings} lần | Lí do: ${reason}`, severity: finalWarnings >= 3 ? 'Warning' : 'Info' });
    const reviewPayload = { title, score, correctCount, totalCount: questions.length, questions: reviewedQuestions };
    try { sessionStorage.setItem('qm_last_review_data', JSON.stringify(reviewPayload)); } catch (_) {}
    navigate('/client/review', { state: reviewPayload, replace: true });
  };

  // ── Answer handler ──
  const handleAnswer = (qNum, value) => {
    setAnswers(prev => ({ ...prev, [qNum]: value }));
    logAction(`Trả lời câu ${qNum}: ${value}`);
  };

  const toggleFlag = (qNum) => {
    setFlagged(prev => prev.includes(qNum) ? prev.filter(n => n !== qNum) : [...prev, qNum]);
  };

  // ── Swipe navigation ──
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Chỉ trigger khi swipe ngang > 60px và không phải cuộn dọc
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && currentQuestion < questions.length) setCurrentQuestion(q => q + 1); // Vuốt trái → Câu tiếp
      if (dx > 0 && currentQuestion > 1) setCurrentQuestion(q => q - 1); // Vuốt phải → Câu trước
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // ── Error screens ──
  if (!examData) {
    return <ErrorScreen icon={AlertTriangle} title="Chưa chọn bài thi" subtitle="Vui lòng chọn môn học và bài thi từ trang chính để bắt đầu." />;
  }
  if (isBlockedByDupTab) {
    return <ErrorScreen icon={ShieldAlert} title="Phiên thi đang mở ở tab khác!" subtitle="Bài thi mô phỏng đang mở ở cửa sổ/tab khác. Vui lòng đóng tab này." color="red" />;
  }
  if (isInvalidSession || isDeletedByAdmin) {
    return <ErrorScreen icon={AlertTriangle} title="Session không hợp lệ" subtitle="Session không hợp lệ, vui lòng liên hệ admin để được hỗ trợ." />;
  }
  if (isTerminatedByAdmin) {
    return <ErrorScreen icon={Lock} title="Bài thi đã bị khóa từ xa" subtitle="Giám thị đã dừng bài thi của bạn. Kết quả đã được ghi nhận." color="red" />;
  }

  // ── Screen: Login (Password) ──
  if (screen === 'login') {
    return (
      <PasswordScreen
        error={passwordError}
        onSubmit={(val) => {
          if (val === examPassword) { setPasswordError(false); setScreen('start'); }
          else setPasswordError(true);
        }}
      />
    );
  }

  // ── Screen: Start ──
  if (screen === 'start') {
    return (
      <StartScreen
        title={title}
        questions={questions}
        timeLimit={timeLimit}
        mode={mode}
        onStart={() => setScreen('quiz')}
      />
    );
  }

  // ── Screen: Quiz ──
  if (isLoadingQuestions) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">Đang tải câu hỏi...</p>
        </div>
      </div>
    );
  }

  // ── Screen: Quiz ──
  const currentQ = questions[currentQuestion - 1];
  const isWarningTime = timeLeft < 300;
  const answeredCount = Object.keys(answers).length;
  const isFlagged = flagged.includes(currentQuestion);

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ─── Sticky Header ─── */}
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2.5
                         bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
                         border-b border-slate-200 dark:border-slate-700/60 shadow-sm">
        {/* Timer */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm
                        ${isWarningTime
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
          <Clock className="w-3.5 h-3.5" />
          {formatTime(timeLeft)}
        </div>

        {/* Progress */}
        <div className="flex flex-col items-center">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {answeredCount}/{questions.length} đã trả lời
          </span>
          <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Submit button */}
        <button
          onClick={() => setShowSubmitModal(true)}
          className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-black active:scale-95"
          style={{ minHeight: 36 }}
        >
          Nộp bài
        </button>
      </header>

      {/* ─── Question Area: chia 2 vùng ─── */}
      <div className="fixed top-[60px] bottom-[72px] left-0 right-0 flex flex-col">

        {/* Warning banner (absolute, không chiếm layout) */}
        {showWarning && (
          <div className="absolute top-0 left-4 right-4 z-40 bg-red-600 text-white rounded-2xl px-4 py-3 text-sm font-bold shadow-xl" style={{ top: 8 }}>
            ⚠️ Cảnh báo {warningCount}/3: {warningText}
          </div>
        )}

        {/* Sticky sub-header: số câu + đánh dấu — KHÔNG bị cuộn mất */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-2
                        bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Câu <span className="text-indigo-600 dark:text-indigo-400 font-black">{currentQuestion}</span>/{questions.length}
            </span>
            {mode === 'simulation' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold">
                Mô phỏng
              </span>
            )}
          </div>
          <button
            onClick={() => toggleFlag(currentQuestion)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95
                        ${isFlagged
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
            style={{ minHeight: 36 }}
          >
            <Flag className="w-3.5 h-3.5" />
            {isFlagged ? 'Đã đánh dấu' : 'Đánh dấu'}
          </button>
        </div>

        {/* Scrollable content: chỉ scroll khi cần, overscroll-none để tránh vuốt nhầm */}
        <div
          className="flex-1 overflow-y-auto overscroll-none px-4 pt-3 pb-4 space-y-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Question text */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 shadow-sm">
            <p
              className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formatQuestionText(currentQ?.content || currentQ?.question || '') }}
            />
            {currentQ?.image && (
              <img
                src={currentQ.image}
                alt="Minh họa câu hỏi"
                className="mt-3 w-full rounded-xl object-contain max-h-48"
                style={{ touchAction: 'pinch-zoom' }}
              />
            )}
          </div>

          {/* ── Single choice ── */}
          {(!currentQ?.type || currentQ.type === 'single') && (
            <div className="space-y-2">
              {(currentQ?.options || []).map((option, idx) => {
                const optionKey = OPTION_LABELS[idx];
                const isSelected = answers[currentQuestion] === optionKey;
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(currentQuestion, optionKey)}
                    className={`w-full flex items-start gap-3 px-4 rounded-2xl text-left border-2
                                transition-all duration-150 active:scale-[0.98]
                                ${isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-800 dark:text-indigo-200'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}
                    style={{ minHeight: 56, paddingTop: 14, paddingBottom: 14 }}
                  >
                    <span className={`flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black
                                      ${isSelected
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      {optionKey}
                    </span>
                    <span className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatQuestionText(typeof option === 'object' ? option.text : option) }}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Multiselect (chọn nhiều đáp án) ── */}
          {currentQ?.type === 'multiselect' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Chọn tất cả đáp án đúng</p>
              {(currentQ?.options || []).map((option, idx) => {
                const optionKey = OPTION_LABELS[idx];
                const selected = (answers[currentQuestion] || []).includes(optionKey);
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      const prev = answers[currentQuestion] || [];
                      const next = selected
                        ? prev.filter(k => k !== optionKey)
                        : [...prev, optionKey];
                      handleAnswer(currentQuestion, next);
                    }}
                    className={`w-full flex items-start gap-3 px-4 rounded-2xl text-left border-2
                                transition-all duration-150 active:scale-[0.98]
                                ${selected
                                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-800 dark:text-indigo-200'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}
                    style={{ minHeight: 56, paddingTop: 14, paddingBottom: 14 }}
                  >
                    {/* Checkbox visual */}
                    <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border-2 transition-all
                                      ${selected
                                        ? 'bg-indigo-600 border-indigo-600'
                                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
                      {selected && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatQuestionText(typeof option === 'object' ? option.text : option) }}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* ── True/False ── */}
          {currentQ?.type === 'truefalse' && (
            <div className="grid grid-cols-2 gap-3">
              {['true', 'false'].map(val => (
                <button
                  key={val}
                  onClick={() => handleAnswer(currentQuestion, val)}
                  className={`py-4 rounded-2xl text-sm font-black border-2 transition-all active:scale-95
                              ${answers[currentQuestion] === val
                                ? (val === 'true' ? 'bg-green-50 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300')
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                  style={{ minHeight: 56 }}
                >
                  {val === 'true' ? '✓ Đúng' : '✗ Sai'}
                </button>
              ))}
            </div>
          )}

          {/* ── Fill-in ── */}
          {currentQ?.type === 'fill' && (
            <input
              type="text"
              value={answers[currentQuestion] || ''}
              onChange={e => handleAnswer(currentQuestion, e.target.value)}
              placeholder="Nhập đáp án của bạn..."
              className="w-full px-4 py-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700
                         bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              style={{ minHeight: 56 }}
            />
          )}

          {/* ── Order (sắp xếp thứ tự) ── */}
          {currentQ?.type === 'order' && (() => {
            const items = currentQ.items || [];
            const currentOrder = answers[currentQuestion] || items.map((_, i) => i);
            const moveUp = (idx) => {
              if (idx === 0) return;
              const next = [...currentOrder];
              [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
              handleAnswer(currentQuestion, next);
            };
            const moveDown = (idx) => {
              if (idx === currentOrder.length - 1) return;
              const next = [...currentOrder];
              [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
              handleAnswer(currentQuestion, next);
            };
            return (
              <div className="space-y-2">
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Dùng nút ↑ ↓ để sắp xếp theo thứ tự đúng</p>
                {currentOrder.map((itemIdx, pos) => (
                  <div key={pos}
                    className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 shadow-sm"
                    style={{ minHeight: 52 }}
                  >
                    <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-black flex items-center justify-center flex-shrink-0">
                      {pos + 1}
                    </span>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 leading-snug">{items[itemIdx]}</span>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveUp(pos)} disabled={pos === 0}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 disabled:opacity-30 active:scale-90 transition-all">
                        <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                      </button>
                      <button onClick={() => moveDown(pos)} disabled={pos === currentOrder.length - 1}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 disabled:opacity-30 active:scale-90 transition-all">
                        <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Drag (nối cặp) ── */}
          {currentQ?.type === 'drag' && (
            <DragQuestion
              pairs={(currentQ.pairs || []).filter(p => p.left && p.left.toString().trim() !== '')}
              currentMap={answers[currentQuestion] || {}}
              onAnswer={(next) => handleAnswer(currentQuestion, next)}
            />
          )}

          {/* ── GroupDrag (phân loại vào nhóm) ── */}
          {currentQ?.type === 'groupdrag' && (
            <GroupDragQuestion
              groups={currentQ.groups || []}
              currentAssign={answers[currentQuestion] || {}}
              onAnswer={(next) => handleAnswer(currentQuestion, next)}
            />
          )}

          {/* ── ClozeDrag (kéo thả đoạn văn) ── */}
          {currentQ?.type === 'clozedrag' && (
            <ClozeDragQuestion
              content={currentQ.content || currentQ.question || ''}
              allAnswers={currentQ.answers || []}
              clozeAnswers={answers[currentQuestion] || []}
              onAnswer={(next) => handleAnswer(currentQuestion, next)}
            />
          )}

          {/* ── Fallback (các loại thực sự chưa hỗ trợ) ── */}
          {currentQ?.type && !['single', 'multiselect', 'truefalse', 'fill', 'order', 'drag', 'groupdrag', 'clozedrag'].includes(currentQ.type) && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 text-sm text-amber-700 dark:text-amber-300 text-center">
              Loại câu hỏi này ({currentQ.type}) hiển thị tốt nhất trên Desktop.
            </div>
          )}
        </div>
      </div>


      {/* ─── Fixed Bottom Navigation Bar ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-2.5 gap-3
                      bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
                      border-t border-slate-200 dark:border-slate-700/60 shadow-lg">
        {/* Câu Trước */}
        <button
          onClick={() => setCurrentQuestion(q => Math.max(1, q - 1))}
          disabled={currentQuestion === 1}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl font-bold text-sm
                     bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300
                     border border-slate-200 dark:border-slate-700
                     disabled:opacity-40 active:scale-95 transition-all"
          style={{ minHeight: 48, minWidth: 80 }}
        >
          <ChevronLeft className="w-4 h-4" />
          Trước
        </button>

        {/* Ma Trận Câu Hỏi */}
        <button
          onClick={() => setShowGridSheet(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 rounded-xl
                     bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400
                     border border-indigo-200 dark:border-indigo-700/50
                     active:scale-95 transition-all"
          style={{ minHeight: 48 }}
        >
          <Grid3X3 className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] font-bold">Câu {currentQuestion}/{questions.length}</span>
        </button>

        {/* Câu Tiếp */}
        <button
          onClick={() => setCurrentQuestion(q => Math.min(questions.length, q + 1))}
          disabled={currentQuestion === questions.length}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl font-bold text-sm
                     bg-indigo-600 text-white
                     disabled:opacity-40 active:scale-95 transition-all"
          style={{ minHeight: 48, minWidth: 80 }}
        >
          Tiếp
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ─── Modals / Sheets ─── */}
      {showGridSheet && (
        <QuestionGridSheet
          questions={questions}
          answers={answers}
          flagged={flagged}
          currentQuestion={currentQuestion}
          onJump={setCurrentQuestion}
          onClose={() => setShowGridSheet(false)}
        />
      )}

      {showSubmitModal && (
        <SubmitModal
          answeredCount={answeredCount}
          totalCount={questions.length}
          onConfirm={() => { setShowSubmitModal(false); submitExam(); }}
          onCancel={() => setShowSubmitModal(false)}
        />
      )}
    </div>
  );
}
