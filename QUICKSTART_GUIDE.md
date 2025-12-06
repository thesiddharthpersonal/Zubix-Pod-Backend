# Quick Start Guide

## Prerequisites
- Node.js (v18+)
- PostgreSQL database
- npm or yarn

## Setup Steps

### 1. Install Dependencies
```bash
cd zubix-pod-backend
npm install
```

### 2. Configure Database
Create a PostgreSQL database and update `.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/zubix_pod"
JWT_SECRET="your-super-secret-jwt-key-change-this"
CLIENT_URL="http://localhost:5173"
PORT=3000
NODE_ENV=development
```

### 3. Generate Prisma Client & Run Migrations
```bash
# Generate Prisma client
npm run prisma:generate

# Create and apply migrations
npm run prisma:migrate

# Optional: Open Prisma Studio to view database
npm run prisma:studio
```

### 4. Start the Server
```bash
# Development mode with auto-reload
npm run dev

# Or production mode
npm start
```

The server will start on `http://localhost:3000`

### 5. Test the API
Check if the server is running:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-12-06T...",
  "service": "zubix-pod-backend"
}
```

## Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm run prisma:generate   # Generate Prisma client
npm run prisma:migrate    # Run database migrations
npm run prisma:studio     # Open Prisma Studio (database GUI)
```

## Testing Authentication

### 1. Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "mobile": "+1234567890",
    "password": "password123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrMobile": "john@example.com",
    "password": "password123"
  }'
```

Save the returned `token` for authenticated requests.

### 3. Get Current User
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Frontend Integration

Update your frontend `.env` file:
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

## Common Issues

### Database Connection Error
- Ensure PostgreSQL is running
- Check DATABASE_URL in `.env`
- Verify database credentials

### Port Already in Use
- Change PORT in `.env`
- Or kill the process using port 3000:
  ```bash
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  
  # Linux/Mac
  lsof -ti:3000 | xargs kill -9
  ```

### Prisma Migration Errors
- Drop and recreate database if needed:
  ```bash
  npm run prisma:migrate reset
  ```

## Next Steps

1. ✅ Backend is running
2. ⏭️ Update frontend API service files to use real endpoints
3. ⏭️ Implement file upload service (AWS S3, Cloudinary, etc.)
4. ⏭️ Add seed data for testing
5. ⏭️ Configure production deployment

## Documentation

- `API_DOCUMENTATION.md` - Complete API reference
- `IMPLEMENTATION_SUMMARY.md` - Implementation details
- `API_TESTS.md` - Test examples (if exists)

## Support

For issues or questions:
1. Check the documentation files
2. Review Prisma schema in `prisma/schema.prisma`
3. Check route files in `src/routes/`
4. Review server logs for errors
