# File-Sharing

## Overview
File-Sharing is a web application designed to simplify the process of sharing files such as photos, videos, and documents between devices. It provides a seamless and secure way to upload files and generate a unique link or QR code for easy access and download on other devices.

## Features
- **File Upload**: Users can upload files directly from their device.
- **Unique File Links**: Each uploaded file is assigned a unique link for sharing.
- **QR Code Generation**: A QR code is automatically generated for quick access to the file link.
- **Cross-Device Compatibility**: Share files between devices without the need for additional software or accounts.
- **Secure Storage**: Files are stored securely on the server with unique identifiers.

## How It Works
1. **File Upload**: 
   - Users select a file to upload using the web interface.
   - The file is sent to the server via an HTTP POST request.

2. **Backend Processing**:
   - The server assigns a unique identifier (`file_id`) to the file.
   - The file is saved in a secure directory on the server.
   - The file metadata (e.g., `file_id` and file path) is stored in a database.

3. **Link and QR Code Generation**:
   - The server responds with a unique link to access the file.
   - A QR code is generated on the frontend using the link, allowing users to scan and access the file easily.

4. **File Access**:
   - Users can access the file by visiting the unique link or scanning the QR code.
   - The server retrieves the file from storage and serves it to the user.

## Problem It Solves
Traditional file-sharing methods often require:
- Installing additional software or apps.
- Creating accounts or logging in.
- Using external storage devices like USB drives.

File-Sharing eliminates these barriers by providing:
- A lightweight, browser-based solution.
- Instant file sharing without the need for accounts or installations.
- A secure and user-friendly interface for sharing files across devices.

## Technology Stack
- **Frontend**: HTML, CSS, JavaScript (with QRCode.js for QR code generation).
- **Backend**: FastAPI (Python) for handling file uploads and downloads.
- **Database**: SQLite for storing file metadata.
- **Storage**: Local file system for uploaded files.

## How to Run the Project
1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd File-Sharing
   ```

2. **Install Dependencies**:
   - Install Python dependencies:
     ```bash
     pip install fastapi uvicorn sqlalchemy pydantic
     ```

3. **Run the Server**:
   ```bash
   python main.py
   ```

4. **Access the Application**:
   - Open your browser and navigate to `http://localhost:8000/`.
