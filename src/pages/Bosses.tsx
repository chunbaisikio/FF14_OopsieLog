import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Tooltip as HintTooltip } from '../components/Tooltip';
import { useSearchParams } from 'react-router-dom';
import type { BossPart, Mechanic, BossProfile } from '../store';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Download, Upload } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableMechanic({ bossId, partId, mechanic }: { bossId: string, partId: string, mechanic: Mechanic }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: mechanic.id });
  const { updateMechanic, deleteMechanic, addErrorPoint, deleteErrorPoint } = useAppStore();
  const [newEp, setNewEp] = useState('');

  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleAddEp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEp.trim()) return;
    addErrorPoint(bossId, partId, mechanic.id, newEp.trim());
    setNewEp('');
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-slate-900 border border-slate-700 rounded p-3 relative flex gap-2">
      <div {...attributes} {...listeners} className="cursor-grab text-slate-600 hover:text-slate-400 flex items-center justify-center pt-2">
        <GripVertical size={16} />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start gap-4 mb-3">
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">简称 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={mechanic.shortName}
                onChange={(e) => updateMechanic(bossId, partId, mechanic.id, { shortName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="例如：索尼"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">正式名称</label>
              <input
                type="text"
                value={mechanic.officialName}
                onChange={(e) => updateMechanic(bossId, partId, mechanic.id, { officialName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="例如：PlayStation"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">开始时间</label>
              <input
                type="text"
                value={mechanic.startTime}
                onChange={(e) => updateMechanic(bossId, partId, mechanic.id, { startTime: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="例如：1:20"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">结束时间</label>
              <input
                type="text"
                value={mechanic.endTime}
                onChange={(e) => updateMechanic(bossId, partId, mechanic.id, { endTime: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="例如：1:45"
              />
            </div>
          </div>
          <button onClick={() => deleteMechanic(bossId, partId, mechanic.id)} className="text-red-400 hover:text-red-300 mt-5">
            <Trash2 size={16} />
          </button>
        </div>
        <input
          type="text"
          value={mechanic.notes}
          onChange={(e) => updateMechanic(bossId, partId, mechanic.id, { notes: e.target.value })}
          className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none mb-3"
          placeholder="机制备注说明 (可选)..."
        />
        
        <div className="border-t border-slate-700/50 pt-2 mt-2">
          <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">错误点预设 <HintTooltip content="预设常见的错因可加快打本时的记录速度。您在记录面板依然可以随时输入临时的错因。" /></p>
          <div className="flex flex-wrap gap-2 items-center">
            {mechanic.errorPoints.filter(ep => !ep.isDeleted).map(ep => (
              <div key={ep.id} className="flex items-center gap-1 bg-slate-800 border border-slate-600 px-2 py-1 rounded text-xs">
                <span>{ep.name}</span>
                <button onClick={() => deleteErrorPoint(bossId, partId, mechanic.id, ep.id)} className="text-slate-400 hover:text-red-400">
                  <X size={12} />
                </button>
              </div>
            ))}
            <form onSubmit={handleAddEp} className="flex items-center">
              <input
                type="text"
                value={newEp}
                onChange={(e) => setNewEp(e.target.value)}
                placeholder="新增错误点..."
                className="bg-slate-800 border border-slate-600 rounded-l px-2 py-1 text-xs focus:outline-none focus:border-blue-500 w-24"
              />
              <button type="submit" className="bg-blue-600 border border-blue-600 rounded-r px-2 py-1 text-xs text-white hover:bg-blue-500">
                <Plus size={12} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortablePart({ part, bossId, isExpanded, togglePart }: { part: BossPart, bossId: string, isExpanded: boolean, togglePart: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: part.id });
  const { updateBossPart, deleteBossPart, addMechanic, reorderMechanics } = useAppStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleMechDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = part.mechanics.findIndex(m => m.id === active.id);
    const newIndex = part.mechanics.findIndex(m => m.id === over.id);
    reorderMechanics(bossId, part.id, arrayMove(part.mechanics, oldIndex, newIndex));
  };

  const style = { transform: CSS.Transform.toString(transform), transition };
  // isExpanded is passed directly

  return (
    <div ref={setNodeRef} style={style} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden mb-3 relative z-10">
      <div className="flex items-center bg-slate-800/80 p-3 gap-3 border-b border-slate-700/50">
        <div {...attributes} {...listeners} className="cursor-grab hover:text-white text-slate-500">
          <GripVertical size={20} />
        </div>
        <button onClick={() => togglePart(part.id)} className="text-slate-400 hover:text-white">
          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </button>
        <div className="flex-1 flex items-center gap-4">
          <input 
              value={part.name} 
              onChange={(e) => updateBossPart(bossId, part.id, { name: e.target.value })}
              className="bg-transparent text-white font-bold w-full focus:outline-none focus:border-b border-blue-500"
              placeholder="阶段名称"
            />
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>限时:</span>
            <input
              type="text"
              value={part.maxDuration || ''}
              onChange={(e) => updateBossPart(bossId, part.id, { maxDuration: e.target.value })}
              className="bg-slate-900 border border-slate-600 rounded px-2 py-0.5 w-20 focus:border-blue-500 focus:outline-none"
              placeholder="可选 (e.g. 3:00)"
            />
          </div>
        </div>
        <button onClick={() => deleteBossPart(bossId, part.id)} className="text-red-400 hover:text-red-300 p-1">
          <Trash2 size={16} />
        </button>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4 bg-slate-800">
          {part.mechanics.length === 0 ? (
            <p className="text-sm text-slate-500 italic">该阶段暂无机制，请添加。</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMechDragEnd}>
              <SortableContext items={part.mechanics.map(m => m.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {part.mechanics.map(m => (
                    <SortableMechanic key={m.id} bossId={bossId} partId={part.id} mechanic={m} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <button
            onClick={() => addMechanic(bossId, part.id, { shortName: '' })}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
          >
            <Plus size={16} /> 添加机制
          </button>
        </div>
      )}
    </div>
  );
}

const X = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default function Bosses() {
  const { bossProfiles, addBossProfile, importBossProfile, deleteBossProfile, addBossPart, reorderBossParts } = useAppStore();
  const [searchParams] = useSearchParams();
  const urlBossId = searchParams.get('bossId');
  const urlPartId = searchParams.get('partId');

  const [selectedBossId, setSelectedBossId] = useState<string>(urlBossId || '');
  const [newBossName, setNewBossName] = useState('');
  const [expandedPartId, setExpandedPartId] = useState<string | null>(urlPartId || 'auto');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleCreateBoss = () => {
    if (!newBossName.trim()) return;
    addBossProfile({ name: newBossName });
    setNewBossName('');
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activeBoss) return;
    const oldIndex = activeBoss.parts.findIndex(p => p.id === active.id);
    const newIndex = activeBoss.parts.findIndex(p => p.id === over.id);
    reorderBossParts(activeBoss.id, arrayMove(activeBoss.parts, oldIndex, newIndex));
  };

  const togglePart = (id: string) => {
    setExpandedPartId(prev => prev === id ? null : id);
  };

  const activeBoss = bossProfiles.find(b => b.id === (selectedBossId || bossProfiles[0]?.id));

  // Default expanded part logic
  useEffect(() => {
    if (expandedPartId === 'auto' && activeBoss && activeBoss.parts.length > 0) {
      setExpandedPartId(activeBoss.parts[0].id);
    }
  }, [activeBoss, expandedPartId]);

  const handleExport = () => {
    if (!activeBoss) return;
    const blob = new Blob([JSON.stringify(activeBoss, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ff14-boss-${activeBoss.name}-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const profile = JSON.parse(event.target?.result as string) as BossProfile;
        if (profile.parts && Array.isArray(profile.parts)) {
          importBossProfile(profile);
          alert('副本模版导入成功！');
        } else {
          alert('无效的副本模版文件！');
        }
      } catch (err) {
        alert('文件解析失败！');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Swords className="text-blue-400" /> 副本与机制管理
        </h1>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 px-3 py-1.5 rounded cursor-pointer transition-colors text-sm">
            <Download size={16} /> 导入模版
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden">
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">选择副本</h2>
            <div className="space-y-2">
              {bossProfiles.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBossId(b.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    activeBoss?.id === b.id ? 'bg-blue-600 text-white font-medium' : 'hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBossName}
                  onChange={(e) => setNewBossName(e.target.value)}
                  placeholder="新副本名称..."
                  className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                />
                <button onClick={handleCreateBoss} className="bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-1.5">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-10 relative">
          {activeBoss ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-800 p-4 rounded-lg border border-slate-700 sticky top-0 z-20 shadow-sm">
                <h2 className="text-xl font-bold">{activeBoss.name} - 阶段编辑</h2>
                <div className="flex gap-2">
                  <button onClick={handleExport} className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded text-sm transition-colors">
                    <Upload size={16} /> 导出副本模板 <HintTooltip content="将当前副本的所有阶段、机制和预设错因打包导出为 JSON 文件，可以分享给其他队伍直接一键导入。" />
                  </button>
                  <button onClick={() => addBossPart(activeBoss.id, `P${activeBoss.parts.length + 1}`)} className="flex items-center gap-1 text-sm bg-slate-700 hover:bg-slate-600 text-white py-1 px-3 rounded transition-colors">
          <Plus size={16} /> 添加阶段
        </button>
                  <button onClick={() => {
                    if (confirm('确认删除该副本吗？相关联的队伍数据将会受到影响。')) {
                      deleteBossProfile(activeBoss.id);
                      setSelectedBossId('');
                    }
                  }} className="text-red-400 hover:text-red-300 p-1 transition-colors -mr-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={activeBoss.parts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  {activeBoss.parts.map(part => (
                    <SortablePart 
                      key={part.id} 
                      part={part} 
                      bossId={activeBoss.id} 
                      isExpanded={expandedPartId === part.id} 
                      togglePart={togglePart} 
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 italic">
              请选择或创建一个副本
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Swords = ({ size = 24, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="polyline points='14.5 17.5 3 6 3 3 6 3 17.5 14.5'"></path><line x1="13" y1="19" x2="19" y2="13"></line><line x1="16" y1="16" x2="20" y2="20"></line><line x1="19" y1="21" x2="21" y2="19"></line><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"></polyline><line x1="5" y1="14" x2="9" y2="10"></line><line x1="4" y1="17" x2="7" y2="20"></line><line x1="3" y1="19" x2="5" y2="21"></line></svg>
);
