const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const logger = require("./utils/logger");

let db;

async function initDb() {
  try {
    db = await open({
      filename: "./trakt_tokens.db",
      driver: sqlite3.Database,
    });

    // Create the tokens table if it doesn't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS tokens (
        trakt_username TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create a trigger to automatically update the updated_at timestamp
    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_tokens_updated_at
      AFTER UPDATE ON tokens
      FOR EACH ROW
      BEGIN
        UPDATE tokens SET updated_at = CURRENT_TIMESTAMP WHERE trakt_username = OLD.trakt_username;
      END;
    `);

    logger.info("Database initialized successfully.");
  } catch (error) {
    logger.error("Failed to initialize database", { error: error.message, stack: error.stack });
    process.exit(1); // Exit if DB fails to initialize
  }
}

/**
 * Stores or updates Trakt tokens for a user.
 */
async function storeTokens(username, accessToken, refreshToken, expiresIn) {
  const expiresAt = Date.now() + expiresIn * 1000;
  try {
    await db.run(
      `INSERT INTO tokens (trakt_username, access_token, refresh_token, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(trakt_username) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at`,
      [username, accessToken, refreshToken, expiresAt]
    );
    logger.info(`Tokens stored successfully for user: ${username}`);
  } catch (error) {
    logger.error(`Failed to store tokens for user: ${username}`, { error: error.message });
  }
}

/**
 * Retrieves Trakt tokens for a user.
 */
async function getTokens(username) {
  try {
    const tokenData = await db.get("SELECT * FROM tokens WHERE trakt_username = ?", [username]);
    if (tokenData) {
      logger.debug(`Tokens retrieved for user: ${username}`);
    } else {
      logger.warn(`No tokens found for user: ${username}`);
    }
    return tokenData;
  } catch (error) {
    logger.error(`Failed to retrieve tokens for user: ${username}`, { error: error.message });
    return null;
  }
}

module.exports = { initDb, storeTokens, getTokens };