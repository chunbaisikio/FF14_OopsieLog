import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import type { BossPart, Mechanic } from '../store';
import { Clock, Plus, Trash2, ChevronRight, X, GripVertical, Calendar, Hash, Target, Settings } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { getLogicalDate } from '../utils/date';
import confetti from 'canvas-confetti';
import { History, PartyPopper, Save } from 'lucide-react';
import { Tooltip as HintTooltip } from '../components/Tooltip';

function SortablePartItem({ part, isSelected, onClick, onDelete, onManage }: { part: BossPart, isSelected: boolean, onClick: () => void, onDelete: (e: React.MouseEvent) => void, onManage: (e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: part.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`w-full flex items-center justify-between rounded text-sm transition-colors group relative overflow-hidden ${
      isSelected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`}>
      <div {...attributes} {...listeners} className="cursor-grab p-2 opacity-30 hover:opacity-100 flex-shrink-0 flex items-center h-full">
        <GripVertical size={14} />
      </div>
      <button onClick={onClick} className="flex-1 py-2 text-left font-medium truncate">
        {part.name}
      </button>
      <div className="flex items-center gap-1 pr-2 shrink-0">
        <span onClick={onManage} className="cursor-pointer p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity" title="详细管理">
          <Settings size={14} />
        </span>
        <span onClick={onDelete} className="cursor-pointer p-1 opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-100 transition-opacity">
          <Trash2 size={14} />
        </span>
        {isSelected && <ChevronRight size={16} className="opacity-50" />}
      </div>
    </div>
  );
}

function SortableMechanicItem({ mechanic, isSelected, onClick, onDelete, onManage }: { mechanic: Mechanic, isSelected: boolean, onClick: () => void, onDelete: (e: React.MouseEvent) => void, onManage: (e: React.MouseEvent) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: mechanic.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`w-full flex items-center justify-between rounded text-sm transition-colors group relative overflow-hidden ${
      isSelected ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`}>
      <div {...attributes} {...listeners} className="cursor-grab p-2 opacity-30 hover:opacity-100 flex-shrink-0 flex items-center h-full">
        <GripVertical size={14} />
      </div>
      <button onClick={onClick} className="flex-1 py-2 text-left font-medium truncate">
        {mechanic.shortName || mechanic.officialName}
      </button>
      <div className="flex items-center gap-1 pr-2 shrink-0">
        <span onClick={onManage} className="cursor-pointer p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition-opacity" title="详细管理">
          <Settings size={14} />
        </span>
        <span onClick={onDelete} className="cursor-pointer p-1 opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-100 transition-opacity">
          <Trash2 size={14} />
        </span>
        {isSelected && <ChevronRight size={16} className="opacity-50" />}
      </div>
    </div>
  );
}

export default function Tracker() {
  const { teams, activeTeamId, bossProfiles, mistakes, addMistake, insertMistakes, deleteMistake, addErrorPoint, deleteErrorPoint, addBossPart, deleteBossPart, addMechanic, deleteMechanic, reorderBossParts, reorderMechanics } = useAppStore();
  const navigate = useNavigate();
  
  const activeTeam = teams.find(t => t.id === activeTeamId);
  const activeBoss = bossProfiles.find(b => b.id === activeTeam?.bossId);

  // States
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>('');
  
  const [showPartModal, setShowPartModal] = useState(false);
  const [showMechModal, setShowMechModal] = useState(false);
  const [showRetroModal, setShowRetroModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [newPartName, setNewPartName] = useState('');
  const [newMechName, setNewMechName] = useState('');

  // Record states
  const [selectedEpIds, setSelectedEpIds] = useState<string[]>([]);
  const [multiSelectEp, setMultiSelectEp] = useState(false);
  const [newEp, setNewEp] = useState('');
  const [roundTime, setRoundTime] = useState('');
  const [note, setNote] = useState('');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  
  // Progress states
  const [currentPull, setCurrentPull] = useState(1);
  const todayStr = useMemo(() => getLogicalDate(new Date(), activeTeam?.dayResetTime), [activeTeam?.dayResetTime]);

  const [retroDate, setRetroDate] = useState(todayStr);
  const [retroPull, setRetroPull] = useState<number | ''>('');
  const [retroShift, setRetroShift] = useState(false);
  const [retroSeverity, setRetroSeverity] = useState('团灭');

  const teamMistakes = useMemo(() => mistakes.filter(m => m.teamId === activeTeamId), [mistakes, activeTeamId]);
  
  // Calculate day stats
  const { dayCount, todayPullNumber } = useMemo(() => {
    const dates = new Set(teamMistakes.map(m => m.date));
    if (!dates.has(todayStr)) dates.add(todayStr); // if today has no records yet, still counts as a new day
    
    const todayPulls = teamMistakes.filter(m => m.date === todayStr).map(m => m.pullNumber || 1);
    const todayMinPull = todayPulls.length > 0 ? Math.min(...todayPulls) : currentPull;
    const todayPullNumber = Math.max(1, currentPull - todayMinPull + 1);

    return {
      dayCount: dates.size,
      todayPullNumber
    };
  }, [teamMistakes, todayStr, currentPull]);

  // Set initial current pull
  useEffect(() => {
    const maxPull = teamMistakes.length > 0 ? Math.max(...teamMistakes.map(m => m.pullNumber || 0)) : 0;
    if (maxPull > 0 && currentPull === 1 && teamMistakes.length > 0) {
      // Default to next pull if they haven't touched it
      setCurrentPull(maxPull + 1);
    } else if (maxPull === 0) {
      setCurrentPull(1);
    }
  }, [teamMistakes.length]); // deliberately not putting currentPull in dep array to not override manual edits

  const selectedPart = activeBoss?.parts.find(p => p.id === selectedPartId);
  const selectedMechanic = selectedPart?.mechanics.find(m => m.id === selectedMechanicId);

  // Compute global max progress and celebration eligibility
  const { isNewProgress, isNewPart } = useMemo(() => {
    if (!activeBoss) return { isNewProgress: false, isNewPart: false };
    
    const pScale = activeBoss.parts.map(p => p.id);
    const mScale = activeBoss.parts.flatMap(p => p.mechanics.map(m => m.id));
    
    let maxP = -1;
    let maxM = -1;
    
    teamMistakes.forEach(m => {
      const pIdx = pScale.indexOf(m.partId);
      const mIdx = mScale.indexOf(m.mechanicId);
      if (pIdx > maxP) { maxP = pIdx; maxM = mIdx; }
      else if (pIdx === maxP && mIdx > maxM) { maxM = mIdx; }
    });

    let isNewProgress = false;
    let isNewPart = false;
    if (selectedPartId && selectedMechanicId) {
      const currentPIdx = pScale.indexOf(selectedPartId);
      const currentMIdx = mScale.indexOf(selectedMechanicId);
      
      if (currentPIdx > maxP) {
        isNewProgress = true;
        isNewPart = true;
      } else if (currentPIdx === maxP && currentMIdx >= maxM) {
        isNewProgress = true;
        isNewPart = false;
      }
    }
    
    return { isNewProgress, isNewPart };
  }, [activeBoss, teamMistakes, selectedPartId, selectedMechanicId]);

  const celebrationCount = useMemo(() => {
    if (!selectedMechanicId) return 0;
    return teamMistakes.filter(m => m.mechanicId === selectedMechanicId && m.isCelebration).length;
  }, [selectedMechanicId, teamMistakes]);

  const showCelebrationBtn = activeTeam?.celebrationMode && isNewProgress && celebrationCount < (activeTeam?.celebrationAllowance ?? 1);

  // Auto-clear toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  useEffect(() => {
    setSelectedMechanicId('');
    setSelectedEpIds([]);
  }, [selectedPartId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handlePartDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeBoss) return;
    const oldIndex = activeBoss.parts.findIndex(p => p.id === active.id);
    const newIndex = activeBoss.parts.findIndex(p => p.id === over.id);
    reorderBossParts(activeBoss.id, arrayMove(activeBoss.parts, oldIndex, newIndex));
  };

  const handleMechDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeBoss || !selectedPart) return;
    const oldIndex = selectedPart.mechanics.findIndex(m => m.id === active.id);
    const newIndex = selectedPart.mechanics.findIndex(m => m.id === over.id);
    reorderMechanics(activeBoss.id, selectedPart.id, arrayMove(selectedPart.mechanics, oldIndex, newIndex));
  };

  if (!activeTeam || !activeBoss) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-slate-400 mb-4">暂未选择活跃队伍，或活跃队伍对应的副本不存在。</p>
      </div>
    );
  }

  const activePlayers = activeTeam.players.filter(p => p.status === 'on_field');
  const recentMistakes = teamMistakes
    .filter(m => m.date === todayStr)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10);

  const toggleEp = (epId: string) => {
    if (multiSelectEp) {
      setSelectedEpIds(prev => prev.includes(epId) ? prev.filter(id => id !== epId) : [...prev, epId]);
    } else {
      setSelectedEpIds([epId]);
    }
  };

  const togglePlayer = (pId: string) => {
    setSelectedPlayerIds(prev => prev.includes(pId) ? prev.filter(id => id !== pId) : [...prev, pId]);
  };

  const handleAddEp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEp.trim() || !selectedPart || !selectedMechanic) return;
    addErrorPoint(activeBoss.id, selectedPart.id, selectedMechanic.id, newEp.trim());
    setNewEp('');
  };

  const handleRecordMistake = (severity: string, isCelebration = false) => {
    if (isCelebration) {
      if (!selectedPart || !selectedMechanic) return;
      addMistake({
        teamId: activeTeam.id,
        date: todayStr,
        partId: selectedPart.id,
        mechanicId: selectedMechanic.id,
        errorPointId: 'celebration',
        playerId: 'team',
        roundTime: roundTime.trim(),
        note: note.trim() || '初见庆祝！',
        pullNumber: currentPull,
        severity: '初见',
        isCelebration: true
      });
      if (isNewPart) {
        // Super confetti
        confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'] });
      } else {
        // Normal confetti
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
      setRoundTime('');
      setNote('');
      return;
    }

    if (!selectedPart || !selectedMechanic || selectedEpIds.length === 0 || selectedPlayerIds.length === 0) return;
    
    // Multiply records: Player X ErrorPoint
    selectedPlayerIds.forEach(playerId => {
      selectedEpIds.forEach(epId => {
        addMistake({
          teamId: activeTeam.id,
          date: todayStr,
          partId: selectedPart.id,
          mechanicId: selectedMechanic.id,
          errorPointId: epId,
          playerId: playerId,
          roundTime: roundTime.trim(),
          note: note.trim(),
          pullNumber: currentPull,
          severity
        });
      });
    });

    // Reset fields for continuous recording
    setSelectedPlayerIds([]);
    setNote('');
    setRoundTime('');
    
    // 只有在点击默认的团灭（分级的第一项）时才推进把数
    if (severity === (activeTeam.errorLevels?.[0] || '团灭')) {
      setCurrentPull(prev => prev + 1);
    }
  };

  const handleRetroactiveRecord = () => {
    if (!selectedPart || !selectedMechanic || selectedEpIds.length === 0 || selectedPlayerIds.length === 0) return;
    if (retroPull === '' || retroPull < 1) return;

    const mistakesToInsert: any[] = [];
    selectedPlayerIds.forEach(playerId => {
      selectedEpIds.forEach(epId => {
        mistakesToInsert.push({
          teamId: activeTeam.id,
          date: retroDate,
          partId: selectedPart.id,
          mechanicId: selectedMechanic.id,
          errorPointId: epId,
          playerId: playerId,
          roundTime: roundTime.trim(),
          note: note.trim(),
          pullNumber: retroPull as number,
          severity: retroSeverity
        });
      });
    });

    insertMistakes(mistakesToInsert, retroShift);

    setSelectedPlayerIds([]);
    setNote('');
    setRoundTime('');
    setShowRetroModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 gap-4 relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500/90 text-white px-6 py-3 rounded-full shadow-2xl border border-emerald-400 font-bold tracking-wide animate-in fade-in slide-in-from-top-4">
          {toastMsg}
        </div>
      )}

      {/* 顶部统计信息 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{activeBoss.name}</h1>
          <p className="text-slate-400 text-sm">当前队伍: {activeTeam.name}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-slate-800 p-2.5 rounded-lg border border-slate-700 text-sm">
          <div className="flex items-center gap-1.5 text-blue-400 font-medium px-2 border-r border-slate-700">
            <Calendar size={16} /> 第 {dayCount} 天
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium px-2 border-r border-slate-700">
            <Hash size={16} /> 本日第 {todayPullNumber} 把
          </div>
          <div className="flex items-center gap-1.5 text-purple-400 font-medium px-2">
            <Target size={16} /> 总计第 {currentPull} 把 <HintTooltip content="把数是由本队当前的最高错误等级（默认‘团灭’）的总记录次数自动估算得出的。" />
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row h-auto min-h-[600px] md:h-[580px] xl:h-[650px] border border-slate-700 rounded-xl overflow-hidden bg-slate-800 shadow-xl">
        {/* 列 1: Parts */}
        <div className={`w-full md:w-1/4 h-auto md:relative flex flex-col ${!selectedPartId ? 'border-b-2 md:border-b-0 md:border-r-2 z-20 part-border-pulse' : 'border-b md:border-b-0 md:border-r border-slate-700'}`}>
          <div className="md:absolute md:inset-0 md:overflow-y-auto bg-slate-800/50 flex flex-col">
          <div className="sticky top-0 bg-slate-800/90 backdrop-blur text-xs font-bold text-slate-400 uppercase tracking-wider p-3 border-b border-slate-700 flex justify-between items-center z-10">
            <span className="flex items-center gap-1">阶段 <HintTooltip content="按住并拖拽阶段区块，可以快捷调整它们在列表中的上下顺序。" /></span>
            <button onClick={() => setShowPartModal(true)} className="text-blue-400 hover:text-blue-300 p-1 rounded bg-blue-400/10"><Plus size={14} /></button>
          </div>
          <div className="p-2 space-y-1 flex-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePartDragEnd}>
              <SortableContext items={activeBoss.parts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                {activeBoss.parts.map(part => (
                  <SortablePartItem 
                    key={part.id} 
                    part={part} 
                    isSelected={selectedPartId === part.id}
                    onClick={() => setSelectedPartId(part.id)}
                    onManage={(e) => {
                      e.stopPropagation();
                      navigate(`/bosses?bossId=${activeBoss.id}&partId=${part.id}`);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      if (confirm('确认删除此阶段吗？相关机制也会被删除。已记录的错误日志不受影响，但在该面板中将不可见。')) {
                        deleteBossPart(activeBoss.id, part.id);
                        if (selectedPartId === part.id) setSelectedPartId('');
                      }
                    }}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          </div>
        </div>

        {/* 列 2: Mechanics */}
        <div className="w-full md:w-1/3 h-auto border-b md:border-b-0 md:border-r border-slate-700 md:overflow-y-auto bg-slate-800/80 flex flex-col">
          <div className="sticky top-0 bg-slate-800/90 backdrop-blur text-xs font-bold text-slate-400 uppercase tracking-wider p-3 border-b border-slate-700 flex justify-between items-center z-10">
            <span className="flex items-center gap-1">机制 <HintTooltip content="按住并拖拽机制区块，可以快捷调整它们在列表中的上下顺序。" /></span>
            {selectedPart && (
              <button 
                onClick={() => setShowMechModal(true)} 
                className={`p-1 rounded transition-all duration-300 ${
                  selectedPart.mechanics.length === 0 
                    ? 'mech-plus-glow mx-1' 
                    : 'text-blue-400 hover:text-blue-300 bg-blue-400/10'
                }`}
              >
                <Plus size={14} />
              </button>
            )}
          </div>
          <div className="p-2 space-y-1 flex-1">
            {!selectedPart ? (
              <p className="text-slate-500 text-xs italic p-2 text-center mt-10">请先选择一个阶段</p>
            ) : selectedPart.mechanics.length === 0 ? (
              <p className="text-slate-500 text-xs italic p-2 text-center mt-10">该阶段没有机制，点击右上角添加</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMechDragEnd}>
                <SortableContext items={selectedPart.mechanics.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  {selectedPart.mechanics.map(mech => (
                    <SortableMechanicItem 
                      key={mech.id} 
                      mechanic={mech} 
                      isSelected={selectedMechanicId === mech.id}
                      onClick={() => {
                        setSelectedMechanicId(mech.id);
                        setSelectedEpIds([]);
                      }}
                      onManage={(e) => {
                        e.stopPropagation();
                        navigate(`/bosses?bossId=${activeBoss.id}&partId=${selectedPart.id}`);
                      }}
                      onDelete={(e) => {
                        e.stopPropagation();
                        if (confirm('确认删除此机制吗？已记录的日志不受影响。')) {
                          deleteMechanic(activeBoss.id, selectedPart.id, mech.id);
                          if (selectedMechanicId === mech.id) setSelectedMechanicId('');
                        }
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* 列 3: 犯错详情与历史 */}
        <div className="w-full md:flex-1 h-auto md:overflow-y-auto bg-slate-800 md:relative flex flex-col">
          <div className="sticky top-0 bg-slate-800/90 backdrop-blur text-xs font-bold text-slate-400 uppercase tracking-wider p-3 border-b border-slate-700 z-10 flex justify-between items-center">
            <span>犯错详情录入</span>
            <button 
              onClick={() => setShowRetroModal(true)}
              className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors text-xs border border-slate-600 hover:border-slate-400 bg-slate-900/50 px-2 py-1 rounded shadow-sm"
            >
              <History size={14} /> 补录记录
            </button>
          </div>
          
          {!selectedMechanic ? (
            <div className="flex items-center justify-center h-full pb-10 text-slate-500 italic text-sm">
              请在左侧选择要记录的机制
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* 错误点选择 */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-sm text-slate-300 font-medium">错误点 (必选)</label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer hover:text-white">
                    <input type="checkbox" checked={multiSelectEp} onChange={e => {
                      setMultiSelectEp(e.target.checked);
                      if (!e.target.checked && selectedEpIds.length > 1) {
                        setSelectedEpIds([selectedEpIds[0]]);
                      }
                    }} className="rounded border-slate-600 bg-slate-800 focus:ring-blue-500 accent-blue-500" />
                    开启多选
                  </label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedMechanic.errorPoints.filter(ep => !ep.isDeleted).map(ep => (
                    <div key={ep.id} className="relative group">
                      <button
                        onClick={() => toggleEp(ep.id)}
                        className={`w-full py-1.5 px-2 rounded text-sm font-medium border transition-colors truncate ${
                          selectedEpIds.includes(ep.id)
                            ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' 
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        {ep.name}
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm('是否删除此错误点？已记录的数据不受影响。')) {
                            deleteErrorPoint(activeBoss.id, selectedPart!.id, selectedMechanic.id, ep.id);
                            setSelectedEpIds(prev => prev.filter(id => id !== ep.id));
                          }
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-slate-700 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 text-white"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddEp} className="flex items-center mt-2">
                  <input
                    type="text"
                    value={newEp}
                    onChange={(e) => setNewEp(e.target.value)}
                    placeholder="新增错误点..."
                    className="bg-slate-900 border border-slate-700 rounded-l px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 w-full"
                  />
                  <button type="submit" className="bg-slate-700 border border-slate-700 hover:bg-slate-600 rounded-r px-3 py-1.5 text-sm transition-colors text-white shrink-0">
                    添加
                  </button>
                </form>
              </div>

              {/* 队员选择 (多选) */}
              <div className="space-y-2">
                <label className="text-sm text-slate-300 font-medium">犯错队员 (可多选)</label>
                <div className="grid grid-cols-4 gap-2">
                  {activePlayers.length === 0 ? (
                     <div className="col-span-4 text-xs text-slate-500 italic p-2 border border-dashed border-slate-700 rounded text-center">队伍暂无上场成员</div>
                  ) : activePlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePlayer(p.id)}
                      className={`py-1.5 rounded text-sm font-medium border transition-colors flex flex-col items-center justify-center ${
                        selectedPlayerIds.includes(p.id)
                          ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]' 
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {p.name ? (
                        <>
                          <div className="text-[10px] opacity-70 leading-none mb-0.5">{p.role}</div>
                          <div className="truncate px-1 w-full text-center">{p.name}</div>
                        </>
                      ) : (
                        <div className="text-base font-bold truncate px-1 w-full text-center">{p.role}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 时间与备注 */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm text-slate-300 font-medium">本轮时间</label>
                  <input
                    type="text"
                    value={roundTime}
                    onChange={e => setRoundTime(e.target.value)}
                    placeholder="可选 (14:30)"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-slate-300 font-medium">备注 (可选)</label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="额外说明..."
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 pb-4 space-y-2">
                {showCelebrationBtn && (
                  <button
                    onClick={() => handleRecordMistake('初见', true)}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-2 rounded-lg shadow-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2 mt-2 border border-purple-400/30"
                  >
                    <span className="flex items-center gap-2"><PartyPopper size={18} className="text-yellow-300" /> 初见庆祝 (进度+1)</span> <HintTooltip content="全团到达新进度的庆祝按钮！不计入任何人的个人犯错，但会自动推进团队的开荒总把数。" />
                  </button>
                )}
                <div className="flex flex-wrap gap-2">
                  {(activeTeam.errorLevels || ['团灭']).map((lvl, i) => (
                    <button
                      key={lvl}
                      onClick={() => handleRecordMistake(lvl)}
                      disabled={selectedEpIds.length === 0 || selectedPlayerIds.length === 0}
                      className={`flex-1 min-w-[140px] font-bold py-3 rounded-lg shadow-lg transition-all active:scale-[0.98] flex justify-center items-center gap-2 ${
                        i === 0 
                          ? 'bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white' 
                          : 'bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 text-white'
                      }`}
                    >
                      <Plus size={20} /> 记录 {lvl} {selectedEpIds.length * selectedPlayerIds.length > 1 ? `(${selectedEpIds.length * selectedPlayerIds.length})` : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 近期记录 */}
      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-4 overflow-y-auto">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Clock size={18} className="text-blue-400" /> 今天刚发生的犯错
        </h2>
        
        <div className="space-y-2">
          {recentMistakes.length === 0 ? (
            <p className="text-slate-500 text-sm italic text-center py-4">今天还没有犯错记录，继续保持！</p>
          ) : recentMistakes.map(m => {
            const p = activeTeam.players.find(player => player.id === m.playerId);
            const part = activeBoss.parts.find(pt => pt.id === m.partId);
            const mech = part?.mechanics.find(mc => mc.id === m.mechanicId);
            const ep = mech?.errorPoints.find(e => e.id === m.errorPointId);
            
            return (
              <div key={m.id} className="bg-slate-900 border border-slate-700 p-3 rounded flex justify-between items-center group transition-colors hover:border-slate-500">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-red-400 border border-slate-700 text-sm">
                    {p?.role || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-slate-200 text-sm">
                      <span className="text-slate-400 mr-2">[第 {m.pullNumber} 把]</span>
                      {p?.name || m.playerId} <span className="text-slate-500 mx-1">在</span> 
                      <span className="text-blue-400">{part?.name} - {mech?.shortName || mech?.officialName}</span> 
                      <span className="text-slate-500 mx-1">犯了错:</span> 
                      <span className="text-red-400 ml-1">{ep?.name || '未知错误点'}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      {m.roundTime && <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">时间: {m.roundTime}</span>}
                      {m.note && <span className="italic text-slate-400">备注: {m.note}</span>}
                      <span>·</span>
                      <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('确认删除这条记录吗？')) {
                      deleteMistake(m.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-2 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showPartModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">添加新阶段</h3>
            <input
              type="text"
              autoFocus
              value={newPartName}
              onChange={e => setNewPartName(e.target.value)}
              placeholder="例如：P2 或 一运"
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white mb-6 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowPartModal(false)} className="px-4 py-2 text-slate-300 hover:text-white">取消</button>
              <button onClick={() => {
                if (newPartName.trim()) {
                  addBossPart(activeBoss.id, newPartName.trim());
                  setNewPartName('');
                  setShowPartModal(false);
                }
              }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">确认添加</button>
            </div>
          </div>
        </div>
      )}

      {showMechModal && selectedPart && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">添加新机制到 {selectedPart.name}</h3>
            <input
              type="text"
              autoFocus
              value={newMechName}
              onChange={e => setNewMechName(e.target.value)}
              placeholder="机制简称，例如：索尼"
              className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white mb-6 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowMechModal(false)} className="px-4 py-2 text-slate-300 hover:text-white">取消</button>
              <button onClick={() => {
                if (newMechName.trim()) {
                  addMechanic(activeBoss.id, selectedPart.id, { shortName: newMechName.trim() });
                  setNewMechName('');
                  setShowMechModal(false);
                }
              }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">确认添加</button>
            </div>
          </div>
        </div>
      )}

      {showRetroModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="bg-slate-900/80 p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2"><History size={18} className="text-yellow-500" /> 补录漏掉的记录</h3>
              <button onClick={() => setShowRetroModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="p-3 bg-blue-900/20 border border-blue-900/50 rounded text-sm text-blue-200">
                您当前正在补录：<br/>
                <b>阶段:</b> {selectedPart?.name || '未选择'} <br/>
                <b>机制:</b> {selectedMechanic?.shortName || '未选择'} <br/>
                <b>错因:</b> {selectedEpIds.length > 0 ? selectedEpIds.map(id => selectedMechanic?.errorPoints.find(e => e.id === id)?.name).join(', ') : '未选择'} <br/>
                <b>玩家:</b> {selectedPlayerIds.length > 0 ? selectedPlayerIds.map(id => activeTeam.players.find(p => p.id === id)?.name).join(', ') : '未选择'} <br/>
                <span className="text-yellow-400 mt-1 block border-t border-blue-900/50 pt-1">
                  (如果以上信息不正确，请先关闭此窗口并在外侧重新选择)
                </span>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-sm font-medium text-slate-300">补录日期</label>
                  <input
                    type="date"
                    value={retroDate}
                    onChange={e => setRetroDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="w-1/3 space-y-1">
                  <label className="text-sm font-medium text-slate-300">发生把数</label>
                  <input
                    type="number"
                    min={1}
                    value={retroPull}
                    onChange={e => setRetroPull(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-300">错误分级</label>
                <select
                  value={retroSeverity}
                  onChange={e => setRetroSeverity(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {(activeTeam.errorLevels || ['团灭']).map(lvl => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-start gap-2 p-3 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors mt-2">
                <input 
                  type="checkbox" 
                  checked={retroShift}
                  onChange={(e) => setRetroShift(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 text-yellow-500 focus:ring-yellow-500 bg-slate-800 mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-slate-200 font-medium">插入为全新的一把 (顺延把数)</span>
                  <span className="text-xs text-slate-500 mt-1">
                    勾选后，该日期 &gt;= <b>{retroPull || 'N'}</b> 把的已有记录将全部自动 +1 顺延。<br/>
                    如果你只是“漏记了某把中的一个人”，不要勾选此项。
                  </span>
                </div>
              </label>
            </div>
            
            <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowRetroModal(false)} className="px-4 py-2 text-slate-300 hover:text-white">取消</button>
              <button 
                onClick={handleRetroactiveRecord}
                disabled={selectedEpIds.length === 0 || selectedPlayerIds.length === 0 || retroPull === '' || retroPull < 1}
                className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2 rounded font-medium flex items-center gap-2 transition-colors"
              >
                <Save size={16} /> 确认补录
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
