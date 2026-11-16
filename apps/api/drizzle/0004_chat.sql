CREATE TYPE "public"."chat_attachment_kind" AS ENUM('image', 'video', 'audio', 'file');--> statement-breakpoint
CREATE TYPE "public"."chat_room_type" AS ENUM('direct', 'group');--> statement-breakpoint
CREATE TABLE "chat_members" (
	"room_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"last_read_message_id" bigint,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_members_room_id_user_id_pk" PRIMARY KEY("room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"room_id" bigint NOT NULL,
	"sender_id" bigint,
	"body" text DEFAULT '' NOT NULL,
	"attachment_kind" "chat_attachment_kind",
	"attachment_name" text,
	"attachment_mime" text,
	"attachment_size" bigint,
	"link_type" text,
	"link_ref" bigint,
	"link_page" integer,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_rooms" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_rooms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"type" "chat_room_type" NOT NULL,
	"name" text,
	"direct_key" text,
	"created_by" bigint,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_rooms_directKey_unique" UNIQUE("direct_key")
);
--> statement-breakpoint
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_members" ADD CONSTRAINT "chat_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_chat_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_members_user_idx" ON "chat_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_room_idx" ON "chat_messages" USING btree ("room_id","id");