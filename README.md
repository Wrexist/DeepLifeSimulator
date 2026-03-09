# DeeplifeSim

A comprehensive life simulation game with career progression, underground economy, skill trees, and social interactions.

## Latest Release (v2.2.8)

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for full details.

### Highlights
- Fairness improvements and relationship consequences
- Performance optimizations and economy balance
- Comprehensive stability and crash fixes
- Save system integrity improvements

## Web Preview

For development and testing, you can preview the app on different device viewports:

```bash
npm run web
```

Then navigate to `http://localhost:19006/preview` (or the port shown by Expo).

### Device Presets
- **iPhone SE (375×667)**: Small iPhone viewport
- **iPhone 15 Pro (393×852)**: Standard iPhone viewport  
- **iPhone 15 Pro Max (430×932)**: Large iPhone viewport
- **iPad 9/10 (768×1024)**: Standard iPad viewport
- **iPad Pro 12.9 (1024×1366)**: Large iPad viewport
- **Desktop 1280**: Standard desktop viewport
- **Desktop 1440**: Large desktop viewport

### URL Parameters
You can also set custom viewport dimensions via URL parameters:
- `?w=393&h=852` - Set custom width and height
- Presets are automatically saved to localStorage and persist across page reloads
- Use the "Reset" button to clear viewport overrides

## Key Features

- Career progression with 20+ career paths including politician, celebrity, and athlete
- Dynamic stock market and crypto trading with weekly simulations
- Family tree system with inheritance, marriage, and generational prestige
- Underground economy with skill trees (Stealth, Technology, Lockpicking)
- Real estate, vehicles, and property management
- Social media simulation with NPC interactions
- Cloud save with conflict resolution
- Achievements, leaderboards, and daily challenges
- In-app purchases and subscription system

## Cloud Save

### Setup

To enable cloud save functionality, set the `EXPO_PUBLIC_CLOUD_SAVE_URL` environment variable to point to your backend service URL.

```bash
# .env or .env.local
EXPO_PUBLIC_CLOUD_SAVE_URL=https://your-backend-url.com/api
```

### Backend Requirements

Your backend service must implement the following endpoints:

#### POST `/save`
Saves the game state to the cloud.

**Request:**
```json
{
  "userId": "string",
  "slot": "number",
  "data": "string (JSON serialized game state)",
  "version": "number",
  "timestamp": "number"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Save successful"
}
```

#### GET `/save?userId={userId}&slot={slot}`
Retrieves a saved game state from the cloud.

**Response:**
```json
{
  "success": true,
  "data": "string (JSON serialized game state)",
  "version": "number",
  "timestamp": "number"
}
```

#### POST `/leaderboard`
Uploads a leaderboard score.

**Request:**
```json
{
  "userId": "string",
  "score": "number",
  "netWorth": "number",
  "week": "number"
}
```

**Response:**
```json
{
  "success": true,
  "rank": "number"
}
```

#### GET `/leaderboard`
Retrieves the leaderboard.

**Response:**
```json
{
  "success": true,
  "scores": [
    {
      "userId": "string",
      "score": "number",
      "netWorth": "number",
      "week": "number",
      "rank": "number"
    }
  ]
}
```

### Implementation Notes

- The game state is serialized as JSON before being sent to the backend
- Save operations are queued and retried automatically on failure
- Storage quota errors are handled gracefully with user-friendly messages
- The service includes conflict resolution for concurrent saves
- Network status is monitored to queue saves when offline

### Example Backend Implementation

A basic Node.js/Express example:

```javascript
const express = require('express');
const app = express();

app.use(express.json());

const saves = new Map(); // In production, use a database

app.post('/save', (req, res) => {
  const { userId, slot, data, version, timestamp } = req.body;
  const key = `${userId}_${slot}`;
  saves.set(key, { data, version, timestamp });
  res.json({ success: true, message: 'Save successful' });
});

app.get('/save', (req, res) => {
  const { userId, slot } = req.query;
  const key = `${userId}_${slot}`;
  const save = saves.get(key);
  if (save) {
    res.json({ success: true, ...save });
  } else {
    res.status(404).json({ success: false, message: 'Save not found' });
  }
});

app.listen(3000);
```
