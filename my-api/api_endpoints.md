# Lead Generation SaaS - API Reference & Curl Commands

This document provides a detailed list of every API endpoint available in the application, including their method, route, purpose, parameters, expected response, and example `curl` commands.

---

## 1. Public Authentication Endpoints

These endpoints are used to manage user registrations, logins, and retrieve session profiles.

### Register User
* **Route:** `POST /auth/register`
* **Purpose:** Register a new developer account.
* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```
* **Curl Command:**
  ```bash
  curl -s -X POST http://localhost:3000/auth/register \
    -H "Content-Type: application/json" \
    -d '{"name": "John Doe", "email": "john@example.com", "password": "password123"}'
  ```
* **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User created",
    "user": {
      "id": "7acfa957-7a2e-4b2e-a74b-2f08a9f0291a",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
  ```

### User Login
* **Route:** `POST /auth/login`
* **Purpose:** Log in to retrieve a JWT Bearer token for Dashboard calls.
* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```
* **Curl Command:**
  ```bash
  curl -s -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "john@example.com", "password": "password123"}'
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### Current User Profile
* **Route:** `GET /auth/me`
* **Purpose:** Retrieve the profile of the currently logged-in user.
* **Headers:** `Authorization: Bearer <jwt_token>`
* **Curl Command:**
  ```bash
  curl -s -X GET http://localhost:3000/auth/me \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "id": "7acfa957-7a2e-4b2e-a74b-2f08a9f0291a",
    "name": "John Doe",
    "email": "john@example.com"
  }
  ```

---

## 2. API Key Management (JWT Protected)

These endpoints require a JWT Bearer token and are used by developers to create, list, and revoke API keys.

### Create API Key
* **Route:** `POST /api-keys`
* **Purpose:** Generate a new API key. The raw key is returned exactly once.
* **Headers:** `Authorization: Bearer <jwt_token>`, `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "name": "Production App"
  }
  ```
* **Curl Command:**
  ```bash
  curl -s -X POST http://localhost:3000/api-keys \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
    -H "Content-Type: application/json" \
    -d '{"name": "Production App"}'
  ```
* **Expected Response (201 Created):**
  ```json
  {
    "success": true,
    "apiKey": "sk_live_2a7cf89c7d42e6a7c8..."
  }
  ```

### List API Keys
* **Route:** `GET /api-keys`
* **Purpose:** List all active API keys along with prefixes and usage stats. Hashes are never exposed.
* **Headers:** `Authorization: Bearer <jwt_token>`
* **Curl Command:**
  ```bash
  curl -s -X GET http://localhost:3000/api-keys \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  ```
* **Expected Response (200 OK):**
  ```json
  [
    {
      "id": "1b392a83-a74b-4b2e-a9b0-9a291f08bfcd",
      "name": "Production App",
      "prefix": "sk_live_2a7c",
      "lastUsedAt": "2026-06-22T08:12:00.000Z",
      "lastSearchAt": "2026-06-22T08:10:00.000Z",
      "totalSearches": 15,
      "totalLeadsScraped": 243,
      "requestsToday": 45,
      "lastRequestAt": "2026-06-22T08:12:00.000Z",
      "isActive": true,
      "createdAt": "2026-06-21T10:00:00.000Z"
    }
  ]
  ```

### Revoke API Key
* **Route:** `DELETE /api-keys/:id`
* **Purpose:** Permanently revoke (deactivate) an API key.
* **Headers:** `Authorization: Bearer <jwt_token>`
* **Curl Command:**
  ```bash
  curl -s -X DELETE http://localhost:3000/api-keys/1b392a83-a74b-4b2e-a9b0-9a291f08bfcd \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "API key revoked successfully"
  }
  ```

---

## 3. Public Health Endpoints

### Health Check
* **Route:** `GET /public/health`
* **Purpose:** Verify if the API is running and reachable.
* **Curl Command:**
  ```bash
  curl -s -X GET http://localhost:3000/public/health
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Public route: API is healthy and reachable."
  }
  ```

---

## 4. Protected Scraper & Lead Endpoints

These endpoints require authentication. You must provide EITHER a JWT Bearer token in the `Authorization` header OR an API Key (via `x-api-key` header or Bearer token starting with `sk_live_`).

### Start Search & Scrape
* **Route:** `POST /search`
* **Purpose:** Initialize a Google Maps search and scrape leads.
* **Headers:** `x-api-key: sk_live_...` or `Authorization: Bearer <token>`, `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "keyword": "dentist",
    "location": "Miami"
  }
  ```
* **Curl Command:**
  ```bash
  curl -s -X POST http://localhost:3000/search \
    -H "x-api-key: sk_live_2a7cf89c7d42e6a7c8..." \
    -H "Content-Type: application/json" \
    -d '{"keyword": "dentist", "location": "Miami"}'
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "searchId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "jobId": "12",
    "status": "pending"
  }
  ```

### Retrieve Search Status
* **Route:** `GET /search/:id`
* **Purpose:** Retrieve the progress/status of a specific search job ID.
* **Headers:** `x-api-key: sk_live_...`
* **Curl Command:**
  ```bash
  curl -s -X GET http://localhost:3000/search/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d \
    -H "x-api-key: sk_live_2a7cf89c7d42e6a7c8..."
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "search": {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "userId": "7acfa957-7a2e-4b2e-a74b-2f08a9f0291a",
      "apiKeyId": "1b392a83-a74b-4b2e-a9b0-9a291f08bfcd",
      "keyword": "dentist",
      "location": "Miami",
      "status": "completed",
      "totalLeads": 12,
      "scrapedCount": 12,
      "insertedCount": 12,
      "duplicateCount": 0,
      "progress": 100,
      "createdAt": "2026-06-22T04:36:20.000Z"
    }
  }
  ```

### Retrieve Search Results
* **Route:** `GET /search/:id/results`
* **Purpose:** Retrieve the lead results of a completed search job.
* **Headers:** `x-api-key: sk_live_...`
* **Curl Command:**
  ```bash
  curl -s -X GET http://localhost:3000/search/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/results \
    -H "x-api-key: sk_live_2a7cf89c7d42e6a7c8..."
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "searchId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "leads": [
      {
        "id": "3b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e",
        "searchId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "name": "Miami Dental Care",
        "phone": "+13055550199",
        "email": "info@miamidental.com",
        "website": "https://miamidental.com",
        "address": "123 Main St, Miami, FL",
        "rating": 4.7,
        "reviews": 85,
        "facebook": "https://facebook.com/miamidental",
        "enrichmentStatus": "completed",
        ...
      }
    ]
  }
  ```

### Retrieve All Leads
* **Route:** `GET /leads`
* **Purpose:** Fetch every lead record belonging to the authenticated user's searches.
* **Headers:** `x-api-key: sk_live_...`
* **Curl Command:**
  ```bash
  curl -s -X GET http://localhost:3000/leads \
    -H "x-api-key: sk_live_2a7cf89c7d42e6a7c8..."
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 120,
    "leads": [...]
  }
  ```

### Manually Enrich Leads
* **Route:** `POST /leads/enrich`
* **Purpose:** Manually trigger website scraping to enrich emails and social links for specific leads. It runs in the background. You must provide one of: `leadId`, `leadIds`, or `searchId`.
* **Headers:** `x-api-key: sk_live_...` or `Authorization: Bearer <token>`, `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "searchId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
  ```
  *(Alternative body examples)*
  ```json
  { "leadId": "3b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e" }
  ```
  ```json
  { "leadIds": ["3b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6e", "11223344-5566-7788-9900-aabbccddeeff"] }
  ```
* **Curl Command:**
  ```bash
  curl -s -X POST http://localhost:3000/leads/enrich \
    -H "x-api-key: sk_live_2a7cf89c7d42e6a7c8..." \
    -H "Content-Type: application/json" \
    -d '{"searchId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"}'
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Enrichment started in the background",
    "count": 45
  }
  ```

---

## 5. Lead Data Export Endpoints

Allows users to download formatted spreadsheets of search results they own.

### Export Leads to CSV
* **Route:** `GET /export/csv/:searchId`
* **Purpose:** Download all leads for a search job in dynamically escaped CSV format.
* **Headers:** `x-api-key: sk_live_...` or `Authorization: Bearer <token>`
* **Curl Command:**
  ```bash
  curl -J -O -L http://localhost:3000/export/csv/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d \
    -H "x-api-key: sk_live_2a7cf89c7d42e6a7c8..."
  ```
  *(Using `-J -O -L` flags will automatically write the downloaded data to a file named `leads.csv` as specified by the server's headers)*
* **Expected Headers:**
  - `Content-Type: text/csv`
  - `Content-Disposition: attachment; filename="leads.csv"`

### Export Leads to Excel (XLSX)
* **Route:** `GET /export/excel/:searchId`
* **Purpose:** Download leads formatted inside a workbook worksheet named `Leads`.
* **Headers:** `x-api-key: sk_live_...` or `Authorization: Bearer <token>`
* **Curl Command:**
  ```bash
  curl -J -O -L http://localhost:3000/export/excel/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d \
    -H "x-api-key: sk_live_2a7cf89c7d42e6a7c8..."
  ```
  *(Using `-J -O -L` flags will automatically write the downloaded data to a file named `leads.xlsx` as specified by the server's headers)*
* **Expected Headers:**
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="leads.xlsx"`

---

## 6. Error Responses

The following standardized formats are returned in case of errors.

### Unauthorized / Invalid Token / Revoked Key (401 Unauthorized)
* **Response Body:**
  ```json
  {
    "success": false,
    "error": "Unauthorized",
    "message": "Missing or invalid API key"
  }
  ```

### Search Not Found / Access Denied (404 Not Found)
Returned if the UUID doesn't match any search record or is owned by another user.
* **Response Body:**
  ```json
  {
    "success": false,
    "message": "Search not found"
  }
  ```
