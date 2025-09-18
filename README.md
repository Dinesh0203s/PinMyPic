# PinMyPic - Photography Portfolio & Booking Platform

A modern photography portfolio and booking platform with AI-powered face recognition features.

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v20 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version` and `npm --version`

2. **Python 3.11**
   - Download from: https://www.python.org/downloads/
   - Verify installation: `python --version`

3. **System Requirements**
   - 4GB+ RAM (8GB+ recommended for GPU acceleration)
   - Modern web browser
   - **Platform Support:**
     - Linux/macOS: Full support with CUDA GPU acceleration
     - Windows 11: Full support with CUDA and DirectML GPU acceleration
     - Replit: CPU-only mode for development

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   Create a `.env` file in the root directory:
   ```env
   # Firebase Configuration
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_CLIENT_EMAIL=your-service-account-email
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   
   # Development
   NODE_ENV=development
   PORT=3000
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Access the application**:
   - Web app: http://localhost:3000
   - Face recognition service: http://localhost:5001

## Windows 11 Quick Start

For Windows 11 users with GPU acceleration:

1. **Clone and install**:
   ```cmd
   git clone <repository-url>
   cd pinmypic
   npm install
   ```

2. **Setup face recognition with GPU**:
   ```cmd
   cd server/face-recognition
   setup-windows.bat
   ```

3. **Start the application**:
   ```cmd
   cd ../..
   npm run dev
   ```

   Or start face recognition separately:
   ```cmd
   cd server/face-recognition
   start-windows.bat
   ```

## Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Authentication (Google provider)
3. Enable Realtime Database
4. Generate a service account key from Project Settings > Service Accounts
5. Add the credentials to your `.env` file

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type checking

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   └── contexts/      # React contexts
├── server/                # Express backend
│   ├── face-recognition/  # Python face recognition service
│   └── routes.ts         # API routes
├── shared/               # Shared types and schemas
└── package.json         # Node.js dependencies
```

## Features

- **Photography Portfolio**: Showcase photography work
- **Event Management**: Create and manage photo galleries for events
- **AI Face Recognition**: "FindMyFace" feature to locate photos with GPU acceleration support
- **Booking System**: Online booking with package management
- **Admin Dashboard**: Comprehensive admin panel
- **Firebase Integration**: Real-time database and authentication
- **GPU Acceleration**: Automatic GPU detection for enhanced face recognition performance

## Troubleshooting

**Firebase Connection Issues**:
- Verify your `.env` file has correct Firebase credentials
- Check Firebase project settings
- Ensure Realtime Database is enabled

**Face Recognition Service Issues**:
- Verify all Python dependencies are installed
- Check port 5001 is not being used by another service

## License

MIT License - see LICENSE file for details.