DROP TABLE IF EXISTS telemetry_events;

CREATE TABLE telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  boss_id TEXT,
  mechanic_id TEXT,
  total_pulls INTEGER DEFAULT 0,
  mistake_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
