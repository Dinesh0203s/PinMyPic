# PinMyPic - Photography Portfolio & Booking Platform

## Overview
PinMyPic is an AI-powered photography portfolio and booking platform. Its primary purpose is to enable photographers to showcase their work, manage events, and handle client bookings. A key feature is the "FindMyFace" service, which uses AI-powered face recognition to allow clients to easily locate and retrieve their photos from event galleries. The platform aims to offer a modern, streamlined experience for both photographers and clients, leveraging advanced technology for efficient photo management and delivery, with ambitions to be a leading solution in the photography industry.

## User Preferences
- Primary authentication method: Google OAuth only (integrated in nav header)
- Database-driven content (no static/mock data)
- Modern, clean UI design
- Secure client/server separation
- Streamlined UX with minimal authentication steps

## System Architecture
The platform operates with a decoupled frontend and backend.
- **Frontend**: Built with React and TypeScript, styled using Tailwind CSS, and uses Radix UI components for accessible UI.
- **Backend**: Implemented with Express.js and TypeScript, serving as the API layer.
- **Data Storage**: MongoDB Atlas is the primary database for application data and metadata. MongoDB GridFS is used for efficient storage and serving of high-resolution images, complemented by Cloudinary for primary cloud storage, image optimization, and delivery.
- **Authentication**: Firebase Authentication manages user authentication, specifically Google OAuth.
- **Image Processing**: A Python AI service, utilizing InsightFace, processes images for face embeddings asynchronously.
- **Deployment**: The application is designed to run within a Replit environment.

**Key Technical Implementations & Design Decisions:**
- **AI-Powered FindMyFace**: Integrates a Python Flask service for real-time face recognition, storing face embeddings in MongoDB. It supports both webcam and photo uploads for client-side face matching.
- **Canon Connect Auto Transfer**: Supports automatic photo import from Canon Connect through folder selection methods (server-side browsing, manual path input). Camera control features have been removed from admin dashboard to focus on photo transfer functionality.
- **Robust Photo Upload System**: Features a queue-based system for multi-photo uploads, including batch handling, timeout protection, health checks, and graceful fallback for face recognition failures to prevent service overload. Enhanced with mobile-specific protections including persistent upload state, auto-resume functionality, Wake Lock API for preventing screen timeouts, and comprehensive interruption handling.
- **Comprehensive Image Management**: Supports large batch photo uploads (up to 10GB total, 100MB per file), with automatic processing for face recognition, image compression (WebP conversion), and original quality downloads. Includes thumbnail selection and efficient gallery display with virtualization and pagination.
- **Online Booking System**: Enables clients to book photography packages, with detailed admin management functionalities.
- **Event Management**: Provides full CRUD operations for events, including dual PIN access (Public and Bride-Groom) and QR-based event access with expiration. Cascade deletion ensures associated photos are removed upon event deletion.
- **Enhanced QR Code Management**: Comprehensive QR code system with creation, editing, time extension, and no-limit options. Admins can extend expiration times, set unlimited expiration (10 years), remove usage limits, and update all QR settings post-creation.
- **User & Role Management**: Implements a robust role-based access control system (Owner, Admin, Moderator, QR Share) with granular permissions and user management features in the admin dashboard.
- **Performance Optimizations**: Includes in-memory caching for API responses, parallel data fetching, lazy loading, virtualized scrolling, image preloading, and optimized server payload limits. React Query is configured with intelligent retry logic and caching.
- **Photo Interaction**: Features a full-screen photo viewer with zoom, pan, like/unlike, and download options. Users can "Save to Profile" for favorite photos and perform bulk downloads as ZIP files.
- **Security**: All sensitive information is managed via environment variables. Email uniqueness is enforced at the application level.
- **UI/UX**: Employs a modern, clean design using Tailwind CSS and Radix UI, ensuring a consistent fullscreen viewer experience and responsive design across the platform. Image display is optimized for performance, serving compressed versions while retaining original quality for downloads.

## External Dependencies
- **Cloudinary**: Primary cloud storage for images, handling optimization and delivery.
- **MongoDB Atlas**: Cloud-hosted NoSQL database.
- **Firebase Authentication**: Provides secure user authentication, specifically for Google OAuth.
- **Python Flask (InsightFace)**: Dedicated microservice for AI-powered face recognition.
- **JSZip**: Used for client-side ZIP compression for bulk photo downloads.
- **Sharp**: Node.js image processing library for server-side image compression and optimization.