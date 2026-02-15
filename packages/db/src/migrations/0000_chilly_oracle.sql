CREATE TYPE "public"."engine_decision" AS ENUM('ALLOW', 'BLOCK', 'FLAG_FOR_REVIEW', 'MODIFY');--> statement-breakpoint
CREATE TYPE "public"."human_decision" AS ENUM('APPROVED', 'MODIFIED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."operator_role" AS ENUM('ADMIN', 'OPERATOR', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."queue_status" AS ENUM('PENDING', 'CLAIMED', 'APPROVED', 'MODIFIED', 'REJECTED', 'ESCALATED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."risk_tier" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."rule_action" AS ENUM('ALLOW', 'BLOCK', 'FLAG_FOR_REVIEW', 'MODIFY');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"api_key_hash" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_api_key_hash_unique" UNIQUE("api_key_hash")
);
--> statement-breakpoint
CREATE TABLE "api_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"base_url" varchar(2048) NOT NULL,
	"risk_tier" "risk_tier" DEFAULT 'MEDIUM' NOT NULL,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_targets_base_url_unique" UNIQUE("base_url")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_number" bigserial NOT NULL,
	"agent_id" uuid NOT NULL,
	"rule_id" uuid,
	"request_method" varchar(10) NOT NULL,
	"request_url" varchar(2048) NOT NULL,
	"request_headers" jsonb NOT NULL,
	"request_payload" jsonb,
	"risk_score" integer NOT NULL,
	"engine_decision" "engine_decision" NOT NULL,
	"human_decision" "human_decision",
	"operator_id" uuid,
	"modified_payload" jsonb,
	"final_payload" jsonb NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"latency_ms" integer NOT NULL,
	"prev_hash" varchar(64) NOT NULL,
	"entry_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_logs_sequence_number_unique" UNIQUE("sequence_number"),
	CONSTRAINT "audit_logs_entry_hash_unique" UNIQUE("entry_hash")
);
--> statement-breakpoint
CREATE TABLE "hitl_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_log_id" uuid NOT NULL,
	"status" "queue_status" DEFAULT 'PENDING' NOT NULL,
	"assigned_to" uuid,
	"escalated_to" uuid,
	"operator_notes" text,
	"escalation_tier" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hitl_queue_audit_log_id_unique" UNIQUE("audit_log_id")
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"role" "operator_role" DEFAULT 'OPERATOR' NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operators_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"priority" integer DEFAULT 100 NOT NULL,
	"conditions" jsonb NOT NULL,
	"action" "rule_action" NOT NULL,
	"severity" "severity" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_queue" ADD CONSTRAINT "hitl_queue_audit_log_id_audit_logs_id_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_logs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_queue" ADD CONSTRAINT "hitl_queue_assigned_to_operators_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hitl_queue" ADD CONSTRAINT "hitl_queue_escalated_to_operators_id_fk" FOREIGN KEY ("escalated_to") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;