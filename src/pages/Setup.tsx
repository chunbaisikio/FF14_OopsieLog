import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import type { AppState, BossProfile } from '../store';
import { Swords, Users, ArrowRight, Check, Download, Save, UserPlus, HelpCircle } from 'lucide-react';

export default function Setup() {
  const navigate = useNavigate();
  const { bossProfiles, addBossProfile, importBossProfile, importData, addBossPart, addTeam, addPlayerToTeam, hasSeenGuidance, setHasSeenGuidance, setTelemetryConsent } = useAppStore();
  
  const [localConsent, setLocalConsent] = useState(false);
  const [step, setStep] = useState(() => bossProfiles.length > 0 ? 3 : 1);
  const [bossName, setBossName] = useState('妖星乱舞绝境战');
  const [partName, setPartName] = useState('P1');
  const [teamName, setTeamName] = useState('绝小丑-晚间队');
  const [celebrationMode, setCelebrationMode] = useState(true);

  const defaultRoles = ['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4'];
  const [batchRows, setBatchRows] = useState(defaultRoles.map(role => ({ role, name: '', job: '' })));

  const mode = import.meta.env.VITE_STORAGE_MODE === 'api' ? 'api' : 'local';

  if (!hasSeenGuidance) {
    return (
      <div className="w-full max-w-lg mx-auto bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">欢迎使用 FF14 Oopsie</h1>
        
        {mode === 'local' ? (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-6">
            <h2 className="text-orange-400 font-bold mb-2 flex items-center gap-2">⚠️ 数据存储警告 (多用户版)</h2>
            <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
              <li>您的数据<strong>仅保存在当前浏览器的缓存（LocalStorage）中</strong>。</li>
              <li>清除浏览器缓存、使用无痕模式、或更换浏览器/设备，都会导致<strong>数据永久丢失</strong>！</li>
              <li>建议您：定期在“设置”页面导出 JSON 文件进行备份。</li>
            </ul>
          </div>
        ) : (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <h2 className="text-red-400 font-bold mb-2 flex items-center gap-2">⚠️ 数据安全警告 (Docker/单用户版)</h2>
            <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1">
              <li>您的数据目前保存在后端的 SQLite 数据库中。</li>
              <li>当前 Docker 服务<strong>未内置账号系统和鉴权</strong>。</li>
              <li>请<strong>绝对不要</strong>将该服务直接暴露在公网（例如不加防护地开放端口），否则任何人都可以访问和篡改您的数据！</li>
              <li>建议仅在内网使用，或配合 Nginx Basic Auth 等进行访问控制。</li>
              <li>请务必在运行容器时<strong>挂载存储卷（-v）</strong>进行数据持久化，否则每次更新或重建容器都会导致<strong>数据永久丢失</strong>！</li>
            </ul>
          </div>
        )}

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <h2 className="text-blue-400 font-bold mb-2 flex items-center gap-2">📊 改善计划 (遥测) <span className="text-sm text-slate-400 font-normal">(不勾选也可正常使用)</span></h2>
          <p className="text-sm text-slate-300 mb-3">
            为了帮助优化此应用，您可以选择匿名发送基础统计数据。数据仅用于在 NGA 等平台发表相关副本的宏观犯错率分析贴。
          </p>
          <ul className="text-sm text-slate-300 list-disc pl-5 space-y-1 mb-4">
            <li><strong>绝对不包含</strong>：任何用户 ID、队伍名称或团灭备注（因为备注可能包含队员昵称，无法脱敏）。</li>
            <li><strong>包含的内容</strong>：仅聚合指标（例如：总把数、犯错最高的机制、通关耗时等）。</li>
            <li>您随时可以在左侧菜单的 <strong>“系统设置”</strong> 页面中关闭此功能。</li>
          </ul>
          
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="mt-0.5">
              <input 
                type="checkbox" 
                checked={localConsent}
                onChange={e => setLocalConsent(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-blue-500 focus:ring-blue-500/50"
              />
            </div>
            <span className="text-sm font-medium text-white group-hover:text-blue-200 transition-colors">
              我同意匿名发送宏观统计数据，以帮助作者改进应用。
            </span>
          </label>
        </div>

        <button 
          onClick={() => {
            setTelemetryConsent(localConsent);
            setHasSeenGuidance(true);
          }}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2"
        >
          我已了解，开始使用 <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  const getLatestBoss = () => bossProfiles[bossProfiles.length - 1];

  const handleCreateBoss = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bossName.trim()) return;
    addBossProfile({ name: bossName.trim() });
    setStep(2);
  };

  const handleCreatePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) return;
    const latestBoss = getLatestBoss();
    if (latestBoss) addBossPart(latestBoss.id, partName.trim());
    setStep(3);
  };


  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    const latestBoss = getLatestBoss();
    if (latestBoss) {
      addTeam({ name: teamName.trim(), bossId: latestBoss.id, players: [], celebrationMode });
    }
    setStep(4);
  };

  const finishSetup = (e: React.FormEvent) => {
    e.preventDefault();
    const state = useAppStore.getState();
    const activeTeamId = state.activeTeamId || state.teams[state.teams.length - 1]?.id;
    if (activeTeamId) {
      batchRows.forEach(row => {
        if (row.name.trim() || row.job.trim() || row.role) {
          addPlayerToTeam(activeTeamId, {
            role: row.role || '其他',
            name: row.name.trim(),
            job: row.job.trim(),
            status: 'on_field'
          });
        }
      });
    }
    navigate('/');
  };

  const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const profile = JSON.parse(event.target?.result as string) as BossProfile;
        if (profile.parts && Array.isArray(profile.parts)) {
          importBossProfile(profile);
          setStep(3); // 跳过阶段，直接创建队伍
        } else {
          alert('无效的副本模版文件！');
        }
      } catch (err) {
        alert('文件解析失败！');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as Partial<AppState>;
        if (data.bossProfiles && data.teams) {
          importData(data);
          navigate('/');
        } else {
          alert('无效的备份数据文件！');
        }
      } catch (err) {
        alert('文件解析失败！');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl relative overflow-hidden">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">欢迎使用 FF14 Oopsie</h1>
        <p className="text-slate-400 text-sm">只需五步设置，为您构建专业的复盘体系</p>
      </div>

      <div className="flex justify-between items-center mb-8 relative px-2">
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-700 -z-10"></div>
        {[1, 2, 3, 4].map(num => (
          <div key={num} className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${step >= num ? 'bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-slate-700 text-slate-400'}`}>
            {num}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-right-4">
          <form onSubmit={handleCreateBoss} className="space-y-4">
            <div className="flex items-center gap-3 text-blue-400 mb-4">
              <Swords size={24} />
              <h2 className="text-lg font-semibold">第一步：创建副本</h2>
            </div>
            <p className="text-sm text-slate-400">您打算开荒什么副本？(例如：绝欧米茄、绝龙诗等)</p>
            <input
              type="text"
              autoFocus
              value={bossName}
              onChange={(e) => setBossName(e.target.value)}
              placeholder="输入副本名称..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!bossName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
            >
              下一步 <ArrowRight size={18} />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 text-center mb-4">或者，如果您有现成的模版或备份：</p>
            <div className="flex gap-3">
              <label className="flex-1 flex flex-col items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 border border-slate-600 text-slate-300 py-3 rounded-lg cursor-pointer transition-colors text-xs font-medium">
                <Download size={18} className="text-emerald-400" /> 导入副本模版
                <input type="file" accept=".json" onChange={handleImportTemplate} className="hidden" />
              </label>
              <label className="flex-1 flex flex-col items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 border border-slate-600 text-slate-300 py-3 rounded-lg cursor-pointer transition-colors text-xs font-medium">
                <Save size={18} className="text-purple-400" /> 恢复全部备份
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={handleCreatePart} className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center gap-3 text-blue-400 mb-4">
            <Swords size={24} />
            <h2 className="text-lg font-semibold">第二步：添加阶段</h2>
          </div>
          <p className="text-sm text-slate-400">副本通常包含多个阶段，请先录入第一个阶段。(如：P1、一运等)</p>
          <input
            type="text"
            autoFocus
            value={partName}
            onChange={(e) => setPartName(e.target.value)}
            placeholder="输入阶段名称..."
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!partName.trim()}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
          >
            下一步 <ArrowRight size={18} />
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleCreateTeam} className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center gap-3 text-emerald-400 mb-4">
            <Users size={24} />
            <h2 className="text-lg font-semibold">第三步：创建队伍</h2>
          </div>
          <p className="text-sm text-slate-400">给您的固定队起个名字吧。</p>
          <input
            type="text"
            autoFocus
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="输入队伍名称..."
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
          />
          <label className="flex items-center gap-2 mt-4 p-3 bg-slate-900/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <input 
              type="checkbox" 
              checked={celebrationMode}
              onChange={(e) => setCelebrationMode(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500 bg-slate-800"
            />
            <div className="flex items-center gap-1.5 flex-1">
              <span className="text-sm text-slate-200">开启初见庆祝模式</span>
              <div className="relative group flex items-center">
                <HelpCircle size={14} className="text-slate-400 cursor-help" />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 p-2 bg-slate-800 border border-slate-600 text-xs text-slate-300 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  开启后，第一次到达新机制时可以免选人直接记录并伴随特效。该记录不计入个人犯错。在队伍设置中还可以调整“初见容错次数”，允许对同一个新机制进行多次初见记录（适用于全员秒杀无法一次看清机制的场景）。
                </div>
              </div>
            </div>
          </label>
          <button
            type="submit"
            disabled={!teamName.trim()}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-colors"
          >
            下一步 <ArrowRight size={18} />
          </button>
        </form>
      )}

      {step === 4 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center gap-3 text-emerald-400 mb-4">
            <UserPlus size={24} />
            <h2 className="text-lg font-semibold">第四步：添加队伍成员</h2>
          </div>
          <p className="text-sm text-slate-400">您可以一次性把所有成员都录入完，也可以点击完成稍后再加。</p>
          
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
            <div className="flex gap-2 text-xs text-slate-400 px-1">
              <div className="w-1/4">位置</div>
              <div className="flex-1">游戏ID (选填)</div>
              <div className="w-1/3">职业 (选填)</div>
              <div className="w-8"></div>
            </div>
            {batchRows.map((row, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={row.role}
                  onChange={(e) => {
                    const newRows = [...batchRows];
                    newRows[idx].role = e.target.value;
                    setBatchRows(newRows);
                  }}
                  className="w-1/4 bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
                  placeholder="MT"
                />
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => {
                    const newRows = [...batchRows];
                    newRows[idx].name = e.target.value;
                    setBatchRows(newRows);
                  }}
                  className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
                  placeholder={idx === 0 ? "丝瓜卡夫卡@拂晓之间" : ""}
                />
                <input
                  type="text"
                  value={row.job}
                  onChange={(e) => {
                    const newRows = [...batchRows];
                    newRows[idx].job = e.target.value;
                    setBatchRows(newRows);
                  }}
                  className="w-1/3 bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
                  placeholder={idx === 0 ? "暗黑骑士/DK" : ""}
                />
                <button 
                  onClick={() => {
                    const newRows = [...batchRows];
                    newRows.splice(idx, 1);
                    setBatchRows(newRows);
                  }}
                  className="text-slate-500 hover:text-red-400 p-1 w-8 flex items-center justify-center shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3 mt-4 pt-2 border-t border-slate-700/50">
            <button
              onClick={() => setBatchRows([...batchRows, { role: '', name: '', job: '' }])}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-medium transition-colors"
            >
              <UserPlus size={18} /> 添加空行
            </button>
            <button
              onClick={finishSetup}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-medium transition-colors"
            >
              完成建队 <Check size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
