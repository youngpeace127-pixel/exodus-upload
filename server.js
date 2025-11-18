import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import admin from "firebase-admin";
import fs from "fs";

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(cors());
app.use(express.json());

// Multer setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Supabase Service Role key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware: check Firebase admin
async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);

    if (!decoded.admin) return res.status(403).json({ error: "Not an admin" });

    req.user = decoded;
    next();
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Upload endpoint
app.post("/upload", verifyAdmin, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const tier = req.body.tier;

    if (!file || !tier) return res.status(400).json({ error: "Missing file or tier" });

    const filePath = `${tier}/${Date.now()}_${file.originalname}`;

    const { error } = await supabase.storage.from("games").upload(filePath, file.buffer, {
      upsert: true,
    });
    if (error) throw error;

    const { data: urlData } = supabase.storage.from("games").getPublicUrl(filePath);

    return res.json({ publicUrl: urlData.publicUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
