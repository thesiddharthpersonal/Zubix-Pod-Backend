# Zubix Pod Backend API Documentation

## Overview
Complete backend API implementation for the Zubix Pod social platform with pods, rooms, events, pitches, chats, and more.

## Base URL
```
http://localhost:3000/api
```

## Authentication
All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## API Endpoints

### Authentication (`/api/auth`)

#### POST `/api/auth/register`
Register a new user.
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "mobile": "+1234567890",
  "password": "password123"
}
```

#### POST `/api/auth/login`
Login with email/mobile and password.
```json
{
  "emailOrMobile": "john@example.com",
  "password": "password123"
}
```

#### GET `/api/auth/me`
Get current user profile (authenticated).

#### PUT `/api/auth/profile`
Update current user profile (authenticated).

---

### Users (`/api/users`)

#### GET `/api/users/:userId`
Get user profile by ID.

#### GET `/api/users/username/:username`
Get user by username.

#### GET `/api/users/search/query?q=<query>`
Search users by name, username, or email.

#### PUT `/api/users/profile`
Update current user's profile.

#### POST `/api/users/complete-registration`
Complete user registration with additional details.

#### POST `/api/users/upload-photo`
Upload profile photo.

---

### Pods (`/api/pods`)

#### GET `/api/pods`
Get all public pods.

#### GET `/api/pods/search?query=<query>`
Search pods by name.

#### GET `/api/pods/joined`
Get pods that current user has joined.

#### GET `/api/pods/owned`
Get pods owned by current user (pod owners only).

#### GET `/api/pods/subcategory/:subcategory`
Get pods by subcategory.

#### GET `/api/pods/:podId`
Get pod details by ID.

#### GET `/api/pods/:podId/members`
Get all members of a pod.

#### POST `/api/pods`
Create a new pod (pod owners only).

#### PUT `/api/pods/:podId`
Update pod details (owner only).

#### DELETE `/api/pods/:podId`
Delete a pod (owner only).

#### POST `/api/pods/:podId/join`
Join a pod as a member.

#### POST `/api/pods/:podId/leave`
Leave a pod.

#### POST `/api/pods/:podId/co-owners`
Add a co-owner to the pod (owner only).
```json
{
  "username": "co_owner_username"
}
```

#### DELETE `/api/pods/:podId/co-owners/:userId`
Remove a co-owner (owner only).

#### POST `/api/pods/:podId/logo`
Upload pod logo (owner only).

#### DELETE `/api/pods/:podId/members/:userId`
Remove a member from the pod (owner only).

#### GET `/api/pods/admin/pending`
Get pods pending approval (admin).

#### POST `/api/pods/:podId/approve`
Approve a pod (admin).

---

### Posts (`/api/posts`)

#### GET `/api/posts/feed?type=<all|owner|member>`
Get posts from all joined pods.

#### GET `/api/posts/pod/:podId?type=<all|owner|member>`
Get posts from a specific pod.

#### GET `/api/posts/:postId`
Get a single post by ID.

#### GET `/api/posts/:postId/comments`
Get comments for a post.

#### POST `/api/posts`
Create a new post.
```json
{
  "content": "Post content",
  "podId": "pod-id",
  "mediaUrls": ["url1", "url2"],
  "mediaType": "image"
}
```

#### PUT `/api/posts/:postId`
Update a post (author only).

#### DELETE `/api/posts/:postId`
Delete a post (author or pod owner).

#### POST `/api/posts/:postId/comments`
Add a comment to a post.
```json
{
  "content": "Comment text"
}
```

#### DELETE `/api/posts/:postId/comments/:commentId`
Delete a comment (author or pod owner).

#### POST `/api/posts/upload-media`
Upload media for a post.

---

### Reactions (`/api/reactions`)

#### POST `/api/reactions`
Add a reaction to a post.
```json
{
  "postId": "post-id",
  "type": "like"
}
```

#### DELETE `/api/reactions/:reactionId`
Remove a reaction.

---

### Rooms (`/api/rooms`)

#### GET `/api/rooms/pod/:podId`
Get all rooms in a pod.

#### GET `/api/rooms/:roomId`
Get room details.

#### GET `/api/rooms/:roomId/messages?limit=50&before=<messageId>`
Get messages in a room (with pagination).

#### GET `/api/rooms/:roomId/questions`
Get questions in a Q&A room.

#### GET `/api/rooms/:roomId/questions/:questionId/answers`
Get answers for a question.

#### POST `/api/rooms`
Create a new room (pod owner only).
```json
{
  "name": "Room Name",
  "description": "Room description",
  "podId": "pod-id",
  "type": "GENERAL",
  "privacy": "PUBLIC"
}
```

#### PUT `/api/rooms/:roomId`
Update a room (pod owner only).

#### DELETE `/api/rooms/:roomId`
Delete a room (pod owner only).

#### POST `/api/rooms/:roomId/members`
Add a member to a private room (owner only).

#### DELETE `/api/rooms/:roomId/members/:userId`
Remove a member from a room (owner only).

#### POST `/api/rooms/:roomId/questions`
Create a question in a Q&A room.

#### DELETE `/api/rooms/:roomId/questions/:questionId`
Delete a question.

#### POST `/api/rooms/:roomId/questions/:questionId/answers`
Add an answer to a question.

#### DELETE `/api/rooms/:roomId/questions/:questionId/answers/:answerId`
Delete an answer.

---

### Events (`/api/events`)

#### GET `/api/events/feed`
Get events from all joined pods.

#### GET `/api/events/pod/:podId`
Get events from a specific pod.

#### GET `/api/events/:eventId`
Get event details.

#### GET `/api/events/:eventId/participants`
Get event participants.

#### POST `/api/events`
Create a new event (pod owner only).
```json
{
  "name": "Event Name",
  "type": "online",
  "date": "2024-12-31T00:00:00Z",
  "time": "18:00",
  "location": "Virtual",
  "description": "Event description",
  "helpline": "+1234567890",
  "podId": "pod-id"
}
```

#### PUT `/api/events/:eventId`
Update an event (pod owner only).

#### DELETE `/api/events/:eventId`
Delete an event (pod owner only).

#### POST `/api/events/:eventId/join`
Register for an event.

#### POST `/api/events/:eventId/leave`
Unregister from an event.

---

### Pitches (`/api/pitches`)

#### GET `/api/pitches/pod/:podId?status=<status>`
Get pitches for a pod.

#### GET `/api/pitches/user/:userId`
Get user's pitches.

#### GET `/api/pitches/:pitchId`
Get pitch details.

#### POST `/api/pitches`
Create a new pitch.
```json
{
  "podId": "pod-id",
  "startupName": "Startup Name",
  "summary": "Brief summary",
  "sector": "Technology",
  "stage": "MVP",
  "ask": "500K seed funding",
  "operatingCity": "San Francisco",
  "website": "https://startup.com",
  "contactEmail": "founder@startup.com",
  "contactPhone": "+1234567890"
}
```

#### PUT `/api/pitches/:pitchId`
Update a pitch (founder only).

#### DELETE `/api/pitches/:pitchId`
Delete a pitch (founder or pod owner).

#### PATCH `/api/pitches/:pitchId/status`
Update pitch status (pod owner/co-owner only).
```json
{
  "status": "ACCEPTED"
}
```

#### POST `/api/pitches/:pitchId/replies`
Add a reply to a pitch (pod owner/co-owner only).

#### POST `/api/pitches/:pitchId/pitch-deck`
Upload pitch deck.

---

### Chats/DMs (`/api/chats`)

#### GET `/api/chats`
Get all chats for the current user.

#### GET `/api/chats/:chatId`
Get chat details.

#### GET `/api/chats/:chatId/messages?limit=50&before=<messageId>`
Get messages in a chat.

#### POST `/api/chats/get-or-create`
Get existing chat or create new one with a user.
```json
{
  "targetUserId": "user-id"
}
```

#### POST `/api/chats/:chatId/messages`
Send a message in a chat.
```json
{
  "content": "Message text"
}
```

#### DELETE `/api/chats/messages/:messageId`
Delete a message (sender only).

---

### Message Requests (`/api/message-requests`)

#### GET `/api/message-requests/received`
Get received message requests.

#### GET `/api/message-requests/sent`
Get sent message requests.

#### GET `/api/message-requests/pending/count`
Get count of pending requests.

#### GET `/api/message-requests/check/:targetUserId`
Check if request exists with a user.

#### POST `/api/message-requests`
Send a message request.
```json
{
  "receiverId": "user-id",
  "initialMessage": "Hi, I'd like to connect"
}
```

#### POST `/api/message-requests/:requestId/accept`
Accept a message request.

#### POST `/api/message-requests/:requestId/reject`
Reject a message request.

---

### Call Bookings (`/api/call-bookings`)

#### GET `/api/call-bookings/requested`
Get bookings made by user.

#### GET `/api/call-bookings/received`
Get bookings received by user.

#### GET `/api/call-bookings/pending/count`
Get count of pending bookings.

#### POST `/api/call-bookings`
Create a call booking.
```json
{
  "podId": "pod-id",
  "targetUserId": "user-id",
  "targetRole": "owner",
  "purpose": "Discuss funding opportunities",
  "preferredDate": "2024-12-31",
  "preferredTime": "14:00"
}
```

#### POST `/api/call-bookings/:bookingId/respond`
Respond to a call booking.
```json
{
  "status": "accepted",
  "remark": "Looking forward to it!"
}
```

#### DELETE `/api/call-bookings/:bookingId`
Cancel a booking (requester only, pending only).

---

### Notifications (`/api/notifications`)

#### GET `/api/notifications?limit=50&unreadOnly=true`
Get user's notifications.

#### GET `/api/notifications/unread/count`
Get count of unread notifications.

#### PATCH `/api/notifications/:notificationId/read`
Mark a notification as read.

#### POST `/api/notifications/mark-all-read`
Mark all notifications as read.

#### DELETE `/api/notifications/:notificationId`
Delete a notification.

---

## WebSocket Events

### Connection
Connect to WebSocket server with authentication:
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});
```

### Room Events

#### Client → Server
- `join-room` - Join a room
  ```json
  { "roomId": "room-id" }
  ```
- `leave-room` - Leave a room
  ```json
  { "roomId": "room-id" }
  ```
- `send-message` - Send a message to a room
  ```json
  { "roomId": "room-id", "content": "Message text" }
  ```
- `typing-start` - Start typing indicator
  ```json
  { "roomId": "room-id" }
  ```
- `typing-stop` - Stop typing indicator
  ```json
  { "roomId": "room-id" }
  ```

#### Server → Client
- `room-joined` - Confirmation of joining room
- `user-joined` - Another user joined the room
- `user-left` - User left the room
- `new-message` - New message in the room
- `user-typing` - User is typing
- `user-stopped-typing` - User stopped typing

### Chat/DM Events

#### Client → Server
- `join-chat` - Join a chat
  ```json
  { "chatId": "chat-id" }
  ```
- `leave-chat` - Leave a chat
  ```json
  { "chatId": "chat-id" }
  ```
- `send-dm` - Send a direct message
  ```json
  { "chatId": "chat-id", "content": "Message text" }
  ```
- `dm-typing-start` - Start typing in DM
  ```json
  { "chatId": "chat-id" }
  ```
- `dm-typing-stop` - Stop typing in DM
  ```json
  { "chatId": "chat-id" }
  ```

#### Server → Client
- `chat-joined` - Confirmation of joining chat
- `new-dm` - New direct message
- `dm-user-typing` - User is typing in DM
- `dm-user-stopped-typing` - User stopped typing in DM

### Notification Events

#### Client → Server
- `join-notifications` - Join notification channel (auto-joined on connection)

#### Server → Client
- `notifications-joined` - Confirmation of joining notifications
- `new-notification` - New notification (sent to `user:<userId>` channel)

---

## Setup Instructions

### 1. Install Dependencies
```bash
cd zubix-pod-backend
npm install
```

### 2. Configure Environment
Create a `.env` file:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/zubix_pod"
JWT_SECRET="your-secret-key"
CLIENT_URL="http://localhost:5173"
PORT=3000
NODE_ENV=development
```

### 3. Run Database Migrations
```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start Server
```bash
npm run dev
```

---

## Database Models

### Key Models
- **User** - User profiles with extended fields
- **Pod** - Pods with co-owners, subcategories, and approval system
- **Post** - Posts with comments and reactions
- **Comment** - Comments on posts
- **Room** - Rooms with types (GENERAL/QA) and privacy (PUBLIC/PRIVATE)
- **Message** - Messages for both rooms and chats
- **Question/Answer** - Q&A system for rooms
- **Event** - Events with participants
- **Pitch** - Startup pitches with status and replies
- **Chat** - Direct message chats between users
- **MessageRequest** - Message connection requests
- **CallBooking** - Call booking requests with pod owners
- **Notification** - User notifications

---

## Response Format

### Success Response
```json
{
  "data": { /* response data */ }
}
```

### Error Response
```json
{
  "error": "Error message"
}
```

### Validation Error Response
```json
{
  "errors": [
    {
      "field": "email",
      "message": "Invalid email"
    }
  ]
}
```

---

## Status Codes
- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
