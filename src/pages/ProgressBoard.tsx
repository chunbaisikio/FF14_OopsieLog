import { useEffect, useMemo, useState } from 'react';
import { BarChart2, GitCompareArrows, TimerReset } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getWorkspaceSession } from '../utils/session';
import { fetchJson } from '../utils/http';

type ProgressRow = {
  workspaceId: string;
  workspaceName: string;
  captainName: string;
  bossId: string;
  bossName: string;
  teamId: string;
  teamName: string;
  currentPart: string;
  currentMechanic: string;
  activeDays: number;
  totalPulls: number;
  progressScore: number;
  partScore: number;
};

export default function ProgressBoard() {
  const session = getWorkspaceSession();
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [selectedBossId, setSelectedBossId] = useState('');
  const [status, setStatus] = useState('正在加载进度数据...');

  useEffect(() => {
    if (session?.role !== 'admin') return;

    fetchJson<{ rows: ProgressRow[] }>(`/api/admin/progress?actorPasscode=${session.passcode}`)
      .then((data) => {
        setRows(data.rows ?? []);
        setStatus(data.rows?.length ? '' : '当前还没有 captain 工作空间产出可对比的进度数据。');
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : '进度数据加载失败。');
      });
  }, [session?.passcode, session?.role]);

  const availableBosses = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => map.set(row.bossId, row.bossName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const activeBossId = selectedBossId || availableBosses[0]?.id || '';
  const comparisonRows = useMemo(
    () => rows.filter((row) => row.bossId === activeBossId).sort((a, b) => b.progressScore - a.progressScore || a.totalPulls - b.totalPulls),
    [rows, activeBossId]
  );

  if (session?.role !== 'admin') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-6 text-center">
          <h1 className="text-xl font-bold text-white">仅管理员可查看</h1>
          <p className="mt-2 text-sm text-slate-400">
            进度总览用于横向比较不同 captain 工作空间下的同副本攻略状态。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitCompareArrows className="text-cyan-400" size={24} />
            队长空间进度总览
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            只面向管理员，用来横向比较不同 captain 工作空间下，同一副本的多支队伍进度。
          </p>
        </div>

        <label className="flex flex-col gap-2 text-sm text-slate-400">
          选择副本
          <select
            value={activeBossId}
            onChange={(event) => setSelectedBossId(event.target.value)}
            className="min-w-64 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
          >
            {availableBosses.map((boss) => (
              <option key={boss.id} value={boss.id}>
                {boss.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {status && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-300">
          {status}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <BarChart2 size={20} className="text-cyan-400" />
            横向进度比较
          </h2>

          {comparisonRows.length > 0 ? (
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonRows} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" allowDecimals={false} />
                  <YAxis dataKey="teamName" type="category" width={110} stroke="#cbd5e1" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                    formatter={(value, name) => [
                      typeof value === 'number' ? value : Number(value ?? 0),
                      name === 'progressScore' ? '机制进度层级' : '阶段进度层级'
                    ]}
                  />
                  <Bar dataKey="partScore" name="partScore" fill="#334155" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="progressScore" name="progressScore" fill="#22d3ee" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-slate-500">当前副本还没有可对比的队伍数据。</div>
          )}
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <TimerReset size={20} className="text-amber-400" />
            工作空间与攻略状态
          </h2>

          <div className="space-y-3">
            {comparisonRows.map((row) => (
              <div key={row.teamId} className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{row.teamName}</h3>
                    <p className="mt-1 text-sm text-slate-400">{row.workspaceName} · 队长 {row.captainName}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-cyan-300">{row.currentPart}</div>
                    <div className="text-xs text-slate-500">{row.currentMechanic}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="累计把数" value={`${row.totalPulls || 0}`} />
                  <Metric label="活跃天数" value={`${row.activeDays || 0}`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
