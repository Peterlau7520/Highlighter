console.log("running this script in docker");
const express = require("express");
const cors = require("cors");
// exports = module.exports = createApplication;
const { MongoClient } = require("mongodb");
const { verifyGoogleToken, issueSession, requireAuth } = require("./auth");
//Object.defineProperty(exports, "MongoClient", { enumerable: true, get: function () { return mongo_client_1.MongoClient; } });
require("dotenv").config();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// const PORT = 3000;
// const MONGO_URI =
//   "mongodb+srv://admin:Nopassw0rd@cluster0.ulhrad8.mongodb.net/?appName=Cluster0";
const app = express();
let db;

/**
 * Connects to MongoDB using `MONGO_URI` and assigns the `highlighter`
 * database to the module-level `db` variable used by the route handlers.
 * Must resolve before `app.listen` is called (see bottom of file).
 */
async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log("connecting to db");
  db = client.db("highlighter");
  console.log("Connected to MongoDB");
}

app.use(cors());
app.use(express.json());

/**
 * POST /auth/google
 *
 * Exchanges a Google OAuth access token (obtained by the extension via
 * chrome.identity.getAuthToken) for a backend-issued session JWT. Verifies
 * the token against Google, upserts a `users` document, and returns
 * `{ sessionToken, expiresAt, user }`. Called from lib/auth.js
 * (exchangeGoogleToken), both at interactive sign-in and at silent refresh.
 *
 * @body {string} accessToken - Google OAuth access token
 */
app.post("/auth/google", async (req, res) => {
  try {
    const { accessToken } = req.body;
    const googleUser = await verifyGoogleToken(accessToken);

    const now = new Date();
    await db.collection("users").updateOne(
      { _id: googleUser.sub },
      {
        $set: {
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          lastLoginAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    const { sessionToken, expiresAt } = issueSession(googleUser);
    res.json({
      sessionToken,
      expiresAt,
      user: { email: googleUser.email, name: googleUser.name },
    });
  } catch (err) {
    console.log("google auth err", err);
    res.status(401).json({ error: err.message });
  }
});

/**
 * GET /highlights?url=<page url>
 *
 * Returns all of the signed-in user's saved highlights whose stored `url`
 * is a substring of the query `url`, or vice versa (handles trailing
 * slashes / query params differing between save-time and load-time URLs).
 * Called from background.js's `get_highlights` message listener.
 * Requires a valid session (see `requireAuth`).
 */
app.get("/highlights", requireAuth, async (req, res) => {
  // async callback function;
  try {
    console.log("hit highlights route");
    console.log(`url is`, req.query);
    const url = req.query.url;

    const highlights = await db
      .collection("highlights")
      .find({
        userId: req.userId,
        $expr: {
          $or: [
            // Field is a substring of your input
            { $gte: [{ $indexOfCP: [url, "$url"] }, 0] },
            // Your input is a substring of the field
            { $gte: [{ $indexOfCP: ["$url", url] }, 0] },
          ],
        },
      })
      .toArray();
    //highlights is a js object
    res.json(highlights);
    //res.json() serializes it to JSON and the receiver gets it back as an array.
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /addhighlight
 *
 * Inserts one highlight document (text, url, tag, text_tag_pairs, offsets,
 * color) into the `highlights` collection. Called from background.js's
 * `add_highlights` message listener.
 *
 * @body {string} text - the highlighted text
 * @body {string} url - page url the highlight belongs to
 * @body {string} [tag] - not actually populated by the caller (background.js never sets it)
 * @body {Array<{text: string, tag: string}>} text_tag_pairs - text/tag sequence used to relocate the highlight later
 * @body {number} startOffset
 * @body {number} endOffset
 * @body {string} color
 *
 * Requires a valid session (see `requireAuth`); the highlight is tagged
 * with the signed-in user's id (`req.userId`), not anything client-supplied.
 */
app.post("/addhighlight", requireAuth, async (req, res) => {
  try {
    console.log("hit add highlights route", req.body);
    const { text, url, tag, text_tag_pairs, startOffset, endOffset, color } =
      req.body;

    const result = await db.collection("highlights").insertOne({
      userId: req.userId,
      text: text,
      url: url,
      tag: tag,
      text_tag_pairs: text_tag_pairs,
      startOffset: startOffset,
      endOffset: endOffset,
      color: color,
    });

    res.json(result);
  } catch (err) {
    console.log("add highlight err", err);
    res.status(500).json({ error: err.message });
  }
});

connectDB()
  .then(() => {
    console.log("connecting to DB");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
