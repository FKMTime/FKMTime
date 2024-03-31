# FKMTime

## What is FKMTime?

FKMTime is a system for running speedcubing competitions without scorecards! This repository contains the entire code for the web and backend applications. 

Source code for FKM devices is available [here](https://github.com/filipton/fkm-timer)

## Important information
**FKMTime is currently in the testing phase. For now, in accordance with WCA regulations, scorecards are still used in parallel with the system.**

## Development

You can run FKMTime in development mode in 2 ways:
- Using Docker
- Running backend and frontend separately

### Docker
Run the following command in the root directory of the project
```bash
docker compose -f docker-compose.dev.yml up
```

Frontend will be accessible at localhost:5173, backend at localhost:5000, database at localhost:5432


###  Running backend and frontend separately

#### Requirements
- NodeJS (version 19.0.0 or later)
- PostgreSQL

#### Setup database

- Install PostgreSQL
- Create a database
```sql
CREATE DATABASE fkm_time;
```

#### Backend

Clone this repo and navigate into it
```bash
git clone https://github.com/maxidragon/FKMTime
cd FKMTime
```

- Navigate into backend directory
```bash
cd backend
```

- Install dependencies
```bash
npm install
```

- Create .env file and enter database URL, JWT secret and WCA and WCA Live URL
```
PORT=5000
DATABASE_URL=postgres://postgres@localhost:5432/fkm_time
SECRET=jwt_secret
WCA_LIVE_API_ORIGIN=http://localhost:4000
WCA_ORIGIN=http://localhost:3001
```

- Seed DB, this will create an admin account with login `admin` and password `admin`
```
npx prisma db seed
```

- Run backend in development mode
```
npm run start:dev
```

The server will be accessible at localhost:5000

#### Frontend

- Navigate into frontend directory
```bash
cd frontend
```

- Install dependencies
```
npm install
```

- Run development server
```
npm run dev
```

Admin panel will be accessible at localhost:5173

### WCA and WCA Live

You have to run WCA and WCA Live locally in order to import competition to the system and be able to enter results.

## Production

The system is designed to be configured from scratch for each competition. It is recommended to run the server on a computer located at the competition venue.

We use Docker for production. Do the following steps to run the server:

### Environment variables 

Rename the .env.example file to .env and fill in the required fields.

```bash
mv .env.example .env
```

### Logs user

Generate a password hash for the logs user using the following command:
```bash
echo -n 'secret-password' | shasum -a 256
```

Rename the users.yml.example file to users.yml and paste your hash into "password" field

```bash
mv dozzle/users.yml.example dozzle/users.yml
```

And finally, run the following command to start the server:

```bash
docker compose up
```

This will start backend, database and frontend. 
