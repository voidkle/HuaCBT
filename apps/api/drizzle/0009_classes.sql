CREATE TYPE "public"."class_system" AS ENUM('homeroom_teacher', 'subject_teachers');--> statement-breakpoint
CREATE TABLE "classroom_subjects" (
	"classroom_id" bigint NOT NULL,
	"subject_id" bigint NOT NULL,
	"teacher_id" bigint,
	CONSTRAINT "classroom_subjects_classroom_id_subject_id_pk" PRIMARY KEY("classroom_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lessons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"classroom_id" bigint NOT NULL,
	"subject_id" bigint NOT NULL,
	"weekday" integer NOT NULL,
	"start_min" integer NOT NULL,
	"end_min" integer NOT NULL,
	"room_id" bigint,
	CONSTRAINT "lessons_weekday_ok" CHECK ("lessons"."weekday" between 1 and 7),
	CONSTRAINT "lessons_time_ok" CHECK ("lessons"."start_min" >= 0 and "lessons"."end_min" <= 1440 and "lessons"."start_min" < "lessons"."end_min")
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rooms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"owner_id" bigint
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subjects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "system" "class_system" DEFAULT 'subject_teachers' NOT NULL;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "grade" text;--> statement-breakpoint
ALTER TABLE "classrooms" ADD COLUMN "homeroom_teacher_id" bigint;--> statement-breakpoint
ALTER TABLE "classroom_subjects" ADD CONSTRAINT "classroom_subjects_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_subjects" ADD CONSTRAINT "classroom_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_subjects" ADD CONSTRAINT "classroom_subjects_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_classroom_id_subject_id_classroom_subjects_classroom_id_subject_id_fk" FOREIGN KEY ("classroom_id","subject_id") REFERENCES "public"."classroom_subjects"("classroom_id","subject_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lessons_classroom_idx" ON "lessons" USING btree ("classroom_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_name_unique" ON "rooms" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_name_unique" ON "subjects" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_homeroom_teacher_id_users_id_fk" FOREIGN KEY ("homeroom_teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;