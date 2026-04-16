PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Message" (
	"id" TEXT NOT NULL PRIMARY KEY,
	"conversationId" TEXT NOT NULL,
	"role" TEXT NOT NULL,
	"content" TEXT NOT NULL,
	"status" TEXT NOT NULL DEFAULT 'completed',
	"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Message" ("id", "conversationId", "role", "content", "status", "createdAt", "updatedAt")
SELECT "id", "conversationId", "role", "content", 'completed', "createdAt", "createdAt"
FROM "Message";

DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;