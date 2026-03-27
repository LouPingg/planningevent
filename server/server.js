require("dotenv").config();

const Event = require("./models/Event");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");

const { parse } = require("csv-parse/sync");
const { DateTime } = require("luxon");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

function checkAdminCode(req, res, next) {
  const adminCode = req.headers["x-admin-code"];

  if (!adminCode || adminCode !== process.env.ADMIN_CODE) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

async function fetchTextFromUrl(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch sheet: ${response.status} ${response.statusText}`,
    );
  }

  return await response.text();
}

function normalizeCategory(category) {
  if (!category) return "official";
  return category.trim() === "User Event" ? "clan" : "official";
}

function parseLondonDateTime(dateStr, timeStr) {
  const value = DateTime.fromFormat(`${dateStr} ${timeStr}`, "d/M/yyyy HH:mm", {
    zone: "Europe/London",
  });

  return value;
}

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

app.get("/api/events", async (req, res) => {
  try {
    const events = await Event.find().sort({ startAt: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: "Error fetching events" });
  }
});

app.post("/api/events", checkAdminCode, async (req, res) => {
  try {
    const { name, type, startAt, endAt } = req.body;

    if (!name || !type || !startAt || !endAt) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (new Date(endAt) <= new Date(startAt)) {
      return res
        .status(400)
        .json({ error: "End date must be after start date" });
    }

    const newEvent = new Event({
      name,
      type,
      startAt,
      endAt,
    });

    await newEvent.save();

    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ error: "Error creating event" });
  }
});

app.post("/api/events/import-sheet", checkAdminCode, async (req, res) => {
  try {
    const sheetUrl = process.env.GOOGLE_SHEET_CSV_URL;

    if (!sheetUrl) {
      return res.status(500).json({
        error: "Missing GOOGLE_SHEET_CSV_URL in environment variables",
      });
    }

    const csvText = await fetchTextFromUrl(sheetUrl);

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const createdEvents = [];
    const skippedRows = [];

    for (let index = 0; index < records.length; index++) {
      const row = records[index];

      const date = row.Date;
      const start = row.Start;
      const end = row.End;
      const eventName = row.Event;
      const category = row.Category;

      if (!date || !start || !end || !eventName) {
        skippedRows.push({
          row: index + 2,
          reason: "Missing required fields",
        });
        continue;
      }

      const startDateTime = parseLondonDateTime(date, start);
      let endDateTime = parseLondonDateTime(date, end);

      if (!startDateTime.isValid || !endDateTime.isValid) {
        skippedRows.push({
          row: index + 2,
          reason: "Invalid date or time format",
        });
        continue;
      }

      if (endDateTime <= startDateTime) {
        endDateTime = endDateTime.plus({ days: 1 });
      }

      const newEvent = new Event({
        name: eventName.trim(),
        type: normalizeCategory(category),
        startAt: startDateTime.toUTC().toJSDate(),
        endAt: endDateTime.toUTC().toJSDate(),
      });

      await newEvent.save();
      createdEvents.push(newEvent);
    }

    res.status(201).json({
      message: "Sheet import completed",
      createdCount: createdEvents.length,
      skippedCount: skippedRows.length,
      skippedRows,
      createdEvents,
    });
  } catch (error) {
    console.error("Import sheet error:", error);
    res.status(500).json({ error: "Error importing events from Google Sheet" });
  }
});

app.delete("/api/events/:id", checkAdminCode, async (req, res) => {
  try {
    const deletedEvent = await Event.findByIdAndDelete(req.params.id);

    if (!deletedEvent) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting event" });
  }
});

app.post("/api/admin/login", (req, res) => {
  const { code } = req.body;

  if (code === process.env.ADMIN_CODE) {
    return res.json({ success: true, message: "Admin access granted" });
  }

  res.status(401).json({ success: false, message: "Invalid admin code" });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected ✅");
  })
  .catch((error) => {
    console.log("MongoDB connection error ❌", error);
  });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
