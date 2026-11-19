CREATE TABLE app_auth_tickets (
  ticket_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX idx_app_auth_tickets_expiry ON app_auth_tickets(expires_at);
