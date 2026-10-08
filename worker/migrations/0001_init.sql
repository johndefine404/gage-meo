-- [Define404] 가게냥 (gage-meo) D1 테이블

-- 점검 결과. 리포트 메일을 만들 때 다시 읽는다 (7일 뒤 지운다)
CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  store_name TEXT NOT NULL,
  region TEXT NOT NULL,
  url TEXT,
  score INTEGER NOT NULL,
  result TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_checks_created ON checks (created_at);

-- 상세 리포트를 신청한 사람
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  check_id TEXT NOT NULL,
  email TEXT NOT NULL,
  store_name TEXT NOT NULL,
  region TEXT NOT NULL,
  score INTEGER NOT NULL,
  consent_privacy_at INTEGER NOT NULL,
  consent_marketing INTEGER NOT NULL DEFAULT 0,
  consent_marketing_at INTEGER,
  consent_version TEXT NOT NULL,
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email);

-- 하루 사용량 (점검, 리포트 메일)
CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);
