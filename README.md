# FKMTime

## What is FKMTime?

FKMTime is a system for running speedcubing competitions without scorecards! This repository contains the entire code for the web, mobile, and backend applications. 

Source code for FKM devices is available [here](https://github.com/filipton/fkm-timer)

## Important information
**FKMTime is currently in the testing phase. For now, in accordance with WCA regulations, scorecards are still used in parallel with the system.**

## Development

### Requirements
- NodeJS (version 19.0.0 or later)
- MariaDB

### Setup database

- Set root password to empty
```
ALTER USER 'root'@'localhost' IDENTIFIED BY '';
```
- Create new database
```
CREATE DATABASE fkm_time;
```

### Backend

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
DATABASE_URL=mysql://root@127.0.0.1:3306/fkm_time
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

### Admin panel

- Navigate into admin-site directory
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

We use Docker for production. Just run

```bash
docker compose up
```

This will start backend, database and admin-site. 
