-- Exporting settings
INSERT INTO settings (studentId, payload) VALUES
('ndobalamwilliams@ndovera.com', '{"email":"ndobalamwilliams@ndovera.com","name":"Ndobalam Williams","role":"ami","accountType":"superadmin","passwordState":"provision-required"}'),
('ndobal.will@gmail.com', '{"email":"ndobal.will@gmail.com","name":"Ndobal Will","role":"ami","accountType":"superadmin","passwordState":"provision-required"}');

-- Exporting audit
-- Exporting books
INSERT INTO books (id, title, author, description, cover, metadata) VALUES
('book-ndovera-about', 'About Ndovera', 'ND Team', 'Intro to Ndovera platform', NULL, '{"pages":12}'),
('book-algebra-simplified', 'Algebra Simplified', 'J. Mathematician', 'Basic algebra for secondary students', NULL, '{"pages":180}'),
('book-waec-2010-23', 'WAEC Past Questions 2010-2023', 'Exam Prep', 'Compiled past questions and answers', NULL, '{"pages":320}');

-- Exporting borrowings
INSERT INTO borrowings (id, bookId, studentId, borrowedAt, dueAt, returnedAt, status, meta) VALUES
('borrow-1772571295851', 'book-algebra-simplified', 'demo-student', '2026-03-03T20:54:55.851Z', '2026-03-10T20:54:55.850Z', NULL, 'borrowed', '{"notes":"Demo borrow"}'),
('borrow-1772601347128', 'book-algebra-simplified', 'demo-student', '2026-03-04T05:15:47.128Z', '2026-03-11T05:15:47.127Z', NULL, 'borrowed', '{"notes":"Demo borrow"}');

-- Exporting classes
INSERT INTO classes (id, name, teacherId, meta) VALUES
('class-default', 'SS2 Gold', 'user-teacher-1', '{}');

-- Exporting class_members
INSERT INTO class_members (id, classId, studentId, role, joinedAt) VALUES
('cm-1772603628228-eolg', 'class-default', 'student-1', 'student', '2026-03-04T05:53:48.228Z'),
('cm-1772603628652-a34d', 'class-default', 'student-2', 'student', '2026-03-04T05:53:48.652Z'),
('cm-1772737316650-gyog', 'class-default', 'user-teacher-1', 'teacher', '2026-03-05T19:01:56.650Z'),
('cm-1772737316815-qmt9', 'class-default', 'user-student-1', 'student', '2026-03-05T19:01:56.815Z');

-- Exporting posts
INSERT INTO posts (id, classId, authorId, content, attachments, createdAt) VALUES
('post-1772603629040', 'class-default', 'teacher-dev', 'Welcome to the class!', '[]', '2026-03-04T05:53:49.040Z');

-- Exporting assignments
INSERT INTO assignments (id, classId, title, description, dueAt, createdAt) VALUES
('assign-1772603629273', 'class-default', 'Intro Assignment', 'Submit a short bio', NULL, '2026-03-04T05:53:49.273Z');

-- Exporting submissions
-- Exporting attendance_records
INSERT INTO attendance_records (id, classId, studentId, date, status, recordedBy, notes) VALUES
('att-1772603629884-v73g', 'class-default', 'student-1', '2026-03-04', 'present', 'teacher-dev', 'On time');

-- Exporting materials
INSERT INTO materials (id, classId, title, url, metadata, uploadedAt, uploadedBy) VALUES
('mat-1772603629588', 'class-default', 'Syllabus', 'https://example.org/syllabus.pdf', '{}', '2026-03-04T05:53:49.588Z', 'teacher-dev'),
('mat-1772604617561', 'class-default', 'Hello File', '/uploads/1772604617559_hello.txt', '{"size":11}', '2026-03-04T06:10:17.561Z', 'teacher-dev'),
('mat-1772623492856', 'class-default', 'tmp_upload2.txt', '/uploads/1772623492846_tmp_upload2.txt', '{"size":30,"mimetype":"text/plain"}', '2026-03-04T11:24:52.856Z', 'teacher-dev');

-- Exporting content_saves
