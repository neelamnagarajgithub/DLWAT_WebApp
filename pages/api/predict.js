import { Client } from "@gradio/client";
import formidable from "formidable";
import fs from "fs";
import fsPromises from "fs/promises";

export const config = {
  api: {
    bodyParser: false,
  },
};

const parseForm = (req) =>
  new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let uploadedPath;

  try {
    const { files } = await parseForm(req);

    let uploaded = files?.file ?? files?.upload ?? null;
    if (!uploaded) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    if (Array.isArray(uploaded)) uploaded = uploaded[0];

    uploadedPath = uploaded.filepath ?? uploaded.filePath ?? uploaded.path;
    if (!uploadedPath) {
      return res.status(400).json({ error: "Uploaded file path not found" });
    }

    // Read the uploaded file into memory and create a Blob if available (matches docs)
    const fileBuffer = await fsPromises.readFile(uploadedPath);
    let filePayload;
    if (typeof Blob !== "undefined") {
      filePayload = new Blob([fileBuffer]);
      // Optionally set name metadata for compatibility:
      // filePayload.name = uploaded.originalFilename || uploaded.originalFileName || uploaded.orig_name || uploaded.name;
    } else {
      // Fallback to Buffer if Blob isn't available in Node runtime
      filePayload = fileBuffer;
    }

    const client = await Client.connect("NagarajDev/dlwat");

    const maxAttempts = 12;
    const delayMs = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // pass the Blob/Buffer as in the docs
        const result = await client.predict("/predict", { file: filePayload });

        // handle Gradio status/queued responses
        if (result && result.type === "status" && result.queue) {
          if (attempt === maxAttempts) {
            return res
              .status(202)
              .json({ queued: true, message: "Prediction queued, try again later" });
          }
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        if (result?.data) return res.status(200).json(result.data);

        return res.status(200).json(result ?? { message: "No result returned" });
      } catch (err) {
        // client may throw a status/queue object — handle and retry
        if (err && typeof err === "object" && err.type === "status" && err.queue) {
          if (attempt === maxAttempts) {
            return res
              .status(202)
              .json({ queued: true, message: "Prediction queued, try again later" });
          }
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        // other errors: surface
        throw err;
      }
    }

    return res
      .status(202)
      .json({ queued: true, message: "Prediction queued, try again later" });
  } catch (err) {
    console.error("Predict error:", err);
    if (err && typeof err === "object" && err.type === "status" && err.queue) {
      return res
        .status(202)
        .json({ queued: true, message: "Prediction queued, try again later" });
    }
    if (err && typeof err === "object" && ("message" in err || "type" in err)) {
      return res.status(500).json({ error: err.message ?? JSON.stringify(err) });
    }
    return res
      .status(500)
      .json({ error: (err && err.toString && err.toString()) || "Prediction error" });
  } finally {
    if (uploadedPath) {
      try {
        await fsPromises.unlink(uploadedPath).catch(() => {});
      } catch (_) {}
    }
  }
}