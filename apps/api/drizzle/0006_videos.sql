CREATE TYPE "public"."video_approval" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."video_job_status" AS ENUM('none', 'queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."video_status" AS ENUM('uploading', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "video_cues" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "video_cues_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"video_id" bigint NOT NULL,
	"idx" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_progress" (
	"user_id" bigint NOT NULL,
	"video_id" bigint NOT NULL,
	"position_sec" double precision NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_progress_user_id_video_id_pk" PRIMARY KEY("user_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "videos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"uploaded_by" bigint,
	"status" "video_status" DEFAULT 'uploading' NOT NULL,
	"approval" "video_approval" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by" bigint,
	"reviewed_at" timestamp,
	"original_name" text DEFAULT '' NOT NULL,
	"declared_bytes" bigint NOT NULL,
	"mime" text,
	"duration_sec" double precision,
	"width" integer,
	"height" integer,
	"has_poster" boolean DEFAULT false NOT NULL,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"transcript_status" "video_job_status" DEFAULT 'none' NOT NULL,
	"transcript_source" text,
	"transcript_error" text,
	"summary_status" "video_job_status" DEFAULT 'none' NOT NULL,
	"summary_text" text,
	"chapters" jsonb,
	"summary_error" text,
	"summary_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "video_cues" ADD CONSTRAINT "video_cues_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_progress" ADD CONSTRAINT "video_progress_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_cues_video_idx" ON "video_cues" USING btree ("video_id","idx");