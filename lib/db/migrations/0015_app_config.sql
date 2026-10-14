CREATE TABLE IF NOT EXISTS "app_config" (
  "key" varchar(128) PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamp DEFAULT now()
);
