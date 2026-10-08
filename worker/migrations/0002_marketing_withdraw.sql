-- [Define404] 가게냥 (gage-meo): 광고 수신 거부 링크와 거부 시각
ALTER TABLE leads ADD COLUMN unsub_token TEXT;
ALTER TABLE leads ADD COLUMN marketing_withdrawn_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_leads_unsub ON leads (unsub_token);
