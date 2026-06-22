# Lead Generation SaaS - API Reference & Curl Commands

This document provides a detailed list of every API endpoint available in the application, including their method, route, purpose, parameters, expected response, and example `curl` commands.

---

## 1. Public Endpoints

These endpoints do not require status verification and are accessible publicly.

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

### Public Info
* **Route:** `GET /public/info`
* **Purpose:** Fetch public system info/status.
* **Curl Command:**
  ```bash
  curl -s -X GET http://localhost:3000/public/info
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "This endpoint is public and bypasses the check middleware."
  }
  ```

---

## 2. Protected Scraper & Lead Endpoints

These endpoints are protected under the system validation middleware.

### Start Search & Scrape
* **Route:** `POST /search`
* **Purpose:** Initialize a Google Maps search and scrape leads.
* **Headers:** `Content-Type: application/json`
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
    -H "Content-Type: application/json" \
    -d '{"keyword": "dentist", "location": "Miami"}'
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "searchId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "count": 12
  }
  ```

### Retrieve Search Status and Leads
* **Route:** `GET /search/:id`
* **Purpose:** Retrieve the progress status and all lead records associated with a specific search job ID.
* **Curl Command:**
  ```bash
  curl -s -X GET http://localhost:3000/search/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "search": {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "keyword": "dentist",
      "location": "Miami",
      "status": "completed",
      "totalLeads": 12,
      "createdAt": "2026-06-22T04:36:20.000Z"
    },
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
        ...
      }
    ]
  }
  ```

### Retrieve All Leads
* **Route:** `GET /leads`
* **Purpose:** Fetch every scraped lead record stored globally in the database.
* **Curl Command:**
  ```bash
  curl -s -X GET http://localhost:3000/leads
  ```
* **Expected Response (200 OK):**
  ```json
  {
    "success": true,
    "count": 120,
    "leads": [...]
  }
  ```

---

## 3. Lead Data Export Endpoints

Allows users to download formatted spreadsheets of search results.

### Export Leads to CSV
* **Route:** `GET /export/csv/:searchId`
* **Purpose:** Download all leads for a search job in dynamically escaped CSV format.
* **Curl Command:**
  ```bash
  curl -J -O -L http://localhost:3000/export/csv/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
  ```
  *(Using `-J -O -L` flags will automatically write the downloaded data to a file named `leads.csv` as specified by the server's headers)*
* **Expected Headers:**
  - `Content-Type: text/csv`
  - `Content-Disposition: attachment; filename="leads.csv"`

### Export Leads to Excel (XLSX)
* **Route:** `GET /export/excel/:searchId`
* **Purpose:** Download leads formatted inside a workbook worksheet named `Leads`.
* **Curl Command:**
  ```bash
  curl -J -O -L http://localhost:3000/export/excel/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
  ```
  *(Using `-J -O -L` flags will automatically write the downloaded data to a file named `leads.xlsx` as specified by the server's headers)*
* **Expected Headers:**
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="leads.xlsx"`

---

## 4. Error Responses

The following standardized formats are returned in case of errors.

### Search Not Found (404 Not Found)
Returned by `/export/csv/:searchId`, `/export/excel/:searchId` or `/search/:id` if the UUID doesn't match any search record.
* **Response Body:**
  ```json
  {
    "success": false,
    "message": "Search not found"
  }
  ```

### No Leads Found (404 Not Found)
Returned by export endpoints if the search exists but has no leads attached.
* **Response Body:**
  ```json
  {
    "success": false,
    "message": "No leads found"
  }
  ```

### Export Failure (500 Internal Server Error)
Returned when an internal service error happens during file assembly.
* **Response Body:**
  ```json
  {
    "success": false,
    "message": "Export failed"
  }
  ```


