import { useEffect } from 'react';
import { useAppStore } from '../store';
import { sendTelemetryEvent } from './telemetry';

export default function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const store = useAppStore();

  useEffect(() => {
    // 只有用户同意时才会执行遥测
    if (!store.telemetryConsent) return;

    // 提取聚合数据
    // 我们仅收集：总团灭次数，最容易犯错的机制ID，不包含任何私人文本
    const aggregatedStats = () => {
      const { mistakes, teams } = useAppStore.getState();
      const activeTeamId = useAppStore.getState().activeTeamId;
      if (!activeTeamId) return null;

      const teamMistakes = mistakes.filter(m => m.teamId === activeTeamId);
      if (teamMistakes.length === 0) return null;

      const team = teams.find(t => t.id === activeTeamId);
      if (!team) return null;

      // 找出犯错最多的机制
      const mechanicCounts: Record<string, number> = {};
      teamMistakes.forEach(m => {
        if (m.mechanicId) {
          mechanicCounts[m.mechanicId] = (mechanicCounts[m.mechanicId] || 0) + 1;
        }
      });
      let worstMechanicId = '';
      let maxCount = 0;
      Object.entries(mechanicCounts).forEach(([mechId, count]) => {
        if (count > maxCount) {
          maxCount = count;
          worstMechanicId = mechId;
        }
      });

      return {
        action: 'daily_summary',
        bossId: team.bossId,
        totalPulls: teamMistakes.length, // 用犯错数估算一下活跃度
        mechanicId: worstMechanicId,
        mistakeCount: maxCount
      };
    };

    // 初始加载时延迟发送一次
    const timeout = setTimeout(() => {
      const stats = aggregatedStats();
      if (stats) {
        sendTelemetryEvent(stats);
      }
    }, 10000); // 等待10秒后再发送，避免阻挡渲染

    // 每天定时发送一次 (24h)
    const interval = setInterval(() => {
      const stats = aggregatedStats();
      if (stats) {
        sendTelemetryEvent(stats);
      }
    }, 24 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [store.telemetryConsent]); // 依赖中仅包含 consent

  return <>{children}</>;
}
