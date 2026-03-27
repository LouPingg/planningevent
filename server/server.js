require("dotenv").config();

const Event = require("./models/Event");
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

function checkAdminCode(req, res, next) {
  const adminCode = req.headers["x-admin-code"];

  if (!adminCode || adminCode !== process.env.ADMIN_CODE) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
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
