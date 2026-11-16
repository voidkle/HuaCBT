CREATE TYPE "public"."exam_attempt_status" AS ENUM('in_progress', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."exam_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."exam_question_type" AS ENUM('single', 'multiple', 'truefalse', 'essay');--> statement-breakpoint
CREATE TABLE "exam_answers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exam_answers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"attempt_id" bigint NOT NULL,
	"question_id" bigint NOT NULL,
	"selected" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"essay_text" text DEFAULT '' NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"score" double precision,
	"feedback" text DEFAULT '' NOT NULL,
	"graded_by" bigint,
	"graded_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exam_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"exam_id" bigint NOT NULL,
	"student_id" bigint NOT NULL,
	"attempt_no" integer NOT NULL,
	"seed" integer NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"deadline_at" timestamp,
	"submitted_at" timestamp,
	"status" "exam_attempt_status" DEFAULT 'in_progress' NOT NULL,
	"auto_score" double precision DEFAULT 0 NOT NULL,
	"essay_score" double precision DEFAULT 0 NOT NULL,
	"max_score" double precision DEFAULT 0 NOT NULL,
	"graded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "exam_options" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exam_options_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"question_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exam_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"exam_id" bigint NOT NULL,
	"position" integer NOT NULL,
	"type" "exam_question_type" NOT NULL,
	"text" text NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"points" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "exams_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" bigint,
	"status" "exam_status" DEFAULT 'draft' NOT NULL,
	"duration_minutes" integer,
	"opens_at" timestamp,
	"closes_at" timestamp,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"shuffle_options" boolean DEFAULT false NOT NULL,
	"show_timer" boolean DEFAULT true NOT NULL,
	"access_token" text,
	"show_score" boolean DEFAULT true NOT NULL,
	"show_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_attempt_id_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_question_id_exam_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_answers" ADD CONSTRAINT "exam_answers_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_options" ADD CONSTRAINT "exam_options_question_id_exam_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exam_answers_unique" ON "exam_answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_attempts_unique" ON "exam_attempts" USING btree ("exam_id","student_id","attempt_no");--> statement-breakpoint
CREATE INDEX "exam_attempts_student_idx" ON "exam_attempts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "exam_options_question_idx" ON "exam_options" USING btree ("question_id","position");--> statement-breakpoint
CREATE INDEX "exam_questions_exam_idx" ON "exam_questions" USING btree ("exam_id","position");