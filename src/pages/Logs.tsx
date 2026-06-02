import { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { FileDown, Calendar, Edit, Trash2, Plus, GripVertical } from 'lucide-react';
import Papa from 'papaparse';
import DateRangePicker from '../components/DateRangePicker';
import { getLogicalDate } from '../utils/date';
import { Tooltip as HintTooltip } from '../components/Tooltip';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MistakeRecord } from '../store';

function SortableRow({ m, isEditing, boss, activeTeam, editData, setEditData, editTimeStr, setEditTimeStr, saveEdit, cancelEdit, startEdit, deleteMistake }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: m.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const getPlayerName = (id: string) => {
    if (!activeTeam) return id;
    const p = activeTeam.players.find((player: any) => player.id === id);
    if (p) return p.name || p.role;
    if (id.startsWith('删除玩家')) return id.substring(0, 9);
    return '未知玩家';
  };

  const details = useMemo(() => {
    if (!boss) return { part: '-', mech: '-', ep: '-' };
    const part = boss.parts.find((p: any) => p.id === (isEditing ? editData?.partId : m.partId));
    const mech = part?.mechanics.find((mc: any) => mc.id === (isEditing ? editData?.mechanicId : m.mechanicId));
    const ep = mech?.errorPoints.find((e: any) => e.id === (isEditing ? editData?.errorPointId : m.errorPointId));
    return {
      part: part?.name || '-',
      mech: mech?.shortName || mech?.officialName || '-',
      ep: ep?.name || '-'
    };
  }, [boss, m, isEditing, editData]);

  if (isEditing && editData) {
    const selectedPart = boss?.parts.find((p: any) => p.id === editData.partId);
    const selectedMech = selectedPart?.mechanics.find((mc: any) => mc.id === editData.mechanicId);

    return (
      <tr className="border-b border-slate-700/50 bg-slate-800">
        <td className="p-3 whitespace-nowrap space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">第</span>
            <input type="number" min="1" value={editData.pullNumber} onChange={e => setEditData({...editData, pullNumber: Number(e.target.value)})} className="w-16 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-white" />
            <span className="text-xs text-slate-400">把</span>
          </div>
          <div className="flex flex-col gap-1">
            <input type="date" value={editData.date} onChange={e => setEditData({...editData, date: e.target.value})} className="bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-white w-32" />
            <input type="time" step="1" value={editTimeStr} onChange={e => setEditTimeStr(e.target.value)} className="bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-white w-32" />
          </div>
        </td>
        <td className="p-3 space-y-1">
          <label className="flex items-center gap-2 mb-1 cursor-pointer">
            <input type="checkbox" checked={editData.isCelebration} onChange={e => setEditData({...editData, isCelebration: e.target.checked})} className="rounded bg-slate-900 border-slate-600 text-fuchsia-500" />
            <span className="text-xs text-fuchsia-400 font-bold">初见庆祝</span>
          </label>
          {!editData.isCelebration && (
            <>
              <select value={editData.partId} onChange={e => setEditData({...editData, partId: e.target.value, mechanicId: '', errorPointId: ''})} className="w-full bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-white mb-1">
                <option value="" disabled>选择阶段...</option>
                {boss?.parts.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={editData.mechanicId} onChange={e => setEditData({...editData, mechanicId: e.target.value, errorPointId: ''})} disabled={!editData.partId} className="w-full bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-white">
                <option value="" disabled>选择机制...</option>
                {selectedPart?.mechanics.map((mc: any) => <option key={mc.id} value={mc.id}>{mc.shortName || mc.officialName}</option>)}
              </select>
            </>
          )}
        </td>
        <td className="p-3 space-y-1">
          {!editData.isCelebration && (
            <>
              <select value={editData.errorPointId} onChange={e => setEditData({...editData, errorPointId: e.target.value})} disabled={!editData.mechanicId} className="w-full bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-white mb-1">
                <option value="" disabled>选择错因...</option>
                {selectedMech?.errorPoints.filter((ep: any) => !ep.isDeleted).map((ep: any) => <option key={ep.id} value={ep.id}>{ep.name}</option>)}
              </select>
              <select value={editData.playerId} onChange={e => setEditData({...editData, playerId: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-white">
                <option value="" disabled>选择玩家...</option>
                {activeTeam?.players.map((p: any) => <option key={p.id} value={p.id}>{p.name || p.role}</option>)}
              </select>
            </>
          )}
        </td>
        <td className="p-3">
          <select value={editData.severity || '团灭'} onChange={e => setEditData({...editData, severity: e.target.value})} className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white w-full">
            {(activeTeam?.errorLevels || ['团灭']).map((lvl: string) => <option key={lvl} value={lvl}>{lvl}</option>)}
          </select>
        </td>
        <td className="p-3">
          <input type="text" value={editData.note || ''} onChange={e => setEditData({...editData, note: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white" placeholder="备注..." />
        </td>
        <td className="p-3 text-right whitespace-nowrap">
          <div className="flex flex-col gap-2 items-end">
            <button onClick={() => saveEdit(m.id)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-1.5 w-full font-medium transition-colors">保存</button>
            <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-white px-2 py-1 transition-colors">取消</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors group">
      <td className="p-3 whitespace-nowrap flex items-center gap-2">
        <button {...attributes} {...listeners} className="text-slate-500 hover:text-white cursor-grab active:cursor-grabbing p-1 touch-none" title="拖拽排序"><GripVertical size={16} /></button>
        <div>
          <div className="font-bold text-white">第 {m.pullNumber} 把</div>
          <div className="text-xs text-slate-500">{m.date} {new Date(m.timestamp).toLocaleTimeString()}</div>
        </div>
      </td>
      <td className="p-3">
        {m.isCelebration ? (
          <span className="bg-fuchsia-500/20 text-fuchsia-400 px-2 py-0.5 rounded text-xs border border-fuchsia-500/30 font-bold">🎉 初见庆祝</span>
        ) : (
          <>
            <div className="text-slate-300 font-medium">{details.part}</div>
            <div className="text-xs text-slate-400">{details.mech}</div>
          </>
        )}
      </td>
      <td className="p-3">
        {!m.isCelebration && (
          <>
            <div className="text-red-400 font-medium">{details.ep}</div>
            <div className="text-xs text-slate-400">{getPlayerName(m.playerId)}</div>
          </>
        )}
      </td>
      <td className="p-3">
        <span className={`px-2 py-0.5 rounded text-xs border ${
          m.severity === '团灭' || !m.severity ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
        }`}>
          {m.severity || '团灭'}
        </span>
      </td>
      <td className="p-3">
        <div className="text-sm text-slate-300 max-w-[200px] truncate" title={m.note}>{m.note || '-'}</div>
      </td>
      <td className="p-3 text-right">
        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => startEdit(m)} className="text-slate-400 hover:text-blue-400 p-1 bg-slate-800 rounded"><Edit size={16} /></button>
          <button onClick={() => {
            if(confirm('确认删除这条记录？此操作不可逆转！')) {
              deleteMistake(m.id);
            }
          }} className="text-slate-400 hover:text-red-400 p-1 bg-slate-800 rounded"><Trash2 size={16} /></button>
        </div>
      </td>
    </tr>
  );
}

export default function Logs() {
  const { teams, activeTeamId, setActiveTeam, mistakes, bossProfiles, updateMistake, addMistake, deleteMistake, reorderMistakes } = useAppStore();
  
  const activeTeam = teams.find(t => t.id === activeTeamId);
  const todayStr = useMemo(() => getLogicalDate(new Date(), activeTeam?.dayResetTime), [activeTeam?.dayResetTime]);
  
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: todayStr, end: todayStr });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<MistakeRecord> | null>(null);
  const [editTimeStr, setEditTimeStr] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeDates = useMemo(() => {
    if (!activeTeamId) return [];
    const teamMistakes = mistakes.filter(m => m.teamId === activeTeamId);
    return Array.from(new Set(teamMistakes.map(m => m.date))).sort();
  }, [mistakes, activeTeamId]);

  const filteredMistakes = useMemo(() => {
    if (!activeTeamId) return [];
    let ms = mistakes.filter(m => m.teamId === activeTeamId);
    if (dateRange.start) {
      if (!dateRange.end) {
        ms = ms.filter(m => m.date === dateRange.start);
      } else {
        ms = ms.filter(m => m.date >= dateRange.start! && m.date <= dateRange.end!);
      }
    }
    // Sort descending by sortKey, then timestamp
    return ms.sort((a, b) => {
      const aSort = a.sortKey ?? a.timestamp;
      const bSort = b.sortKey ?? b.timestamp;
      if (bSort !== aSort) return bSort - aSort;
      return b.timestamp - a.timestamp;
    });
  }, [mistakes, activeTeamId, dateRange]);

  const boss = bossProfiles.find(b => b.id === activeTeam?.bossId);

  const getPlayerName = (id: string) => {
    if (!activeTeam) return id;
    const p = activeTeam.players.find(player => player.id === id);
    if (p) return p.name || p.role;
    if (id.startsWith('删除玩家')) return id.substring(0, 9);
    return '未知玩家';
  };

  const getDetails = (m: any) => {
    if (!boss) return { part: '-', mech: '-', ep: '-' };
    const part = boss.parts.find(p => p.id === m.partId);
    const mech = part?.mechanics.find(mc => mc.id === m.mechanicId);
    const ep = mech?.errorPoints.find(e => e.id === m.errorPointId);
    return {
      part: part?.name || '-',
      mech: mech?.shortName || mech?.officialName || '-',
      ep: ep?.name || '-'
    };
  };

  const handleExportCSV = () => {
    if (!activeTeam || filteredMistakes.length === 0) return;
    
    const data = filteredMistakes.map(m => {
      const details = getDetails(m);
      return {
        '日期': m.date,
        '把数': m.pullNumber,
        '阶段': details.part,
        '机制': details.mech,
        '错因': details.ep,
        '玩家': getPlayerName(m.playerId),
        '级别': m.severity || '团灭',
        '时间': new Date(m.timestamp).toLocaleTimeString(),
        '本轮时间': m.roundTime || '',
        '备注': m.note || ''
      };
    });

    const csv = Papa.unparse(data);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeTeam.name}_犯错记录_${dateRange.start || '全部'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startEdit = (m: MistakeRecord) => {
    setEditingId(m.id);
    setEditData({ ...m });
    const dateObj = new Date(m.timestamp);
    setEditTimeStr(dateObj.toLocaleTimeString('en-GB', { hour12: false }));
  };

  const startAddNew = () => {
    setEditingId('NEW');
    setEditData({
      teamId: activeTeamId!,
      date: todayStr,
      pullNumber: filteredMistakes.length > 0 ? filteredMistakes[0].pullNumber : 1,
      partId: '',
      mechanicId: '',
      errorPointId: '',
      playerId: '',
      severity: activeTeam?.errorLevels?.[0] || '团灭',
      note: '',
      isCelebration: false
    });
    setEditTimeStr(new Date().toLocaleTimeString('en-GB', { hour12: false }));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData(null);
  };

  const saveEdit = (id: string) => {
    if (!editData) return;
    
    if (!editData.isCelebration && (!editData.partId || !editData.mechanicId || !editData.errorPointId || !editData.playerId)) {
      alert('请填写完整的阶段、机制、错因和玩家信息。');
      return;
    }

    // Parse time
    const [hh, mm, ss] = editTimeStr.split(':').map(Number);
    const newTimestamp = new Date(editData.date || todayStr);
    newTimestamp.setHours(hh || 0, mm || 0, ss || 0);

    const recordToSave = {
      ...editData,
      timestamp: newTimestamp.getTime(),
    } as any;

    if (id === 'NEW') {
      // Create new record
      // 默认将其 sortKey 设为时间戳，如果有现有记录，设为刚好大于第一条的 sortKey 以排在最前
      let newSortKey = recordToSave.timestamp;
      if (filteredMistakes.length > 0) {
          const topSortKey = filteredMistakes[0].sortKey ?? filteredMistakes[0].timestamp;
          newSortKey = Math.max(recordToSave.timestamp, topSortKey + 1000);
      }
      recordToSave.sortKey = newSortKey;
      recordToSave.roundTime = '00:00';
      addMistake(recordToSave as any);
    } else {
      updateMistake(id, recordToSave);
    }
    setEditingId(null);
    setEditData(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = filteredMistakes.findIndex(m => m.id === active.id);
    const newIndex = filteredMistakes.findIndex(m => m.id === over.id);

    const newMistakes = arrayMove(filteredMistakes, oldIndex, newIndex);
    const activeItem = newMistakes[newIndex];
    const prevItem = newMistakes[newIndex - 1];
    const nextItem = newMistakes[newIndex + 1];

    let newSortKey = activeItem.sortKey ?? activeItem.timestamp;
    if (prevItem && nextItem) {
      const prevSort = prevItem.sortKey ?? prevItem.timestamp;
      const nextSort = nextItem.sortKey ?? nextItem.timestamp;
      newSortKey = (prevSort + nextSort) / 2;
    } else if (prevItem) {
      newSortKey = (prevItem.sortKey ?? prevItem.timestamp) - 1000;
    } else if (nextItem) {
      newSortKey = (nextItem.sortKey ?? nextItem.timestamp) + 1000;
    }

    reorderMistakes([{ id: activeItem.id as string, sortKey: newSortKey }]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 gap-4">
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="text-blue-400" />
          记录明细
        </h1>
        <div className="flex items-center gap-4">
          <select 
            value={activeTeamId || ''} 
            onChange={e => setActiveTeam(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="" disabled>选择队伍...</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <DateRangePicker value={dateRange} onChange={setDateRange} availableDates={activeDates} />
            <button 
              onClick={() => setDateRange({ start: null, end: null })}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded text-sm transition-colors"
            >全部日期</button>
          </div>
          
          <button 
            onClick={handleExportCSV}
            disabled={filteredMistakes.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-3 py-1.5 rounded text-sm transition-colors font-medium"
          >
            <FileDown size={16} />
            <span className="flex items-center gap-1">导出 CSV <HintTooltip content="导出的表格数据受上方队伍、日期等过滤器的影响，支持用 Excel 直接打开进行细致复盘。" /></span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-800 border border-slate-700 rounded-xl flex flex-col">
        <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <div className="text-sm text-slate-400">可以通过拖动最左侧的控制柄来调整记录顺序</div>
          <button 
            onClick={startAddNew}
            disabled={!activeTeamId || editingId === 'NEW'}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            <Plus size={16} /> 插入新记录
          </button>
        </div>
        <div className="overflow-x-auto flex-1 relative">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-900/80 sticky top-0 z-10 backdrop-blur">
              <tr>
                <th className="p-3 border-b border-slate-700 text-slate-400 font-medium whitespace-nowrap pl-8">把数 / 日期</th>
                <th className="p-3 border-b border-slate-700 text-slate-400 font-medium whitespace-nowrap">阶段与机制</th>
                <th className="p-3 border-b border-slate-700 text-slate-400 font-medium whitespace-nowrap"><span className="flex items-center gap-1">错因与玩家 <HintTooltip content="点击某条日志记录的“修改”按钮，或直接在此处双击，可以修改文本或错误等级。" /></span></th>
                <th className="p-3 border-b border-slate-700 text-slate-400 font-medium whitespace-nowrap">级别</th>
                <th className="p-3 border-b border-slate-700 text-slate-400 font-medium whitespace-nowrap">备注</th>
                <th className="p-3 border-b border-slate-700 text-slate-400 font-medium text-right whitespace-nowrap w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {editingId === 'NEW' && (
                <SortableRow 
                  m={{ id: 'NEW' }} 
                  isEditing={true} 
                  boss={boss} 
                  activeTeam={activeTeam} 
                  editData={editData} 
                  setEditData={setEditData} 
                  editTimeStr={editTimeStr} 
                  setEditTimeStr={setEditTimeStr} 
                  saveEdit={saveEdit} 
                  cancelEdit={cancelEdit} 
                />
              )}
              {filteredMistakes.length === 0 && editingId !== 'NEW' ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 italic">该时间范围内没有犯错记录</td>
                </tr>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={filteredMistakes.map(m => m.id)} strategy={verticalListSortingStrategy}>
                    {filteredMistakes.map((m) => (
                      <SortableRow 
                        key={m.id} 
                        m={m} 
                        isEditing={editingId === m.id} 
                        boss={boss} 
                        activeTeam={activeTeam} 
                        editData={editingId === m.id ? editData : null} 
                        setEditData={setEditData} 
                        editTimeStr={editTimeStr} 
                        setEditTimeStr={setEditTimeStr} 
                        saveEdit={saveEdit} 
                        cancelEdit={cancelEdit} 
                        startEdit={startEdit} 
                        deleteMistake={deleteMistake}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
