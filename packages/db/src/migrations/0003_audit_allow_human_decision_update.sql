-- Allow UPDATE on audit_logs ONLY for human decision fields.
-- The original request data and hash chain remain immutable.
-- Only human_decision, operator_id, and modified_payload can be set (from NULL to a value).
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs is append-only: DELETE operations are prohibited';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Allow updating ONLY the human decision columns (null → value)
    -- Block changes to any other columns
    IF OLD.agent_id IS DISTINCT FROM NEW.agent_id
      OR OLD.rule_id IS DISTINCT FROM NEW.rule_id
      OR OLD.request_method IS DISTINCT FROM NEW.request_method
      OR OLD.request_url IS DISTINCT FROM NEW.request_url
      OR OLD.request_headers::text IS DISTINCT FROM NEW.request_headers::text
      OR OLD.request_payload::text IS DISTINCT FROM NEW.request_payload::text
      OR OLD.risk_score IS DISTINCT FROM NEW.risk_score
      OR OLD.engine_decision IS DISTINCT FROM NEW.engine_decision
      OR OLD.final_payload::text IS DISTINCT FROM NEW.final_payload::text
      OR OLD.prev_hash IS DISTINCT FROM NEW.prev_hash
      OR OLD.entry_hash IS DISTINCT FROM NEW.entry_hash
      OR OLD.sequence_number IS DISTINCT FROM NEW.sequence_number
      OR OLD.created_at IS DISTINCT FROM NEW.created_at
    THEN
      RAISE EXCEPTION 'audit_logs: only human_decision, operator_id, modified_payload, response_status, response_body can be updated';
    END IF;

    -- Only allow setting human decision fields from NULL
    IF OLD.human_decision IS NOT NULL AND OLD.human_decision IS DISTINCT FROM NEW.human_decision THEN
      RAISE EXCEPTION 'audit_logs: human_decision cannot be changed once set';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
