CREATE TYPE "public"."role" AS ENUM('admin', 'operator', 'teacher', 'staff', 'student');--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sso_id" bigint NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" "role" DEFAULT 'student' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_sso_id_unique" UNIQUE("sso_id")
);
