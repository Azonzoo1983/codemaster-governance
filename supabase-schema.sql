-- ============================================================
-- CodeMaster Governance - Supabase Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Users table
CREATE TABLE IF NOT EXISTS cm_users (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Priorities table
CREATE TABLE IF NOT EXISTS cm_priorities (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Attribute definitions table
CREATE TABLE IF NOT EXISTS cm_attributes (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Requests table
CREATE TABLE IF NOT EXISTS cm_requests (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Invite tokens table
CREATE TABLE IF NOT EXISTS cm_invite_tokens (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Brands table
CREATE TABLE IF NOT EXISTS cm_brands (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- ============================================================
-- Disable RLS for now (app handles its own role-based access)
-- You can enable RLS later when adding Supabase Auth
-- ============================================================
ALTER TABLE cm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_brands ENABLE ROW LEVEL SECURITY;

-- Allow public (anon) access to all tables
CREATE POLICY "Allow public read cm_users" ON cm_users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert cm_users" ON cm_users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update cm_users" ON cm_users FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete cm_users" ON cm_users FOR DELETE TO anon USING (true);

CREATE POLICY "Allow public read cm_priorities" ON cm_priorities FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert cm_priorities" ON cm_priorities FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update cm_priorities" ON cm_priorities FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete cm_priorities" ON cm_priorities FOR DELETE TO anon USING (true);

CREATE POLICY "Allow public read cm_attributes" ON cm_attributes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert cm_attributes" ON cm_attributes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update cm_attributes" ON cm_attributes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete cm_attributes" ON cm_attributes FOR DELETE TO anon USING (true);

CREATE POLICY "Allow public read cm_requests" ON cm_requests FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert cm_requests" ON cm_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update cm_requests" ON cm_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete cm_requests" ON cm_requests FOR DELETE TO anon USING (true);

CREATE POLICY "Allow public read cm_invite_tokens" ON cm_invite_tokens FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert cm_invite_tokens" ON cm_invite_tokens FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update cm_invite_tokens" ON cm_invite_tokens FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete cm_invite_tokens" ON cm_invite_tokens FOR DELETE TO anon USING (true);

CREATE POLICY "Allow public read cm_brands" ON cm_brands FOR SELECT TO anon USING (true);
CREATE POLICY "Allow public insert cm_brands" ON cm_brands FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow public update cm_brands" ON cm_brands FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete cm_brands" ON cm_brands FOR DELETE TO anon USING (true);

-- ============================================================
-- Seed data: Default users, priorities, and attributes
-- ============================================================

-- Seed users
INSERT INTO cm_users (id, data) VALUES
('u1', '{"id":"u1","name":"Alice Requester","email":"alice@company.com","role":"Requester","department":"Engineering"}'::jsonb),
('u2', '{"id":"u2","name":"Bob Manager","email":"bob@company.com","role":"Manager","department":"Engineering"}'::jsonb),
('u3', '{"id":"u3","name":"Charlie POC","email":"charlie@company.com","role":"One Point of Contact","department":"Procurement"}'::jsonb),
('u4', '{"id":"u4","name":"David Specialist","email":"david@company.com","role":"Item Coding Specialist","department":"Master Data"}'::jsonb),
('u5', '{"id":"u5","name":"Eve Reviewer","email":"eve@company.com","role":"Technical Reviewer","department":"Engineering"}'::jsonb),
('u6', '{"id":"u6","name":"Frank Admin","email":"frank@company.com","role":"Admin","department":"IT"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed priorities
INSERT INTO cm_priorities (id, data) VALUES
('p1', '{"id":"p1","name":"Normal","description":"Processed within 2 working days.","requiresApproval":false,"slaHours":48,"active":true,"displayOrder":1}'::jsonb),
('p2', '{"id":"p2","name":"Urgent","description":"Processed within 1 working day.","requiresApproval":false,"slaHours":24,"active":true,"displayOrder":2}'::jsonb),
('p3', '{"id":"p3","name":"Critical","description":"Same day if submitted 4 hours before EOB. Requires Manager Approval and Justification.","requiresApproval":true,"slaHours":4,"active":true,"displayOrder":3}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed attributes
INSERT INTO cm_attributes (id, data) VALUES
('mat_type', '{"id":"mat_type","name":"Material Type & Specs","type":"Text","mandatory":true,"active":true,"includeInAutoDescription":true,"descriptionOrder":1,"visibleForClassification":["Item"]}'::jsonb),
('mat_grade', '{"id":"mat_grade","name":"Material Grade/Classification","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":true,"descriptionOrder":2,"visibleForClassification":["Item"]}'::jsonb),
('size_dim', '{"id":"size_dim","name":"Size & Dimensions","type":"Structured Dimension Block","dimensionFields":["Length","Width","Height","Thickness","Diameter"],"mandatory":true,"active":true,"includeInAutoDescription":true,"descriptionOrder":3,"visibleForClassification":["Item"]}'::jsonb),
('part_num', '{"id":"part_num","name":"Part Number/Ref Code","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":true,"descriptionOrder":4,"visibleForClassification":["Item"]}'::jsonb),
('machine_info', '{"id":"machine_info","name":"Machine/Equipment Name & Model","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":true,"descriptionOrder":5,"visibleForClassification":["Item"]}'::jsonb),
('surface', '{"id":"surface","name":"Surface Finish/Coating","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":true,"descriptionOrder":6,"visibleForClassification":["Item"]}'::jsonb),
('weight', '{"id":"weight","name":"Weight","type":"Numeric + Unit","units":["kg","g","lb","oz","ton"],"mandatory":false,"active":true,"includeInAutoDescription":true,"descriptionOrder":7,"visibleForClassification":["Item"]}'::jsonb),
('origin', '{"id":"origin","name":"Country of Origin","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":false,"descriptionOrder":99,"visibleForClassification":["Item"]}'::jsonb),
('brand', '{"id":"brand","name":"Brand/Manufacturer","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":true,"descriptionOrder":8,"visibleForClassification":["Item"]}'::jsonb),
('certs', '{"id":"certs","name":"Certification / SDS / TDS","type":"Multi-select","options":["SDS","TDS","Inspection Report","Test Report","Mill Cert"],"mandatory":false,"active":true,"includeInAutoDescription":false,"descriptionOrder":99,"visibleForClassification":["Item"]}'::jsonb),
('standards', '{"id":"standards","name":"Compliance Standards","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":true,"descriptionOrder":9,"visibleForClassification":["Item"]}'::jsonb),
('shelf_life', '{"id":"shelf_life","name":"Shelf Life / Expiry","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":false,"descriptionOrder":99,"visibleForClassification":["Item"]}'::jsonb),
('warranty', '{"id":"warranty","name":"Warranty Details","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":false,"descriptionOrder":99,"visibleForClassification":["Item"]}'::jsonb),
('conditions', '{"id":"conditions","name":"Operating Conditions","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":true,"descriptionOrder":10,"visibleForClassification":["Item"]}'::jsonb),
('color', '{"id":"color","name":"Color","type":"Text","mandatory":false,"active":true,"includeInAutoDescription":true,"descriptionOrder":11,"visibleForClassification":["Item"]}'::jsonb),
('drawings', '{"id":"drawings","name":"Drawings/Graphics Available?","type":"Dropdown","options":["Yes","No"],"mandatory":false,"active":true,"includeInAutoDescription":false,"descriptionOrder":99,"visibleForClassification":["Item"]}'::jsonb),
('svc_details', '{"id":"svc_details","name":"Service Details/Specs","type":"Long Text","mandatory":true,"active":true,"includeInAutoDescription":true,"descriptionOrder":1,"visibleForClassification":["Service"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;
