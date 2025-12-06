# 🚀 Quick Start Guide - Zubix Pod

Get your Zubix Pod backend up and running in minutes!

## Prerequisites Check ✅

Before starting, make sure you have:
- [x] Node.js v16+ installed (`node --version`)
- [x] PostgreSQL v12+ running (`psql --version`)
- [x] Git installed (optional)

## Step-by-Step Setup

### 1️⃣ Install Dependencies (Already Done!)

```bash
# You've already run this:
npm install
```

### 2️⃣ Configure Environment

Copy the example environment file:
```bash
Copy-Item .env.example .env
```

Edit `.env` with your settings:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/zubix_pod?schema=public"
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

**Important:** Replace `yourpassword` with your PostgreSQL password!

### 3️⃣ Create Database

Connect to PostgreSQL and create the database:
```bash
# Using psql
psql -U postgres

# In psql:
CREATE DATABASE zubix_pod;
\q
```

Or use a PostgreSQL GUI tool like pgAdmin.

### 4️⃣ Run Database Migrations

Generate Prisma Client and run migrations:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

This will create all the necessary tables in your database.

### 5️⃣ Start the Server

```bash
# Development mode (with auto-reload)
npm run dev
```

You should see:
```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Zubix Pod Server Started                        ║
║                                                       ║
║   📡 HTTP Server: http://localhost:3000             ║
║   🔌 WebSocket Server: ws://localhost:3000          ║
║   🌍 Environment: development                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

### 6️⃣ Test the Server

Open a new terminal and test the health endpoint:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-05T...",
  "service": "zubix-pod-backend"
}
```

## 🎯 Quick Test Workflow

### 1. Register a Pod Owner
```bash
curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "owner@example.com",
    "username": "podowner",
    "password": "password123",
    "role": "POD_OWNER",
    "fullName": "Pod Owner"
  }'
```

### 2. Register a Regular User
```bash
curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "user@example.com",
    "username": "testuser",
    "password": "password123",
    "role": "USER",
    "fullName": "Test User"
  }'
```

### 3. Login and Get Token
```bash
curl -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    "email": "owner@example.com",
    "password": "password123"
  }'
```

Save the `token` from the response!

### 4. Create a Pod
```bash
curl -X POST http://localhost:3000/api/pods `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN_HERE" `
  -d '{
    "name": "Tech Enthusiasts",
    "description": "A community for technology lovers",
    "isPublic": true
  }'
```

Save the pod `id` from the response!

### 5. Join the Pod (as regular user)
Login as the regular user and get their token, then:
```bash
curl -X POST http://localhost:3000/api/pods/POD_ID_HERE/join `
  -H "Authorization: Bearer USER_TOKEN_HERE"
```

### 6. Create a Post
```bash
curl -X POST http://localhost:3000/api/posts `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN_HERE" `
  -d '{
    "content": "Welcome to our pod!",
    "podId": "POD_ID_HERE"
  }'
```

### 7. Get Feed
```bash
curl http://localhost:3000/api/posts/feed `
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🛠️ Useful Commands

### View Database in Browser
```bash
npm run prisma:studio
```
Opens at http://localhost:5555

### Reset Database
```bash
npx prisma migrate reset
```
⚠️ This will delete all data!

### Create New Migration
```bash
npx prisma migrate dev --name migration_name
```

### Check Migration Status
```bash
npx prisma migrate status
```

## 🐛 Troubleshooting

### Database Connection Error
- Check if PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure database exists: `CREATE DATABASE zubix_pod;`

### Port Already in Use
- Change PORT in .env file
- Or kill the process using port 3000:
  ```bash
  # Find process
  Get-NetTCPConnection -LocalPort 3000
  # Kill process
  Stop-Process -Id PROCESS_ID -Force
  ```

### Prisma Client Not Generated
```bash
npx prisma generate
```

### Migration Errors
```bash
# Reset and start fresh (⚠️ deletes data)
npx prisma migrate reset
npx prisma migrate dev --name init
```

## 📚 Next Steps

1. **Read the full documentation**: Check `README.md`
2. **Explore API endpoints**: See `API_TESTS.md`
3. **Test with Postman/Insomnia**: Import the API collection
4. **Build a frontend**: Connect using REST API and Socket.IO
5. **Deploy to production**: Follow deployment guide in README

## 🎉 You're All Set!

Your Zubix Pod backend is now running. Start building your social media app!

### Key Features Available:
- ✅ User authentication (USER & POD_OWNER roles)
- ✅ Pod creation and management
- ✅ Posts with owner/member updates
- ✅ Reactions (like, love, wow, sad, angry)
- ✅ Real-time chat rooms with Socket.IO
- ✅ Events with participant management
- ✅ Search and discovery

### Development Tips:
- Use `npm run dev` for auto-reload during development
- Check `npm run prisma:studio` to browse database
- Monitor console for error logs
- Test endpoints using curl, Postman, or the provided API tests

Happy coding! 🚀
