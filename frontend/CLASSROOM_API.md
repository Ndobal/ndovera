# Teacher Classroom API

This document defines the API endpoints for the teacher's classroom functionality.

## Base URL

`/api/classrooms`

## Authentication

All endpoints require a valid JWT token in the `Authorization` header.

## Endpoints

### Classroom

*   **GET /api/classrooms/:classroomId**
    *   **Description:** Get the details of a specific classroom.
    *   **Response:**
        ```json
        {
          "success": true,
          "class": {
            "id": "class-default",
            "name": "SS2 Gold",
            "teacher": "Mr. Adekunle"
          }
        }
        ```

### Stream

*   **GET /api/classrooms/:classroomId/stream**
    *   **Description:** Get all the stream posts for a classroom.
    *   **Response:**
        ```json
        {
          "success": true,
          "posts": [
            {
              "id": "post-1",
              "authorId": "user-teacher-1",
              "content": "Welcome to the new school year!",
              "createdAt": "2026-03-05T10:00:00Z"
            }
          ]
        }
        ```
*   **POST /api/classrooms/:classroomId/stream**
    *   **Description:** Create a new post in the stream.
    *   **Request Body:**
        ```json
        {
          "content": "This is a new post."
        }
        ```
    *   **Response:**
        ```json
        {
          "success": true,
          "post": {
            "id": "post-2",
            "authorId": "user-teacher-1",
            "content": "This is a new post.",
            "createdAt": "2026-03-05T11:00:00Z"
          }
        }
        ```

### Assignments

*   **GET /api/classrooms/:classroomId/assignments**
    *   **Description:** Get all assignments for a classroom.
    *   **Response:**
        ```json
        {
          "success": true,
          "assignments": [
            {
              "id": "asg-1",
              "title": "History of the World, Part I",
              "description": "Read the first chapter and write a summary.",
              "dueAt": "2026-03-12T23:59:59Z"
            }
          ]
        }
        ```
*   **POST /api/classrooms/:classroomId/assignments**
    *   **Description:** Create a new assignment.
    *   **Request Body:**
        ```json
        {
          "title": "New Assignment",
          "description": "This is the description.",
          "dueAt": "2026-03-15T23:59:59Z"
        }
        ```
    *   **Response:**
        ```json
        {
          "success": true,
          "assignment": {
            "id": "asg-2",
            "title": "New Assignment",
            "description": "This is the description.",
            "dueAt": "2026-03-15T23:59:59Z"
          }
        }
        ```

### Materials

*   **GET /api/classrooms/:classroomId/materials**
    *   **Description:** Get all materials for a classroom.
    *   **Response:**
        ```json
        {
          "success": true,
          "materials": [
            {
              "id": "mat-1",
              "title": "Syllabus",
              "url": "/uploads/syllabus.pdf",
              "uploadedAt": "2026-03-01T09:00:00Z",
              "uploadedBy": "user-teacher-1"
            }
          ]
        }
        ```
*   **POST /api/classrooms/:classroomId/materials**
    *   **Description:** Add a new material from a URL.
    *   **Request Body:**
        ```json
        {
          "title": "Google",
          "url": "https://www.google.com"
        }
        ```
    *   **Response:**
        ```json
        {
          "success": true,
          "material": {
            "id": "mat-2",
            "title": "Google",
            "url": "https://www.google.com",
            "uploadedAt": "2026-03-05T12:00:00Z",
            "uploadedBy": "user-teacher-1"
          }
        }
        ```
*   **POST /api/classrooms/:classroomId/materials/upload-multipart**
    *   **Description:** Upload a new material as a file. This will be a multipart/form-data request.
    *   **Request Body:** A form with `file` and `title` fields.
    *   **Response:**
        ```json
        {
          "success": true,
          "material": {
            "id": "mat-3",
            "title": "Uploaded File",
            "url": "/uploads/uploaded-file.pdf",
            "uploadedAt": "2026-03-05T13:00:00Z",
            "uploadedBy": "user-teacher-1"
          }
        }
        ```

### Attendance

*   **GET /api/classrooms/:classroomId/attendance**
    *   **Description:** Get attendance records for a classroom.
    *   **Response:**
        ```json
        {
          "success": true,
          "attendance": [
            {
              "id": "att-1",
              "studentId": "user-student-1",
              "date": "2026-03-05",
              "status": "present",
              "notes": ""
            }
          ]
        }
        ```
*   **POST /api/classrooms/:classroomId/attendance**
    *   **Description:** Record attendance for a student.
    *   **Request Body:**
        ```json
        {
          "studentId": "user-student-2",
          "date": "2026-03-05",
          "status": "absent"
        }
        ```
    *   **Response:**
        ```json
        {
          "success": true,
          "attendance": {
            "id": "att-2",
            "studentId": "user-student-2",
            "date": "2026-03-05",
            "status": "absent",
            "notes": ""
          }
        }
        ```
