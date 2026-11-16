CREATE TABLE "assignment_files" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assignment_files_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"assignment_id" bigint,
	"submission_id" bigint,
	"name" text NOT NULL,
	"size" bigint NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "assignment_files_one_owner" CHECK (("assignment_files"."assignment_id" is null) <> ("assignment_files"."submission_id" is null))
);
--> statement-breakpoint
CREATE TABLE "assignment_submissions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assignment_submissions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"assignment_id" bigint NOT NULL,
	"student_id" bigint NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"submitted_at" timestamp NOT NULL,
	"late" boolean DEFAULT false NOT NULL,
	"score" double precision,
	"feedback" text,
	"graded_at" timestamp,
	"graded_by" bigint
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"classroom_id" bigint NOT NULL,
	"subject_id" bigint NOT NULL,
	"title" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"due_at" timestamp NOT NULL,
	"allow_late" boolean DEFAULT true NOT NULL,
	"max_points" integer DEFAULT 100 NOT NULL,
	"created_by" bigint,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assignment_files" ADD CONSTRAINT "assignment_files_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_files" ADD CONSTRAINT "assignment_files_submission_id_assignment_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_classroom_id_subject_id_classroom_subjects_classroom_id_subject_id_fk" FOREIGN KEY ("classroom_id","subject_id") REFERENCES "public"."classroom_subjects"("classroom_id","subject_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_files_assignment_idx" ON "assignment_files" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "assignment_files_submission_idx" ON "assignment_files" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignment_submissions_unique" ON "assignment_submissions" USING btree ("assignment_id","student_id");--> statement-breakpoint
CREATE INDEX "assignments_classroom_idx" ON "assignments" USING btree ("classroom_id");