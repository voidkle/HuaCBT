CREATE TYPE "public"."presentation_kind" AS ENUM('file', 'google', 'canva');--> statement-breakpoint
CREATE TYPE "public"."presentation_status" AS ENUM('converting', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "presentation_progress" (
	"user_id" bigint NOT NULL,
	"presentation_id" bigint NOT NULL,
	"page" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "presentation_progress_user_id_presentation_id_pk" PRIMARY KEY("user_id","presentation_id")
);
--> statement-breakpoint
CREATE TABLE "presentations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "presentations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" "presentation_kind" NOT NULL,
	"link" text,
	"status" "presentation_status" DEFAULT 'converting' NOT NULL,
	"failure_reason" text,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"page_count" integer,
	"has_cover" boolean DEFAULT false NOT NULL,
	"uploaded_by" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "presentation_progress" ADD CONSTRAINT "presentation_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_progress" ADD CONSTRAINT "presentation_progress_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;