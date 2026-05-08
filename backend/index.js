console.log("running this script in docker");
const express = require("express");
const cors = require("cors");
// exports = module.exports = createApplication;
const { MongoClient } = require("mongodb");
//Object.defineProperty(exports, "MongoClient", { enumerable: true, get: function () { return mongo_client_1.MongoClient; } });
require("dotenv").config();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// const PORT = 3000;
// const MONGO_URI =
//   "mongodb+srv://admin:Nopassw0rd@cluster0.ulhrad8.mongodb.net/?appName=Cluster0";
const app = express();
let db;

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log("connecting to db");
  db = client.db("highlighter");
  console.log("Connected to MongoDB");
}

app.use(cors());
app.use(express.json());
// app structure
app.get("/highlights", async (req, res) => {
  // async callback function;
  try {
    console.log("hit highlights route");
    console.log(`url is`, req.query);
    const url = req.query.url;

    const highlights = await db
      .collection("highlights")
      .find({
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

app.post("/addhighlight", async (req, res) => {
  try {
    console.log("hit add highlights route", req.body);
    const { text, url, tag, text_tag_pairs } = req.body;

    const result = await db.collection("highlights").insertOne({
      text: text,
      url: url,
      tag: tag,
      text_tag_pairs: text_tag_pairs,
    });

    res.json(result);
  } catch (err) {
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
