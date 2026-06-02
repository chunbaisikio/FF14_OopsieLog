import { useState, useMemo, useEffect } from 'react';
import { useAppStore, type PlayerStatus } from '../store';
import { Plus, Trash2, Users, BarChart2, Activity, X, Settings, HelpCircle, Save } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Tooltip as HintTooltip } from '../components/Tooltip';
import DateRangePicker from '../components/DateRangePicker';
import { getLogicalDate } from '../utils/date';
import { getWorkspaceSession, type WorkspaceRole } from '../utils/session';
import { fetchJson } from '../utils/http';

const ROLES = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

type WorkspaceUser = {
  id: string;
  displayName: string;
  passcode: string;
  role: WorkspaceRole;
  joinedAt: string;
};

export default function Teams() {
  const session = getWorkspaceSession();
  const { teams, activeTeamId, bossProfiles, addTeam, setActiveTeam, deleteTeam, addPlayerToTeam, updatePlayerInTeam, deletePlayerFromTeam, mistakes, updateTeamSettings } = useAppStore();
  
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedBossId, setSelectedBossId] = useState('');
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [celebrationMode, setCelebrationMode] = useState(false);
  
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempSettings, setTempSettings] = useState<{ bossId: string; captainUserId: string; dayResetTime: string; celebrationMode: boolean; errorLevels: string[]; celebrationAllowance: number }>({
    bossId: '',
    captainUserId: '',
    dayResetTime: '04:00',
    celebrationMode: false,
    errorLevels: ['团灭'],
    celebrationAllowance: 1,
  });
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerForm, setEditPlayerForm] = useState({ roleSelect: 'MT', roleCustom: '', name: '', job: '' });

  const activeTeam = teams.find(t => t.id === activeTeamId);
  const canCreateTeam = !!session;
  const canManageActiveTeam = !!session && !!activeTeam;

  useEffect(() => {
    if (!session?.workspaceId || !session.passcode) return;
    const params = new URLSearchParams({ actorPasscode: session.passcode });
    fetchJson<{ users: WorkspaceUser[] }>(`/api/workspaces/${session.workspaceId}/users?${params.toString()}`)
      .then(data => setWorkspaceUsers(data.users ?? []))
      .catch(() => setWorkspaceUsers([]));
  }, [session?.workspaceId, session?.passcode]);

  const todayStr = useMemo(() => getLogicalDate(new Date(), activeTeam?.dayResetTime), [activeTeam?.dayResetTime]);
  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return getLogicalDate(d, activeTeam?.dayResetTime);
  }, [activeTeam?.dayResetTime]);

  const [progressDateRange, setProgressDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [trendDateRange, setTrendDateRange] = useState<{ start: string | null; end: string | null }>({ start: sevenDaysAgoStr, end: todayStr });
  const [pieDateRange, setPieDateRange] = useState<{ start: string | null; end: string | null }>({ start: todayStr, end: todayStr });

  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchRows, setBatchRows] = useState<{role: string, name: string, job: string}[]>([]);
  
  const [newRole, setNewRole] = useState('MT');
  const [newRoleCustom, setNewRoleCustom] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerJob, setNewPlayerJob] = useState('');

  const [chartView, setChartView] = useState<'part' | 'mechanic'>('mechanic');
  const [timeAxis, setTimeAxis] = useState<'pull' | 'day'>('pull');

  const handleCreateTeam = () => {
    if (!newTeamName.trim() || !selectedBossId) return;
    addTeam({
      name: newTeamName,
      bossId: selectedBossId,
      players: [],
      celebrationMode,
      captainUserId: session?.role === 'captain' ? session.userId : undefined,
    });
    setNewTeamName('');
    setSelectedBossId('');
    setCelebrationMode(false);
  };

  const handleAddPlayer = () => {
    if (!activeTeam || !canManageActiveTeam) return;
    const finalRole = newRole === '其他' ? newRoleCustom.trim() : newRole;
    if (!finalRole) return;

    addPlayerToTeam(activeTeam.id, {
      role: finalRole,
      name: newPlayerName.trim(),
      job: newPlayerJob.trim(),
      status: 'benched' // default to benched
    });

    setNewPlayerName('');
    setNewPlayerJob('');
    setNewRoleCustom('');
  };

  const handleBatchAdd = () => {
    if (!activeTeam || !canManageActiveTeam) return;
    batchRows.forEach(row => {
      if (row.name.trim() || row.job.trim() || row.role) {
        addPlayerToTeam(activeTeam.id, {
          role: row.role || '其他',
          name: row.name.trim(),
          job: row.job.trim(),
          status: 'on_field'
        });
      }
    });
    setShowBatchModal(false);
  };

  const isDateInRange = (d: string, range: { start: string | null; end: string | null }) => {
    if (!range.start) return true;
    if (!range.end) return d === range.start;
    return d >= range.start && d <= range.end;
  };

  const { dailyData, pieDataPart, pieDataMech, progressDataByPull, progressDataByDay, mechScale, partScale, activeDates } = useMemo(() => {
    if (!activeTeam) return { dailyData: [], pieDataPart: [], pieDataMech: [], progressDataByPull: [], progressDataByDay: [], mechScale: [], partScale: [], activeDates: [] };
    
    const teamMistakes = mistakes.filter(m => m.teamId === activeTeam.id);
    const boss = bossProfiles.find(b => b.id === activeTeam.bossId);

    const activeDates = Array.from(new Set(teamMistakes.map(m => m.date))).sort();

    const trendMistakes = teamMistakes.filter(m => isDateInRange(m.date, trendDateRange));
    const pieMistakes = teamMistakes.filter(m => isDateInRange(m.date, pieDateRange));

    const dailyMap: Record<string, any> = {};
    trendMistakes.forEach(m => {
      if (m.isCelebration) return; // Ignore celebration records for player stats
      const p = activeTeam.players.find(player => player.id === m.playerId);
      const pName = p ? (p.name || p.role) : (m.playerId.startsWith('删除玩家') ? m.playerId.substring(0, 9) : '未知');
      if (!dailyMap[m.date]) dailyMap[m.date] = { date: m.date };
      dailyMap[m.date][pName] = (dailyMap[m.date][pName] || 0) + 1;
    });
    const dailyData = Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(-7);

    const mechMap: Record<string, number> = {};
    const partMap: Record<string, number> = {};
    
    pieMistakes.forEach(m => {
      if (m.isCelebration) return;
      if (boss) {
        const part = boss.parts.find(pt => pt.id === m.partId);
        const mech = part?.mechanics.find(mc => mc.id === m.mechanicId);
        if (part && mech) {
          const pName = part.name;
          const mName = `${part.name} - ${mech.shortName || mech.officialName}`;
          mechMap[mName] = (mechMap[mName] || 0) + 1;
          partMap[pName] = (partMap[pName] || 0) + 1;
        }
      }
    });

    const pieDataPart = Object.entries(partMap).map(([name, value]) => ({ name, value }));
    const pieDataMech = Object.entries(mechMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 3. Progress Data (Current vs Max)
    const pScale = boss ? boss.parts.map(p => ({ id: p.id, name: p.name })) : [];
    const mScale = boss ? boss.parts.flatMap(p => p.mechanics.map(m => ({
      partId: p.id,
      partName: p.name,
      mechId: m.id,
      mechName: m.shortName || m.officialName
    }))) : [];

    // By Pull (Compute max from ALL mistakes, then filter)
    const pullsMapAll: Record<number, any[]> = {};
    const daysMapAll: Record<string, any[]> = {};
    
    teamMistakes.forEach(m => {
      const pNum = m.pullNumber || 1;
      if (!pullsMapAll[pNum]) pullsMapAll[pNum] = [];
      pullsMapAll[pNum].push(m);

      if (!daysMapAll[m.date]) daysMapAll[m.date] = [];
      daysMapAll[m.date].push(m);
    });

    const pullNumbers = Object.keys(pullsMapAll).map(Number).sort((a, b) => a - b);
    let maxPartIdx = -1;
    let maxMechIdx = -1;

    const progressDataByPullRaw = pullNumbers.map(pullNum => {
      const pullMistakes = pullsMapAll[pullNum];
      
      const currentPartIdx = Math.max(...pullMistakes.map(m => pScale.findIndex(p => p.id === m.partId)));
      const currentMechIdx = Math.max(...pullMistakes.map(m => mScale.findIndex(mc => mc.mechId === m.mechanicId)));

      maxPartIdx = Math.max(maxPartIdx, currentPartIdx);
      maxMechIdx = Math.max(maxMechIdx, currentMechIdx);

      return {
        pullNum,
        date: pullMistakes[0]?.date,
        label: `第${pullNum}把`,
        currentPart: currentPartIdx,
        maxPart: maxPartIdx,
        currentMech: currentMechIdx,
        maxMech: maxMechIdx,
      };
    });

    const progressDataByPull = progressDataByPullRaw.filter(p => isDateInRange(p.date, progressDateRange));

    // By Day
    const sortedDates = Object.keys(daysMapAll).sort((a, b) => a.localeCompare(b));
    let hMaxPartIdx = -1;
    let hMaxMechIdx = -1;

    const progressDataByDayRaw = sortedDates.map((date, index) => {
      const dayMistakes = daysMapAll[date];
      
      const dayMaxPartIdx = Math.max(...dayMistakes.map(m => pScale.findIndex(p => p.id === m.partId)));
      const dayMaxMechIdx = Math.max(...dayMistakes.map(m => mScale.findIndex(mc => mc.mechId === m.mechanicId)));

      hMaxPartIdx = Math.max(hMaxPartIdx, dayMaxPartIdx);
      hMaxMechIdx = Math.max(hMaxMechIdx, dayMaxMechIdx);

      return {
        date,
        label: `第${index + 1}天 (${date.substring(5)})`,
        currentPart: dayMaxPartIdx,
        maxPart: hMaxPartIdx,
        currentMech: dayMaxMechIdx,
        maxMech: hMaxMechIdx,
      };
    });

    const progressDataByDay = progressDataByDayRaw.filter(p => isDateInRange(p.date, progressDateRange));

    return { dailyData, pieDataPart, pieDataMech, progressDataByPull, progressDataByDay, mechScale: mScale, partScale: pScale, activeDates };
  }, [activeTeam, mistakes, bossProfiles, progressDateRange, trendDateRange, pieDateRange]);

  const StatusBadge = ({ status }: { status?: PlayerStatus }) => {
    const s = status || 'on_field';
    switch(s) {
      case 'on_field': return <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs border border-emerald-500/30">上场</span>;
      case 'benched': return <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs border border-blue-500/30">在队</span>;
      case 'left': return <span className="bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded text-xs border border-slate-500/30">离队</span>;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="text-blue-400" /> 队伍与数据分析
        </h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6 h-full overflow-hidden">
        {/* 左侧队伍列表 */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">选择队伍</h2>
            <div className="space-y-2">
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTeam(t.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    activeTeamId === t.id ? 'bg-blue-600 text-white font-medium' : 'hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs opacity-70 mt-0.5">
                    {bossProfiles.find(b => b.id === t.bossId)?.name || '未知副本'}
                  </div>
                  <div className="text-[11px] opacity-60 mt-1">
                    队长：{workspaceUsers.find(user => user.id === t.captainUserId)?.displayName || '未指定'}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <button 
                onClick={() => setShowCreateTeamModal(true)}
                disabled={!canCreateTeam}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded px-2 py-2 flex items-center justify-center gap-1 transition-colors font-medium"
              >
                <Plus size={16} /> 创建新队伍
              </button>
            </div>
          </div>
        </div>

        {/* 右侧队伍详情与分析 */}
        <div className="flex-1 overflow-y-auto pr-2 pb-10">
          {activeTeam ? (
            <div className="space-y-6">
              {/* 成员管理区 */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Users size={20} className="text-blue-400" /> 队员管理
                    <HintTooltip content="点击玩家的游戏ID、位置或职业即可直接修改。右侧色块可调整图表颜色。&#10;当固定队成员请假需替补时，可将其“下场”，下场的成员暂不出现在今日的记录网格中。" />
                  </h2>
                  <div className="flex items-center gap-2">
                    <button onClick={() => {
                      setTempSettings({
                        bossId: activeTeam.bossId,
                        captainUserId: activeTeam.captainUserId || '',
                        dayResetTime: activeTeam.dayResetTime || '04:00',
                        celebrationMode: activeTeam.celebrationMode ?? false,
                        errorLevels: activeTeam.errorLevels || ['团灭', '机制错', '走位错', '贪输出', '忘了'],
                        celebrationAllowance: activeTeam.celebrationAllowance ?? 1
                      });
                      setShowSettingsModal(true);
                    }} disabled={!canManageActiveTeam} className="text-slate-400 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 px-2 py-1.5 rounded transition-colors text-sm flex items-center gap-1 bg-slate-700">
                      <Settings size={16} /> 队伍设置
                    </button>
                    <button onClick={() => {
                      const input = prompt(`确定要解散队伍 "${activeTeam.name}" 吗？所有相关的犯错记录也将被一并删除！\n请输入队伍名称以确认解散：`);
                      if (input === activeTeam.name) {
                        deleteTeam(activeTeam.id);
                        setActiveTeam('');
                      } else if (input !== null) {
                        alert('队伍名称输入错误，解散操作已取消。');
                      }
                    }} disabled={!canManageActiveTeam} className="text-red-400 hover:text-red-300 disabled:text-slate-500 text-sm flex items-center gap-1 px-2 py-1.5 rounded transition-colors">
                      <Trash2 size={16} /> 解散队伍
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {activeTeam.players.map(p => {
                    const pStatus = p.status || 'on_field';
                    return (
                    <div key={p.id} className={`flex flex-col border rounded p-3 relative group ${
                      pStatus === 'on_field' ? 'border-emerald-500/50 bg-slate-900 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 
                      pStatus === 'benched' ? 'border-slate-600 bg-slate-900/80' : 
                      'border-slate-700 bg-slate-900/40 opacity-60'
                    }`}>
                      {editingPlayerId === p.id && canManageActiveTeam ? (
                        <div className="flex flex-col gap-2 z-10">
                          <select value={editPlayerForm.roleSelect} onChange={e => setEditPlayerForm(s => ({...s, roleSelect: e.target.value}))} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 font-bold text-blue-400">
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            <option value="其他">其他</option>
                          </select>
                          {editPlayerForm.roleSelect === '其他' && (
                            <input type="text" value={editPlayerForm.roleCustom} onChange={e => setEditPlayerForm(s => ({...s, roleCustom: e.target.value}))} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500 font-bold text-blue-400" placeholder="自定义位置" />
                          )}
                          <input type="text" value={editPlayerForm.name} onChange={e => setEditPlayerForm(s => ({...s, name: e.target.value}))} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500" placeholder="游戏ID (选填)" />
                          <input type="text" value={editPlayerForm.job} onChange={e => setEditPlayerForm(s => ({...s, job: e.target.value}))} className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-slate-400 focus:outline-none focus:border-blue-500" placeholder="职业 (选填)" />
                          <div className="flex gap-2 mt-1">
                            <button disabled={!canManageActiveTeam} onClick={() => {
                              const finalRole = editPlayerForm.roleSelect === '其他' ? editPlayerForm.roleCustom.trim() : editPlayerForm.roleSelect;
                              updatePlayerInTeam(activeTeam.id, p.id, { role: finalRole || '其他', name: editPlayerForm.name.trim(), job: editPlayerForm.job.trim() });
                              setEditingPlayerId(null);
                            }} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded py-1 text-xs font-medium">保存</button>
                            <button onClick={() => setEditingPlayerId(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded py-1 text-xs font-medium">取消</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-blue-400">{p.role}</span>
                            <StatusBadge status={pStatus} />
                          </div>
                          <span className="text-sm font-medium">{p.name || ''}</span>
                          <span className="text-xs text-slate-400">{p.job || ''}</span>
                          
                          {/* Hover Actions */}
                          <div className={`absolute inset-0 bg-slate-900/90 backdrop-blur-sm rounded flex flex-col justify-center items-center gap-2 transition-opacity z-10 ${canManageActiveTeam ? 'opacity-0 group-hover:opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <div className="flex gap-2">
                              {pStatus === 'benched' && (
                                <button onClick={() => updatePlayerInTeam(activeTeam.id, p.id, { status: 'on_field' })} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded">上场</button>
                              )}
                              <button onClick={() => {
                                setEditingPlayerId(p.id);
                                const isCustom = !ROLES.includes(p.role || '');
                                setEditPlayerForm({ 
                                  roleSelect: isCustom ? '其他' : (p.role || 'MT'), 
                                  roleCustom: isCustom ? (p.role || '') : '', 
                                  name: p.name || '', 
                                  job: p.job || '' 
                                });
                              }} className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-2 py-1 rounded">修改</button>
                              {pStatus === 'on_field' && (
                                <button onClick={() => updatePlayerInTeam(activeTeam.id, p.id, { status: 'benched' })} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">下场</button>
                              )}
                          {pStatus === 'left' && (
                            <button onClick={() => updatePlayerInTeam(activeTeam.id, p.id, { status: 'benched' })} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">进队</button>
                          )}
                          {pStatus === 'benched' && (
                            <button onClick={() => updatePlayerInTeam(activeTeam.id, p.id, { status: 'left' })} className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-2 py-1 rounded">离队</button>
                          )}
                        </div>
                        {pStatus === 'left' && (
                          <button onClick={() => {
                            if (confirm('是否彻底删除该成员？历史记录中该成员将被标记为随机未知玩家。')) {
                              deletePlayerFromTeam(activeTeam.id, p.id);
                            }
                          }} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 mt-1">
                            <Trash2 size={12} /> 彻底删除
                          </button>
                        )}
                      </div>
                      </>
                      )}
                    </div>
                  )})}
                </div>

                <div className="bg-slate-900/50 border border-slate-700 p-3 rounded-lg flex flex-wrap gap-3 items-end">
                  <div className="flex flex-col gap-1 w-24">
                    <label className="text-xs text-slate-400">位置</label>
                    <select value={newRole} onChange={e => setNewRole(e.target.value)} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none text-white">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      <option value="其他">其他...</option>
                    </select>
                  </div>
                  {newRole === '其他' && (
                    <div className="flex flex-col gap-1 w-24">
                      <label className="text-xs text-slate-400">自定义</label>
                      <input type="text" value={newRoleCustom} onChange={e => setNewRoleCustom(e.target.value)} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none text-white" placeholder="输入..." />
                    </div>
                  )}
                  <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                    <label className="text-xs text-slate-400">游戏ID (选填)</label>
                    <input type="text" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none text-white" placeholder="例如: 丝瓜卡夫卡@拂晓之间" />
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                    <label className="text-xs text-slate-400">职业 (选填)</label>
                    <input type="text" value={newPlayerJob} onChange={e => setNewPlayerJob(e.target.value)} className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none text-white" placeholder="例如: 暗黑骑士/DK" />
                  </div>
                  <button 
                    onClick={() => {
                      if (!activeTeam) return;
                      const activeRoles = new Set(activeTeam.players.filter(p => p.status === 'on_field').map(p => p.role));
                      const missingRoles = ROLES.filter(r => !activeRoles.has(r));
                      setBatchRows(missingRoles.map(r => ({ role: r, name: '', job: '' })));
                      setShowBatchModal(true);
                    }}
                    disabled={!canManageActiveTeam}
                    className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white px-4 py-1.5 rounded text-sm h-[34px] flex items-center gap-1 transition-colors"
                  >
                    批量添加
                  </button>
                  <button onClick={handleAddPlayer} disabled={!canManageActiveTeam} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-1.5 rounded text-sm h-[34px] flex items-center gap-1 transition-colors">
                    <Plus size={16} /> 添加队员
                  </button>
                </div>
              </div>

              {/* 进度图表区 */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Activity size={20} className="text-purple-400" /> 团队开荒进度
                  </h2>
                  <div className="flex items-center gap-3">
                    <DateRangePicker 
                      value={progressDateRange} 
                      onChange={setProgressDateRange} 
                      availableDates={activeDates} 
                    />
                    <div className="w-px h-6 bg-slate-700"></div>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 p-1 rounded text-sm">
                      <button 
                        onClick={() => setTimeAxis('pull')} 
                        className={`px-3 py-1 rounded transition-colors ${timeAxis === 'pull' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        按把数
                      </button>
                      <button 
                        onClick={() => setTimeAxis('day')} 
                        className={`px-3 py-1 rounded transition-colors ${timeAxis === 'day' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        按天数
                      </button>
                    </div>
                    <div className="w-px h-6 bg-slate-700"></div>
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 p-1 rounded text-sm">
                      <button 
                        onClick={() => setChartView('part')} 
                        className={`px-3 py-1 rounded transition-colors ${chartView === 'part' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        按阶段
                      </button>
                      <button 
                        onClick={() => setChartView('mechanic')} 
                        className={`px-3 py-1 rounded transition-colors ${chartView === 'mechanic' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        按机制
                      </button>
                    </div>
                  </div>
                </div>

                <div className="h-72">
                  {(timeAxis === 'pull' ? progressDataByPull : progressDataByDay).length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={(timeAxis === 'pull' ? progressDataByPull : progressDataByDay) as any[]} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                        
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={12} 
                          domain={[0, chartView === 'part' ? Math.max(partScale.length - 1, 1) : Math.max(mechScale.length - 1, 1)]}
                          tickFormatter={(val) => {
                            if (chartView === 'part') return partScale[val]?.name || '';
                            const m = mechScale[val];
                            return m ? `[${m.partName}] ${m.mechName}` : '';
                          }}
                          width={120}
                        />

                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                          itemStyle={{ color: '#e2e8f0' }}
                          formatter={(value: any, name: any) => {
                            let label = '';
                            if (chartView === 'part') label = partScale[Number(value)]?.name || '未知';
                            else {
                              const m = mechScale[Number(value)];
                              label = m ? `[${m.partName}] ${m.mechName}` : '未知';
                            }
                            return [label, name === 'current' ? (timeAxis === 'pull' ? '当把进度' : '当日最远进度') : '历史最远进度'];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <Line type="monotone" name="max" dataKey={chartView === 'part' ? 'maxPart' : 'maxMech'} stroke="#a855f7" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        <Line type="linear" name="current" dataKey={chartView === 'part' ? 'currentPart' : 'currentMech'} stroke="#3b82f6" strokeWidth={2} opacity={0.8} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm">暂无进度数据，快去记录第一次犯错吧</div>
                  )}
                </div>
              </div>

              {/* 柱状图和饼图 */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-5">
                <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                  <BarChart2 size={20} className="text-emerald-400" /> 统计数据分析
                </h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 近期犯错趋势 */}
                  <div className="h-[300px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm text-slate-400 font-medium">犯错趋势 (堆叠图)</h3>
                      <div className="scale-90 origin-right">
                        <DateRangePicker value={trendDateRange} onChange={setTrendDateRange} availableDates={activeDates} />
                      </div>
                    </div>
                    {dailyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                          <YAxis stroke="#94a3b8" fontSize={12} />
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                            itemStyle={{ color: '#e2e8f0' }}
                          />
                          <Legend layout="vertical" verticalAlign="middle" align="right" width={40} wrapperStyle={{ fontSize: '12px', paddingLeft: '5px' }} />
                          {activeTeam.players.map((p, index) => (
                            <Bar key={p.id} dataKey={p.name || p.role} stackId="a" fill={COLORS[index % COLORS.length]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-sm">暂无数据</div>
                    )}
                  </div>

                  {/* 机制犯错占比 */}
                  <div className="h-[300px] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm text-slate-400 font-medium flex items-center gap-1">机制犯错分布 (嵌套图) <HintTooltip content="内圈展示副本阶段的犯错占比，外圈展示该阶段下具体机制的犯错占比。" /></h3>
                      <div className="scale-90 origin-right">
                        <DateRangePicker value={pieDateRange} onChange={setPieDateRange} availableDates={activeDates} />
                      </div>
                    </div>
                    {pieDataMech.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieDataPart}
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={45}
                            dataKey="value"
                            nameKey="name"
                            labelLine={false}
                          >
                            {pieDataPart.map((_entry, index) => (
                              <Cell key={`cell-part-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.6} />
                            ))}
                          </Pie>
                          <Pie
                            data={pieDataMech}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={75}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                            label={(props) => `${props.name} ${((props.percent || 0) * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {pieDataMech.map((_entry, index) => (
                              <Cell key={`cell-mech-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                            itemStyle={{ color: '#e2e8f0' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-sm">暂无数据</div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 italic">
              请选择或创建一个队伍
            </div>
          )}
        </div>
      </div>
      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2"><Users size={18} className="text-emerald-400" /> 创建新队伍</h3>
              <button onClick={() => setShowCreateTeamModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">队伍名称</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="例如：绝O晚间队"
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">攻略副本</label>
                <select
                  value={selectedBossId}
                  onChange={(e) => setSelectedBossId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="">请选择...</option>
                  {bossProfiles.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 mt-2 p-3 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                <input 
                  type="checkbox" 
                  checked={celebrationMode}
                  onChange={(e) => setCelebrationMode(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 bg-slate-800"
                />
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-sm text-slate-200">开启"初见庆祝模式"</span>
                  <div className="relative group flex items-center">
                    <HelpCircle size={14} className="text-slate-400 cursor-help" />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-slate-800 border border-slate-600 text-xs text-slate-300 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      开启后，第一次到达新阶段时可以在不选中犯错点和队员的情况下直接记录，同时会有庆祝特效。
                    </div>
                  </div>
                </div>
              </label>
              <button
                onClick={() => {
                  handleCreateTeam();
                  setShowCreateTeamModal(false);
                }}
                disabled={!canCreateTeam || !newTeamName || !selectedBossId}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded px-4 py-2 font-medium transition-colors mt-2"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Settings Modal */}
      {showSettingsModal && activeTeam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-white flex items-center gap-2"><Settings size={18} className="text-blue-400" /> 队伍设置: {activeTeam.name}</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-5 overflow-y-auto max-h-[70vh]">
              {/* Copy Team Button */}
              <div className="flex justify-end pb-3 border-b border-slate-700">
                <button
                  onClick={() => {
                    if (confirm('确认复制该队伍的全部设置与成员名单到新队伍吗？')) {
                      const newTeam = {
                        ...activeTeam,
                        name: `${activeTeam.name} (复制)`
                      };
                      addTeam(newTeam);
                      setShowSettingsModal(false);
                    }
                  }}
                  disabled={!canManageActiveTeam}
                  className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm px-3 py-1.5 rounded transition-colors"
                >
                  复制当前队伍
                </button>
              </div>

              {/* Boss ID Update */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">所属副本</label>
                <select
                  value={tempSettings.bossId}
                  onChange={(e) => setTempSettings(s => ({ ...s, bossId: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="" disabled>选择副本</option>
                  {bossProfiles.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">队长</label>
                <select
                  value={tempSettings.captainUserId}
                  onChange={(e) => setTempSettings(s => ({ ...s, captainUserId: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="">暂不指定</option>
                  {workspaceUsers
                    .filter(user => user.role === 'admin' || user.role === 'captain')
                    .map(user => (
                      <option key={user.id} value={user.id}>
                        {user.displayName} ({user.role})
                      </option>
                    ))}
                </select>
              </div>

              {/* Day Reset Time */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1 flex items-center gap-1">
                  结算跨天时间 <HintTooltip content="用于在数据分析和明细中分割每一天的活动记录。FF14 玩家通常习惯将凌晨（如 04:00）作为新一天的开始。" />
                </label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={tempSettings.dayResetTime}
                    onChange={(e) => setTempSettings(s => ({ ...s, dayResetTime: e.target.value }))}
                    className="bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
                  />
                  <span className="text-xs text-slate-500 self-center">在该时间之前的记录算作昨天（夜猫子友好）。</span>
                </div>
              </div>

              {/* Celebration Mode */}
              <div>
                <label className="flex items-center gap-2 p-3 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={tempSettings.celebrationMode}
                    onChange={(e) => setTempSettings(s => ({ ...s, celebrationMode: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-800"
                  />
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-sm text-slate-200">初见庆祝模式</span>
                    <HintTooltip content="全团到达新进度的庆祝按钮！不计入任何人的个人犯错，但会自动推进团队的开荒总把数。" />
                  </div>
                </label>
                {tempSettings.celebrationMode && (
                  <div className="mt-2 ml-6 flex items-center gap-2">
                    <label className="text-sm text-slate-400 flex items-center gap-1">机制初见容错次数: <HintTooltip content="设定开荒新进度时，允许连续记录多少次免责的“初见把数”。" /></label>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setTempSettings(s => ({ ...s, celebrationAllowance: Math.max(0, s.celebrationAllowance - 1) }))}
                        className="bg-slate-700 hover:bg-slate-600 text-white w-6 h-6 rounded flex items-center justify-center"
                      >-</button>
                      <input 
                        type="number" 
                        min="0"
                        value={tempSettings.celebrationAllowance}
                        onChange={e => setTempSettings(s => ({ ...s, celebrationAllowance: Math.max(0, parseInt(e.target.value) || 0) }))}
                        className="w-12 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-center text-sm focus:outline-none focus:border-blue-500 text-white"
                      />
                      <button 
                        onClick={() => setTempSettings(s => ({ ...s, celebrationAllowance: s.celebrationAllowance + 1 }))}
                        className="bg-slate-700 hover:bg-slate-600 text-white w-6 h-6 rounded flex items-center justify-center"
                      >+</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Levels */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1 flex justify-between items-center">
                  <span className="flex items-center gap-1">错误分级 (最多 5 项) <HintTooltip content="可根据犯错的影响程度自定义等级（如：伤害降低是小问题，死亡是中问题，导致团灭是大问题）。排在第一位的等级通常为“团灭”，将作为计算“总把数”的依据。" /></span>
                  {tempSettings.errorLevels.length < 5 && (
                    <button 
                      onClick={() => setTempSettings(s => ({ ...s, errorLevels: [...s.errorLevels, '个人死亡'] }))}
                      className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                    >
                      <Plus size={12} /> 添加分级
                    </button>
                  )}
                </label>
                <div className="space-y-2 mt-2">
                  {tempSettings.errorLevels.map((lvl, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        value={lvl}
                        readOnly={idx === 0}
                        onChange={(e) => {
                          const newLevels = [...tempSettings.errorLevels];
                          newLevels[idx] = e.target.value;
                          setTempSettings(s => ({ ...s, errorLevels: newLevels }));
                        }}
                        className={`flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 text-white ${idx === 0 ? 'opacity-70 cursor-not-allowed' : ''}`}
                      />
                      {idx > 0 && (
                        <button 
                          onClick={() => {
                            const newLevels = [...tempSettings.errorLevels];
                            newLevels.splice(idx, 1);
                            setTempSettings(s => ({ ...s, errorLevels: newLevels }));
                          }}
                          className="bg-slate-700 hover:bg-red-900/50 hover:text-red-400 border border-slate-600 text-slate-400 rounded px-2 py-1.5 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">注意：首个选项必须为“团灭”。只有记录“团灭”时，当前把数才会自动 +1。</p>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-700 bg-slate-900/50 shrink-0">
              <button
                onClick={() => {
                  updateTeamSettings(activeTeam.id, {
                    bossId: tempSettings.bossId,
                    captainUserId: tempSettings.captainUserId || undefined,
                    dayResetTime: tempSettings.dayResetTime,
                    celebrationMode: tempSettings.celebrationMode,
                    errorLevels: tempSettings.errorLevels.filter(l => l.trim()),
                    celebrationAllowance: tempSettings.celebrationAllowance
                  });
                  setShowSettingsModal(false);
                }}
                disabled={!canManageActiveTeam}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded px-4 py-2 font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Save size={18} /> 保存设置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Add Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900/50 p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-white flex items-center gap-2"><Users size={18} className="text-blue-400" /> 批量添加队员</h3>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2">
              <div className="flex gap-2 text-xs text-slate-400 px-1">
                <div className="w-1/4">位置</div>
                <div className="w-1/3">职业 (选填)</div>
                <div className="flex-1">游戏ID (选填)</div>
                <div className="w-8"></div>
              </div>
              {batchRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={row.role}
                    onChange={(e) => {
                      const newRows = [...batchRows];
                      newRows[idx].role = e.target.value;
                      setBatchRows(newRows);
                    }}
                    className="w-1/4 bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="MT"
                  />
                  <input
                    type="text"
                    value={row.job}
                    onChange={(e) => {
                      const newRows = [...batchRows];
                      newRows[idx].job = e.target.value;
                      setBatchRows(newRows);
                    }}
                    className="w-1/3 bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="黑骑"
                  />
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => {
                      const newRows = [...batchRows];
                      newRows[idx].name = e.target.value;
                      setBatchRows(newRows);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="游戏ID"
                  />
                  <button 
                    onClick={() => {
                      const newRows = [...batchRows];
                      newRows.splice(idx, 1);
                      setBatchRows(newRows);
                    }}
                    disabled={!canManageActiveTeam}
                    className="text-slate-500 hover:text-red-400 disabled:text-slate-700 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <div className="pt-2">
                <button
                  onClick={() => setBatchRows([...batchRows, { role: '', name: '', job: '' }])}
                  disabled={!canManageActiveTeam}
                  className="w-full flex items-center justify-center gap-1 bg-slate-700/50 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-500 text-slate-300 py-2 rounded border border-slate-600 border-dashed transition-colors text-sm"
                >
                  <Plus size={16} /> 增加一行
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-900/50 shrink-0">
              <button
                onClick={handleBatchAdd}
                disabled={!canManageActiveTeam}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded px-4 py-2 font-medium flex items-center justify-center gap-2 transition-colors"
              >
                确认批量添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
