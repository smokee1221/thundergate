-- HITL Queue LISTEN/NOTIFY triggers
-- Enables real-time push notifications to connected proxy/dashboard instances

-- Notify on new queue items
CREATE OR REPLACE FUNCTION notify_hitl_new()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('hitl_new', json_build_object(
    'id', NEW.id,
    'audit_log_id', NEW.audit_log_id,
    'status', NEW.status,
    'escalation_tier', NEW.escalation_tier,
    'expires_at', NEW.expires_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hitl_queue_insert_notify
  AFTER INSERT ON hitl_queue
  FOR EACH ROW
  EXECUTE FUNCTION notify_hitl_new();

-- Notify on queue item updates (claim, decide, escalate)
CREATE OR REPLACE FUNCTION notify_hitl_updated()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('hitl_updated', json_build_object(
    'id', NEW.id,
    'audit_log_id', NEW.audit_log_id,
    'status', NEW.status,
    'escalation_tier', NEW.escalation_tier,
    'assigned_to', NEW.assigned_to,
    'resolved_at', NEW.resolved_at
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hitl_queue_update_notify
  AFTER UPDATE ON hitl_queue
  FOR EACH ROW
  EXECUTE FUNCTION notify_hitl_updated();
