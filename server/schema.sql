
-- Passengers table (including children under 5, ladies, age)
CREATE TABLE IF NOT EXISTS passengers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  age INT NOT NULL,
  gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  is_lady BOOLEAN NOT NULL DEFAULT FALSE,
  has_child BOOLEAN NOT NULL DEFAULT FALSE,
  booking_id INTEGER NOT NULL
);

-- Tickets table: tracks type and allocation
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL CHECK (status IN ('confirmed', 'rac', 'waiting')),
  berth VARCHAR(20), -- e.g. 'lower', 'middle', 'upper', 'side-lower', NULL for waiting
  berth_number INT,   -- NULL for waiting
  passenger_id INT REFERENCES passengers(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- To track berths and their occupancy
CREATE TABLE IF NOT EXISTS berths (
  berth_id SERIAL PRIMARY KEY,
  berth_type VARCHAR(20) NOT NULL CHECK (berth_type IN ('lower', 'middle', 'upper', 'side-lower')),
  berth_number INT NOT NULL,
  is_occupied BOOLEAN DEFAULT FALSE,
  ticket_id INT REFERENCES tickets(id)
);

-- To track the special queues
CREATE TABLE IF NOT EXISTS queues (
  id SERIAL PRIMARY KEY,
  type VARCHAR(10) NOT NULL CHECK (type IN ('rac', 'waiting')),
  ticket_id INT REFERENCES tickets(id),
  queue_position INT NOT NULL
);
