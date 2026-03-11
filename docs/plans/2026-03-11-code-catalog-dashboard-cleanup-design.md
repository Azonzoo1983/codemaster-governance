# Design: Code Catalog, Dashboard Cleanup & Reports Enhancement

**Date:** 2026-03-11
**Status:** Approved

## Problem Statement

1. **Requesters can't easily check if an Oracle code already exists** — they must manually check Oracle ERP before submitting. No in-app reference database.
2. **Dashboard is cluttered** — completed, cancelled, and rejected requests mix with active work. Analytics and performance charts add visual noise above the request table.
3. **Rejected requests lack visibility** — no way to track which departments/users repeatedly request items that already exist (governance/compliance concern).
4. **Sidebar has items in wrong places** — Workflow Builder and Activity Feed are shown to users who don't need them.

## Design

### Feature 1: Dashboard Simplification

**Remove from Dashboard:**
- Analytics toggle + 4 charts (Requests Trend, Specialist Workload, Priority Distribution, Coding Performance)
- Specialist Performance toggle + metrics table

**Keep on Dashboard:**
- 4 KPI summary cards (Active, Completed, Attention, SLA Breached)
- Filters + search bar
- Request table with pagination

**Add tabs above the request table:**

| Tab | Contents | Default |
|-----|----------|---------|
| **Active** | In-progress + rejected requests. Rejected shown with red badge and rejection reason visible. | Yes |
| **Completed** | User's completed requests. Oracle Code displayed prominently and copyable. | No |
| **All** | Everything including cancelled. Cancelled shown with muted/faded styling. For admin overview. | No |

The Dashboard becomes a focused work queue: "What needs my attention right now?"

### Feature 2: Code Catalog Page

New page accessible to all roles. Positioned second in sidebar (after Dashboard).

**Purpose:** Searchable reference catalog of all Oracle codes created through CodeMaster. Grows organically as requests are completed.

**Data source:** All requests with status = COMPLETED. No bulk import — CodeMaster-only data.

**Each catalog entry displays:**
- Oracle Code (prominent, click-to-copy)
- Final Description
- Classification (Item / Service) + Sub-Type
- UNSPSC Code
- Brand / Manufacturer
- Key attributes (from dynamic form values)
- Project Code
- Date completed
- Link to original request (full audit trail)

**Search & Filters:**
- Full-text search across: Oracle code, description, brand, attribute values
- Filter by: Classification, Sub-Type, UNSPSC Code, Project
- Sort by: Date completed, Oracle Code, Description (alphabetical)

**Layout:**
- Card grid view (default) with table view toggle
- Responsive — works on mobile

### Feature 3: Reports Page Enhancement

Move all analytics from Dashboard to Reports page. Add rejection analytics.

**Moved from Dashboard:**
- Requests Trend (30 days) — area chart
- Specialist Workload — horizontal bar chart
- Priority Distribution — donut chart
- Coding Performance — avg completion time + SLA compliance
- Specialist Performance — metrics table (admin/POC only)

**New — Rejection Analytics:**
- Rejection rate by department/division — bar chart
- Rejection rate by user — ranked table
- Rejection reasons breakdown — pie/bar chart
- Rejection trend over time — line chart
- Repeat offenders — users/departments with multiple rejections (training indicator)

**Filters:**
- Date range picker (last 7 days, 30 days, 90 days, custom)
- Department / Division filter
- Classification filter

**Access:** All roles (requesters see their own stats, admins see everything).

### Feature 4: Sidebar Reorganization

**Move into Admin Panel as tabs:**
- Workflow Builder (was top-level, admin-only)
- Activity Feed (was top-level, all roles → now admin-only)

**Remove:**
- "My Requests" page for requesters (Dashboard Active tab replaces this)

**Update access:**
- Reports: change from admin/manager/POC/specialist/reviewer → all roles

**Final sidebar per role:**

Requester:
1. Dashboard
2. Code Catalog
3. My Drafts
4. New Request
5. Reports

Manager / POC / Specialist / Technical Reviewer:
1. Dashboard
2. Code Catalog
3. Reports

Admin:
1. Dashboard
2. Code Catalog
3. My Drafts
4. New Request
5. Reports
6. Admin Panel (tabs: Attributes, Priorities, User Mgmt, Invitations, Email Notifications, Workflow Builder, Activity Feed)

## Data Model

No new Supabase tables needed. The Code Catalog reads from existing `cm_requests` table filtered by `status = 'Completed'`. Fields used:
- `oracleCode`, `finalDescription` — the Oracle reference data
- `classification`, `materialSubType`, `serviceSubType` — categorization
- `unspscCode`, `attributes`, `project` — searchable metadata
- `id`, `updatedAt` — linking and sorting

Rejection analytics read from `cm_requests` where `status = 'Rejected'`, joined with `cm_users` for department/division data.

## Technical Notes

- Code Catalog page: new file `pages/CodeCatalog.tsx`
- Dashboard: remove analytics/performance sections, add tab state
- Reports: receive moved chart components, add rejection analytics section
- Layout: update NAV_ITEMS array for sidebar changes
- Admin: add Workflow Builder and Activity Feed as tabs
- No new npm packages needed
