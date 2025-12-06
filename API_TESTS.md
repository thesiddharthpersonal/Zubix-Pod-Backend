# API Test Collection for Zubix Pod

## Base URL
```
http://localhost:3000
```

## Variables
- `{{baseUrl}}`: http://localhost:3000
- `{{token}}`: Your JWT token after login
- `{{podId}}`: A pod UUID
- `{{roomId}}`: A room UUID
- `{{eventId}}`: An event UUID
- `{{postId}}`: A post UUID

---

## Authentication

### Register as User
```http
POST {{baseUrl}}/api/auth/register
Content-Type: application/json

{
  "email": "john@example.com",
  "username": "john_doe",
  "password": "password123",
  "role": "USER",
  "fullName": "John Doe"
}
```

### Register as Pod Owner
```http
POST {{baseUrl}}/api/auth/register
Content-Type: application/json

{
  "email": "owner@example.com",
  "username": "pod_owner",
  "password": "password123",
  "role": "POD_OWNER",
  "fullName": "Pod Owner"
}
```

### Login
```http
POST {{baseUrl}}/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Get Current User
```http
GET {{baseUrl}}/api/auth/me
Authorization: Bearer {{token}}
```

---

## Pods

### Get All Public Pods
```http
GET {{baseUrl}}/api/pods
Authorization: Bearer {{token}}
```

### Search Pods
```http
GET {{baseUrl}}/api/pods/search?query=tech
Authorization: Bearer {{token}}
```

### Get Joined Pods
```http
GET {{baseUrl}}/api/pods/joined
Authorization: Bearer {{token}}
```

### Get Owned Pods
```http
GET {{baseUrl}}/api/pods/owned
Authorization: Bearer {{token}}
```

### Get Pod by ID
```http
GET {{baseUrl}}/api/pods/{{podId}}
Authorization: Bearer {{token}}
```

### Create Pod (Pod Owner Only)
```http
POST {{baseUrl}}/api/pods
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Tech Enthusiasts",
  "description": "A community for technology lovers",
  "isPublic": true,
  "avatar": "https://example.com/avatar.jpg",
  "coverImage": "https://example.com/cover.jpg"
}
```

### Update Pod
```http
PUT {{baseUrl}}/api/pods/{{podId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Updated Tech Enthusiasts",
  "description": "Updated description"
}
```

### Delete Pod
```http
DELETE {{baseUrl}}/api/pods/{{podId}}
Authorization: Bearer {{token}}
```

### Join Pod
```http
POST {{baseUrl}}/api/pods/{{podId}}/join
Authorization: Bearer {{token}}
```

### Leave Pod
```http
POST {{baseUrl}}/api/pods/{{podId}}/leave
Authorization: Bearer {{token}}
```

### Remove Member (Owner Only)
```http
DELETE {{baseUrl}}/api/pods/{{podId}}/members/{{userId}}
Authorization: Bearer {{token}}
```

---

## Posts

### Get Posts from Specific Pod (All)
```http
GET {{baseUrl}}/api/posts/pod/{{podId}}?type=all
Authorization: Bearer {{token}}
```

### Get Posts from Specific Pod (Owner Updates Only)
```http
GET {{baseUrl}}/api/posts/pod/{{podId}}?type=owner
Authorization: Bearer {{token}}
```

### Get Posts from Specific Pod (Member Updates Only)
```http
GET {{baseUrl}}/api/posts/pod/{{podId}}?type=member
Authorization: Bearer {{token}}
```

### Get Feed from All Joined Pods
```http
GET {{baseUrl}}/api/posts/feed?type=all
Authorization: Bearer {{token}}
```

### Get Single Post
```http
GET {{baseUrl}}/api/posts/{{postId}}
Authorization: Bearer {{token}}
```

### Create Post
```http
POST {{baseUrl}}/api/posts
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "content": "This is my first post in the pod!",
  "podId": "{{podId}}",
  "imageUrl": "https://example.com/image.jpg"
}
```

### Update Post
```http
PUT {{baseUrl}}/api/posts/{{postId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "content": "Updated post content"
}
```

### Delete Post
```http
DELETE {{baseUrl}}/api/posts/{{postId}}
Authorization: Bearer {{token}}
```

---

## Reactions

### Add Reaction
```http
POST {{baseUrl}}/api/reactions
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "postId": "{{postId}}",
  "type": "like"
}
```

### Remove Reaction
```http
DELETE {{baseUrl}}/api/reactions/{{postId}}
Authorization: Bearer {{token}}
```

### Get Reactions for Post
```http
GET {{baseUrl}}/api/reactions/post/{{postId}}
Authorization: Bearer {{token}}
```

---

## Rooms

### Get Rooms in Pod
```http
GET {{baseUrl}}/api/rooms/pod/{{podId}}
Authorization: Bearer {{token}}
```

### Get Room by ID
```http
GET {{baseUrl}}/api/rooms/{{roomId}}
Authorization: Bearer {{token}}
```

### Create Room (Pod Owner Only)
```http
POST {{baseUrl}}/api/rooms
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "General Chat",
  "description": "Main discussion room",
  "podId": "{{podId}}"
}
```

### Update Room
```http
PUT {{baseUrl}}/api/rooms/{{roomId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Updated Room Name",
  "description": "Updated description"
}
```

### Delete Room
```http
DELETE {{baseUrl}}/api/rooms/{{roomId}}
Authorization: Bearer {{token}}
```

### Get Room Messages
```http
GET {{baseUrl}}/api/rooms/{{roomId}}/messages?limit=50
Authorization: Bearer {{token}}
```

### Get Room Messages (Pagination)
```http
GET {{baseUrl}}/api/rooms/{{roomId}}/messages?limit=50&before={{messageId}}
Authorization: Bearer {{token}}
```

---

## Events

### Get Events Feed (All Joined Pods)
```http
GET {{baseUrl}}/api/events/feed
Authorization: Bearer {{token}}
```

### Get Events in Pod
```http
GET {{baseUrl}}/api/events/pod/{{podId}}
Authorization: Bearer {{token}}
```

### Get Event by ID
```http
GET {{baseUrl}}/api/events/{{eventId}}
Authorization: Bearer {{token}}
```

### Create Event (Pod Owner Only)
```http
POST {{baseUrl}}/api/events
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "title": "Tech Meetup 2025",
  "description": "Monthly technology discussion and networking",
  "location": "Virtual - Zoom",
  "startDate": "2025-12-15T18:00:00Z",
  "endDate": "2025-12-15T20:00:00Z",
  "imageUrl": "https://example.com/event.jpg",
  "podId": "{{podId}}"
}
```

### Update Event
```http
PUT {{baseUrl}}/api/events/{{eventId}}
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "title": "Updated Tech Meetup 2025",
  "description": "Updated description"
}
```

### Delete Event
```http
DELETE {{baseUrl}}/api/events/{{eventId}}
Authorization: Bearer {{token}}
```

### Join Event
```http
POST {{baseUrl}}/api/events/{{eventId}}/join
Authorization: Bearer {{token}}
```

### Leave Event
```http
POST {{baseUrl}}/api/events/{{eventId}}/leave
Authorization: Bearer {{token}}
```

### Get Event Participants
```http
GET {{baseUrl}}/api/events/{{eventId}}/participants
Authorization: Bearer {{token}}
```

---

## WebSocket Testing

### Connect to Socket.IO
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token-here'
  }
});

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('error', (error) => {
  console.error('Error:', error);
});
```

### Join Room
```javascript
socket.emit('join-room', { 
  roomId: 'room-uuid-here' 
});

socket.on('room-joined', (data) => {
  console.log('Room joined:', data);
});

socket.on('user-joined', (data) => {
  console.log('User joined:', data);
});
```

### Send Message
```javascript
socket.emit('send-message', {
  roomId: 'room-uuid-here',
  content: 'Hello, everyone!'
});

socket.on('new-message', (message) => {
  console.log('New message:', message);
});
```

### Typing Indicators
```javascript
// Start typing
socket.emit('typing-start', { roomId: 'room-uuid-here' });

// Stop typing
socket.emit('typing-stop', { roomId: 'room-uuid-here' });

socket.on('user-typing', (data) => {
  console.log(`${data.user.username} is typing...`);
});

socket.on('user-stopped-typing', (data) => {
  console.log(`${data.user.username} stopped typing`);
});
```

### Leave Room
```javascript
socket.emit('leave-room', { 
  roomId: 'room-uuid-here' 
});

socket.on('room-left', (data) => {
  console.log('Room left:', data);
});
```

---

## Health Check

### Check Server Health
```http
GET {{baseUrl}}/health
```

---

## Notes

### Reaction Types
- `like`
- `love`
- `wow`
- `sad`
- `angry`

### User Roles
- `USER` - Regular user who can join pods
- `POD_OWNER` - Can create and manage pods

### Post Types
- `OWNER_UPDATE` - Posts by pod owners
- `MEMBER_UPDATE` - Posts by pod members

### Response Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
