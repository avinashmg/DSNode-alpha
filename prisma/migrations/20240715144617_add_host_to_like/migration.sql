-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Likes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "post_id" TEXT NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'localhost'
);
INSERT INTO "new_Likes" ("id", "post_id") SELECT "id", "post_id" FROM "Likes";
DROP TABLE "Likes";
ALTER TABLE "new_Likes" RENAME TO "Likes";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
