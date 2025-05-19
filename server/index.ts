
import express from "express";
import { pool, query } from "./db";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(bodyParser.json());

const CONFIRMED_BERTHS = 63;
const RAC_BERTHS = 9; // 18 tickets (2 per side-lower)
const WAITING_LIMIT = 10;

// HEALTH CHECK
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// BOOK TICKET
app.post("/api/v1/tickets/book", async (req, res) => {
  const { name, age, gender, is_lady, has_child } = req.body;
  if (!name || typeof age !== "number" || !gender) {
    return res.status(400).json({ error: "Invalid passenger data." });
  }

  // Insert passenger
  const passResult = await query(
    "INSERT INTO passengers (name, age, gender, is_lady, has_child, booking_id) VALUES ($1, $2, $3, $4, $5, nextval('passengers_id_seq')) RETURNING id",
    [name, age, gender, !!is_lady, !!has_child]
  );
  const passengerId = passResult.rows[0].id;

  // Logic for children under 5: store details, no berth needed
  if (age < 5) {
    const ticketRes = await query(
      "INSERT INTO tickets (status, berth, berth_number, passenger_id) VALUES ('confirmed', NULL, NULL, $1) RETURNING *",
      [passengerId]
    );
    return res.json({ message: "Child added, no berth assigned", ticket: ticketRes.rows[0] });
  }

  // Check berth allocations
  const confirmed = await query("SELECT COUNT(*) FROM tickets WHERE status = 'confirmed'");
  const rac = await query("SELECT COUNT(*) FROM tickets WHERE status = 'rac'");
  const waiting = await query("SELECT COUNT(*) FROM tickets WHERE status = 'waiting'");
  if (parseInt(confirmed.rows[0].count) < CONFIRMED_BERTHS) {
    // Priority for lower berth: senior, then lady with child
    let berthType = "middle";
    if (age >= 60) berthType = "lower";
    else if (is_lady && has_child) berthType = "lower";
    else berthType = pickAvailableBerthType();

    // Find next available berth number
    const berth = await query(
      "SELECT berth_number FROM berths WHERE berth_type = $1 AND is_occupied = false LIMIT 1",
      [berthType]
    );
    let berthNumber = berth.rows.length ? berth.rows[0].berth_number : null;
    if (!berthNumber) {
      // fallback, pick any available
      const anyBerth = await query(
        "SELECT berth_type, berth_number FROM berths WHERE is_occupied = false LIMIT 1"
      );
      if (!anyBerth.rows.length) return res.status(500).json({ error: "No berths available" });
      berthType = anyBerth.rows[0].berth_type;
      berthNumber = anyBerth.rows[0].berth_number;
    }
    // Mark occupied
    await query(
      "UPDATE berths SET is_occupied = true WHERE berth_type = $1 AND berth_number = $2",
      [berthType, berthNumber]
    );
    const tResult = await query(
      "INSERT INTO tickets (status, berth, berth_number, passenger_id) VALUES ('confirmed', $1, $2, $3) RETURNING *",
      [berthType, berthNumber, passengerId]
    );
    return res.json({ message: "Ticket booked & confirmed.", ticket: tResult.rows[0] });
  } else if (parseInt(rac.rows[0].count) < 18) {
    // RAC allocation (side-lower berths)
    const racNum = await query(
      "SELECT berth_number FROM berths WHERE berth_type = 'side-lower' AND is_occupied = false LIMIT 1"
    );
    const berthNumber = racNum.rows.length ? racNum.rows[0].berth_number : null;
    if (berthNumber) {
      await query(
        "UPDATE berths SET is_occupied = true WHERE berth_type = 'side-lower' AND berth_number = $1",
        [berthNumber]
      );
      const tResult = await query(
        "INSERT INTO tickets (status, berth, berth_number, passenger_id) VALUES ('rac', $1, $2, $3) RETURNING *",
        ['side-lower', berthNumber, passengerId]
      );
      // Add to queue
      await query(
        "INSERT INTO queues (type, ticket_id, queue_position) VALUES ('rac', $1, (SELECT COALESCE(MAX(queue_position),0)+1 FROM queues WHERE type='rac'))",
        [tResult.rows[0].id]
      );
      return res.json({ message: "RAC ticket booked.", ticket: tResult.rows[0] });
    }
  } else if (parseInt(waiting.rows[0].count) < WAITING_LIMIT) {
    // Waiting list, no berth assignment
    const tResult = await query(
      "INSERT INTO tickets (status, berth, berth_number, passenger_id) VALUES ('waiting', NULL, NULL, $1) RETURNING *",
      [passengerId]
    );
    await query(
      "INSERT INTO queues (type, ticket_id, queue_position) VALUES ('waiting', $1, (SELECT COALESCE(MAX(queue_position),0)+1 FROM queues WHERE type='waiting'))",
      [tResult.rows[0].id]
    );
    return res.json({ message: "Added to waiting list.", ticket: tResult.rows[0] });
  } else {
    return res.status(409).json({ error: "No tickets available." });
  }
});

// Cancel Ticket
app.post("/api/v1/tickets/cancel/:ticketId", async (req, res) => {
  const { ticketId } = req.params;
  // Fetch ticket and free up berth
  const ticket = await query("SELECT * FROM tickets WHERE id = $1", [ticketId]);
  if (!ticket.rows.length) return res.status(404).json({ error: "Ticket not found" });
  const { status, berth, berth_number } = ticket.rows[0];

  // Remove ticket
  await query("DELETE FROM tickets WHERE id = $1", [ticketId]);
  if (berth && berth_number) {
    await query(
      "UPDATE berths SET is_occupied = false, ticket_id = NULL WHERE berth_type = $1 AND berth_number = $2",
      [berth, berth_number]
    );
  }

  // If confirmed, promote RAC to confirmed, move waiting to RAC
  if (status === 'confirmed') {
    const rac = await query(
      "SELECT * FROM tickets WHERE status = 'rac' ORDER BY created_at ASC LIMIT 1"
    );
    if (rac.rows.length) {
      const racTicket = rac.rows[0];
      await query(
        "UPDATE tickets SET status = 'confirmed', berth = $1 WHERE id = $2",
        [berth, racTicket.id]
      );
      await query(
        "UPDATE berths SET is_occupied = true, ticket_id = $1 WHERE berth_type = $2 AND berth_number = $3",
        [racTicket.id, berth, berth_number]
      );
      await query("DELETE FROM queues WHERE type = 'rac' AND ticket_id = $1", [racTicket.id]);
      // Waiting to RAC now
      const wait = await query(
        "SELECT * FROM tickets WHERE status = 'waiting' ORDER BY created_at ASC LIMIT 1"
      );
      if (wait.rows.length) {
        const waitTicket = wait.rows[0];
        const racNum = await query(
          "SELECT berth_number FROM berths WHERE berth_type = 'side-lower' AND is_occupied = false LIMIT 1"
        );
        const newRacNo = racNum.rows[0].berth_number;
        await query(
          "UPDATE tickets SET status = 'rac', berth = 'side-lower', berth_number = $1 WHERE id = $2",
          [newRacNo, waitTicket.id]
        );
        await query(
          "UPDATE berths SET is_occupied = true, ticket_id = $1 WHERE berth_type = 'side-lower' AND berth_number = $2",
          [waitTicket.id, newRacNo]
        );
        await query("DELETE FROM queues WHERE type = 'waiting' AND ticket_id = $1", [waitTicket.id]);
        await query(
          "INSERT INTO queues (type, ticket_id, queue_position) VALUES ('rac', $1, (SELECT COALESCE(MAX(queue_position),0)+1 FROM queues WHERE type='rac'))",
          [waitTicket.id]
        );
      }
    }
  }
  res.json({ ok: true, message: "Ticket cancelled, slots updated." });
});

// Get booked tickets (summary & passengers)
app.get("/api/v1/tickets/booked", async (_, res) => {
  const rows = await query(
    `SELECT t.*, p.* FROM tickets t 
     JOIN passengers p ON t.passenger_id = p.id 
     WHERE t.status IN ('confirmed','rac') 
     ORDER BY t.created_at`
  );
  res.json({ tickets: rows.rows });
});

// Get available tickets
app.get("/api/v1/tickets/available", async (_, res) => {
  const confirmed = await query("SELECT COUNT(*) FROM tickets WHERE status = 'confirmed'");
  const rac = await query("SELECT COUNT(*) FROM tickets WHERE status = 'rac'");
  const waiting = await query("SELECT COUNT(*) FROM tickets WHERE status = 'waiting'");
  res.json({
    available: {
      confirmed: CONFIRMED_BERTHS - parseInt(confirmed.rows[0].count),
      rac: 18 - parseInt(rac.rows[0].count),
      waiting: WAITING_LIMIT - parseInt(waiting.rows[0].count)
    }
  });
});

function pickAvailableBerthType() {
  // can improve: random or round-robin. For now, return one by order of berth type
  return "lower";
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Railway API running on ${PORT}`));
