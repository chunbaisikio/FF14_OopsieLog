export function getLogicalDate(date: Date = new Date(), resetTimeStr: string = '04:00'): string {
  const [resetHour, resetMinute] = resetTimeStr.split(':').map(Number);
  
  // Create a copy of the date to avoid mutating the original
  const logicalDate = new Date(date.getTime());
  
  // Calculate the reset threshold for this date
  const resetThreshold = new Date(logicalDate.getFullYear(), logicalDate.getMonth(), logicalDate.getDate(), resetHour, resetMinute, 0, 0);
  
  // If the current time is before the reset threshold, it conceptually belongs to the previous day
  if (logicalDate.getTime() < resetThreshold.getTime()) {
    logicalDate.setDate(logicalDate.getDate() - 1);
  }
  
  // Note: toISOString() uses UTC. If the user is in Asia/Shanghai, it might return yesterday if called around morning.
  // We need to return local date string YYYY-MM-DD.
  const year = logicalDate.getFullYear();
  const month = String(logicalDate.getMonth() + 1).padStart(2, '0');
  const day = String(logicalDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
