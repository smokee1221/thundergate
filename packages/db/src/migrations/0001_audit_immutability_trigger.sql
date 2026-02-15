-- Custom migration: audit_logs immutability trigger
-- Prevents UPDATE and DELETE on audit_logs to ensure tamper-evident logging

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % operations are prohibited', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- Add indexes for common query patterns
CREATE INDEX idx_audit_logs_agent_id ON audit_logs(agent_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_engine_decision ON audit_logs(engine_decision);
CREATE INDEX idx_audit_logs_risk_score ON audit_logs(risk_score);

CREATE INDEX idx_hitl_queue_status ON hitl_queue(status);
CREATE INDEX idx_hitl_queue_expires_at ON hitl_queue(expires_at);
CREATE INDEX idx_hitl_queue_created_at ON hitl_queue(created_at);

CREATE INDEX idx_rules_priority ON rules(priority);
CREATE INDEX idx_rules_enabled ON rules(enabled);
