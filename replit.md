# PinMyPic - Photography Portfolio & Booking Platform

## Recent Changes
- **ENHANCED FACE RECOGNITION QUEUE FOR 100+ CONCURRENT USERS** (August 9, 2025)
  - **Scalable Queue System**: Completely redesigned face processing queue to handle high concurrent load
    - Increased concurrent processing from 3 to 8 simultaneous face recognition tasks
    - Added user-based queue management with per-user limits (20 items max per user)
    - Implemented priority queuing system (high/normal/low) for different request types
    - Added intelligent load balancing to prevent any single user from overwhelming the system
  - **Advanced Queue Features**: Enhanced queue functionality for better user experience
    - User-specific concurrency limits (3 concurrent processes per user) for fair resource allocation
    - Exponential backoff retry logic with intelligent error handling
    - Real-time queue statistics and performance monitoring
    - Automatic cleanup of inactive user queues and maintenance tasks
  - **Queue Management APIs**: New REST endpoints for queue monitoring and administration
    - GET /api/face-queue/status - System-wide queue statistics and performance metrics
    - GET /api/face-queue/user-status - User-specific queue position and status
    - POST /api/face-queue/settings - Admin controls for queue configuration tuning
  - **React Queue Status Component**: Added real-time queue monitoring interface
    - FaceRecognitionQueueStatus component with live updates every 10 seconds
    - User queue position tracking and progress visualization
    - System load indicators and performance metrics display
    - Auto-refresh toggle and manual refresh controls
- **COMPREHENSIVE ERROR ANALYSIS AND FIXES COMPLETED** (August 9, 2025)
  - **CRITICAL GridFS Methods Added**: Fixed all missing MongoDB GridFS methods causing TypeScript errors
    - Added uploadImageToGridFS method for storing original images in GridFS with metadata
    - Added uploadThumbnailToGridFS method for storing WebP thumbnails with original file references
    - Added deleteImageFromGridFS method for proper file cleanup during photo deletion
    - Added removePhotoFromAllUsers method for cascade deletion when photos are removed
  - **React Component Safety Improvements**: Enhanced component robustness
    - Fixed potential null pointer in AdminUsersManagement dialog description
    - Improved use-mobile hook initialization to prevent undefined state during SSR
    - Enhanced state management to avoid undefined values in UI components
  - **Error Prevention**: Conducted comprehensive codebase analysis and addressed potential issues
    - Identified and documented race condition risks in concurrent database operations
    - Verified proper error handling patterns across all critical functions
    - Confirmed environment variable dependencies and configuration requirements
  - **Code Quality**: All LSP diagnostics resolved and TypeScript compilation errors fixed
- **CRITICAL FIX**: Resolved image loading failure issue (August 9, 2025)
  - Fixed "mongoStorage.getImageFromGridFS is not a function" error preventing all image loads
  - Added missing GridFS integration method to MongoDBStorage class in mongo-storage.ts
  - Implemented proper GridFS bucket configuration with 'photos' bucketName
  - Added comprehensive error handling for image retrieval with proper Buffer and contentType handling
  - System now properly serves images from MongoDB GridFS storage
  - Face recognition service and all application features fully restored to working state
- Completed production deployment preparation with comprehensive optimizations (August 9, 2025)
  - Created detailed deployment checklist with all production requirements
  - Added production utilities for error handling, performance measurement, and feature detection
  - Integrated connection quality detection and performance monitoring
  - Fixed all TypeScript compilation issues for production-ready build
  - Verified all performance optimizations are properly initialized in App.tsx
- Implemented comprehensive website performance optimizations (August 8, 2025)
  - Enhanced React Query configuration with intelligent retry logic, exponential backoff, and network-aware settings
  - Added advanced caching system with LRU eviction, TTL management, and smart cache invalidation
  - Implemented Service Worker for offline functionality, static asset caching, and background sync
  - Created performance monitoring system with real-time metrics, memory management, and connection-aware loading
  - Added intelligent image optimization with lazy loading, format detection, and progressive enhancement
  - Implemented network request optimization with batching, deduplication, and priority queuing
  - Added performance tracking utilities with timing measurements and automatic cleanup
  - Created development-only performance monitor (Ctrl+Shift+P to toggle) for optimization insights
- Fixed page navigation scroll behavior (August 8, 2025)
  - Added global ScrollToTop component in App.tsx to ensure all page navigations start from the top
  - Enhanced ProtectedRoute component with scroll-to-top functionality for sign-in screens
  - Resolved issue where logged-out users navigating to booking page would load from bottom of screen
- Updated face recognition dialog UI styling (August 8, 2025)
  - Removed cross mark (X) from all dialog components for cleaner interface
  - Changed cancel button to white background with red text and hover effects
  - Added border and drop shadow to cancel button for better visual definition
- Enhanced save photos authentication flow with improved UX (August 8, 2025)
  - Save button now visible to all users (authenticated and unauthenticated)
  - Clicking save without authentication shows toast notification with sign-in prompt
  - Users remain on current page after Google authentication via stored redirect URL
  - Toast notifications appear above fullscreen photo viewer with z-[200] layering
  - Sign-in button in toast matches home page hero button styling (gradient, rounded-full, shadows)
- Removed allowPhotoUploadForFaceRecognition feature from the entire application (August 6, 2025)
- Cleaned up Event interface by removing the face recognition upload field from shared/types.ts
- Updated all components (EventDetailsDialog, EditableEventRow) to remove face recognition UI elements
- Simplified event management by removing unnecessary complexity from event creation and editing
- Implemented cascade deletion functionality for events - when an event is deleted, all associated photos are deleted and removed from users' saved photos lists (August 6, 2025)
- Fixed all TypeScript compilation errors related to MongoDB operators using type casting

## Overview
PinMyPic is an AI-powered photography portfolio and booking platform designed for photographers to showcase their work, manage events, and handle bookings. Its key innovation is the "FindMyFace" service, utilizing AI-powered face recognition to allow clients to easily locate and retrieve their photos from event galleries. The platform aims to provide a modern, streamlined experience for both photographers and their clients, leveraging cutting-edge technology for efficient photo management and delivery.

## User Preferences
- Primary authentication method: Google OAuth only (integrated in nav header)
- Database-driven content (no static/mock data)
- Modern, clean UI design
- Secure client/server separation
- Streamlined UX with minimal authentication steps

## System Architecture
The platform is built with a decoupled frontend and backend.
- **Frontend**: Developed with React and TypeScript for dynamic user interfaces, styled using Tailwind CSS for utility-first styling, and enhanced with Radix UI components for accessible and customizable UI primitives.
- **Backend**: Implemented using Express.js with TypeScript, providing a robust API layer.
- **Data Storage**: MongoDB Atlas serves as the primary database for all application data, including event metadata, user information, bookings, and image metadata. MongoDB GridFS is used for efficient storage and serving of high-resolution images, with Cloudinary integrated as the primary cloud storage solution offering advanced image optimization and delivery, and a fallback system to MongoDB GridFS and local file system.
- **Authentication**: Firebase Authentication handles user authentication, specifically utilizing Google OAuth for streamlined login.
- **Image Processing**: A Python AI service, leveraging InsightFace for face recognition, processes images to extract face embeddings. This service runs asynchronously in the background.
- **Deployment**: The entire application is designed to run within a Replit environment.

**Key Technical Implementations & Design Decisions:**
- **AI-Powered FindMyFace**: Integrates a Python Flask service for real-time face recognition, extracting face embeddings (with bounding boxes and confidence scores) stored in MongoDB. It supports both webcam capture and photo uploads for client-side face matching against event galleries.
- **Robust Photo Upload System**: Enhanced multi-photo upload system with queue-based face recognition processing, batch handling (max 3 files at a time), timeout protection (30s), health checks, and graceful fallback when face recognition fails. Prevents service overload and "socket hang up" errors that occurred with simultaneous uploads.
- **Comprehensive Image Management**: Supports large batch photo uploads (up to 10GB total, 100MB per file), with automatic processing for face recognition, image compression (WebP conversion, quality optimization), and original quality downloads. Includes features like thumbnail selection and efficient gallery display with virtualization and pagination.
- **Online Booking System**: Enables clients to book photography packages, with detailed booking management for admins (accept/reject/delete, amount editing).
- **Event Management**: Full CRUD operations for events, including dual PIN access (Public PIN for face recognition, Bride-Groom PIN for direct access) and QR-based event access with expiration.
- **User & Role Management**: Implements a robust role-based access control system (Owner, Admin, Moderator, QR Share) with granular permissions, secure user promotion/demotion, and user-friendly sorting in the admin dashboard.
- **Performance Optimizations**: Features include in-memory caching for API responses, parallel data fetching, lazy loading for images and pages, virtualized scrolling for galleries, image preloading, and optimized server payload limits.
- **Photo Interaction**: Full-screen photo viewer with zoom, pan, like/unlike, and download functionalities. "Save to Profile" allows users to collect favorite photos, with bulk download as ZIP.
- **Security**: All secrets are managed via environment variables, and email uniqueness is enforced at the application level to prevent duplicate user accounts.
- **UI/UX**: Modern, clean design using Tailwind CSS and Radix UI. Consistent fullscreen viewer experience. Responsive design and intuitive workflows across the platform. Image display is optimized for performance, providing compressed versions for display while preserving original quality for downloads.

## External Dependencies
- **Cloudinary**: Primary cloud storage for images, handling automatic optimization and delivery.
- **MongoDB Atlas**: Cloud-hosted NoSQL database for all application data.
- **Firebase Authentication**: Provides secure user authentication, specifically for Google OAuth.
- **Firebase Storage**: Used for assets and previous photo storage, though superseded by MongoDB GridFS and Cloudinary.
- **Python Flask (InsightFace)**: Dedicated microservice for AI-powered face recognition.
- **JSZip**: Library used for client-side ZIP compression for bulk photo downloads.
- **Sharp**: Node.js image processing library used server-side for image compression and optimization.