# Bitespeed Identity Reconciliation

This is a backend service developed for FluxKart's integration with Bitespeed. It exposes a web service endpoint to reconcile and manage customer identities across multiple purchases involving different emails and phone numbers.

## Tech Stack
- **Framework**: Node.js, Express.js
- **Database ORM**: Prisma
- **Database**: SQLite (local)

## Prerequisites
- Node.js (v18+)
- npm

## Setup & Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the database migrations to set up the SQLite DB:
   ```bash
   npx prisma migrate dev --name init
   ```

3. Start the server:
   ```bash
   npm start
   ```
   *The server will run on `http://localhost:3000` by default.*

## API Endpoints

### 1. Identify Contact
`POST /identify`

Consolidates contact identities based on email or phone number matching. Links new information to existing primary contacts as secondary contacts, or promotes primary contacts to secondary if they become linked.

**Request Body (JSON):**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Response Body (200 OK):**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

## Note for Evaluator
As per instructions, this repo can be cloned and run locally via the instructions above. When testing, ensure headers have `Content-Type: application/json`.
