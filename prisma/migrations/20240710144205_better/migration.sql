/*
  Warnings:

  - You are about to drop the column `email` on the `Likes` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Likes` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Replies` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Replies` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Signals` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Signals` table. All the data in the column will be lost.
  - Added the required column `post_id` to the `Likes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parent` to the `Replies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reply_text` to the `Replies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reply_type` to the `Replies` table without a default value. This is not possible if the table is not empty.
  - Added the required column `host` to the `Signals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `origin` to the `Signals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Signals` table without a default value. This is not possible if the table is not empty.
  - Added the required column `value` to the `Signals` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Likes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "post_id" TEXT NOT NULL
);
INSERT INTO "new_Likes" ("id") SELECT "id" FROM "Likes";
DROP TABLE "Likes";
ALTER TABLE "new_Likes" RENAME TO "Likes";
CREATE TABLE "new_Replies" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "reply_type" TEXT NOT NULL,
    "reply_text" TEXT NOT NULL,
    "parent" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Replies" ("id") SELECT "id" FROM "Replies";
DROP TABLE "Replies";
ALTER TABLE "new_Replies" RENAME TO "Replies";
CREATE TABLE "new_Signals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "host" TEXT NOT NULL
);
INSERT INTO "new_Signals" ("id") SELECT "id" FROM "Signals";
DROP TABLE "Signals";
ALTER TABLE "new_Signals" RENAME TO "Signals";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
