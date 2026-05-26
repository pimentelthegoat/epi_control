CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS epis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  ca varchar(40) NOT NULL,
  category varchar(80) NOT NULL,
  lot varchar(80) NOT NULL,
  valid_until date NOT NULL,
  total_stock integer NOT NULL CHECK (total_stock >= 0),
  in_use integer NOT NULL CHECK (in_use >= 0),
  min_stock integer NOT NULL CHECK (min_stock >= 0),
  department varchar(120) NOT NULL,
  supplier varchar(120) NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epis_in_use_lte_total CHECK (in_use <= total_stock)
);

CREATE INDEX IF NOT EXISTS idx_epis_valid_until ON epis (valid_until);
CREATE INDEX IF NOT EXISTS idx_epis_lot ON epis (lot);
CREATE INDEX IF NOT EXISTS idx_epis_ca ON epis (ca);
