# Ndovera Quantitative Reasoning Worksheet Studio

Complete Flutter source for an original Primary 1–6 worksheet generator. Inspired by the general teaching format of guided quantitative reasoning books: examples followed by pupil exercises. No Lantern book text, artwork or proprietary questions are reproduced. No specific edition has been inspected, so this is not an exact reconstruction of those books.

## Run

Install a current stable Flutter SDK with Dart 3.5 or later. From this folder:

```sh
flutter create --platforms=android,ios,web .
flutter pub get
flutter analyze
flutter test
flutter run
```

The platform folders are created by Flutter, rather than supplied as generated boilerplate. Preserve the supplied lib/, test/, and pubspec.yaml files if your Flutter version asks about overwriting. On Android add INTERNET permission to android/app/src/main/AndroidManifest.xml before using the optional AI client. Follow the printing package platform setup for the target you deploy.

## Included

- Responsive teacher authoring screen and worksheet preview.
- Primary 1–6 class selection; available topics change with class.
- Assignment, practice and examination labels; configurable time and question count.
- Two or three solved guide examples in all modes, as requested.
- Real procedurally generated questions, independent seeds and no repeated visual questions in a worksheet.
- Counting illustrations, sequences, missing numbers, number machines, equivalent fractions and 3-by-3 grid puzzles.
- Vector shapes and puzzle cells displayed in Flutter and rendered directly into printable PDF.
- Separate student PDF and teacher solution PDF; each question is one mark.
- Deterministic answer generation and explanatory working.
- HTTPS AI client boundary for your existing backend; no embedded provider credentials.
- Engine tests for class restrictions, maximum worksheet size, reproducibility, counting and grid arithmetic.

## Class progression

| Class | Topics | Difficulty |
| --- | --- | --- |
| Primary 1 | Counting, patterns, missing numbers | Small numbers, addition, increasing sequences |
| Primary 2 | Above plus machines | Larger counting sets, addition machines |
| Primary 3 | Above plus grids | Multiplication, decreasing patterns, two-step machines |
| Primary 4–6 | Patterns, missing numbers, machines, fractions, grids | Increasing numeric ranges, equivalent fractions, multi-step reasoning |

This progression is a configurable product policy, not a claim of official curriculum alignment. Extend topicsForGrade and WorksheetEngine after reviewing your uploaded class curriculum. Current generation chooses one topic per sheet. SVG-like vector shapes are the supplied illustrations; arbitrary photographs and AI-created images are not included.

## Integrate into Ndovera

Copy engine.dart, visual.dart, export.dart, ai_client.dart and the studio widgets from main.dart into your project. Add the pubspec dependencies and route to WorksheetStudio from your teacher's classroom/materials tab. Retain your application's existing authentication and theme. The standalone executable is a teacher authoring utility; it does not implement accounts or school permissions.

```dart
Navigator.of(context).push(MaterialPageRoute(
  builder: (_) => const WorksheetStudio(),
));
```

Do not route students to WorksheetStudio: generation computes answers locally and teacher PDF controls are exposed there. Publish only the student PDF or a server-created pupil payload with question IDs, prompts and visual tokens. A teacher-only UI check is insufficient: enforce classroom membership and teacher roles on the server. Never send answers, explanations or completed examples for assessed questions in a pupil API response. Examples are separate questions and may be included.

## Ndovera AI backend contract (integration specification)

ai_client.dart is provided but intentionally not wired to the offline UI. The backend is not supplied because your existing Ndovera authentication, curriculum storage and AI gateway are not available in this workspace. Its request method returns an untrusted draft map; do not render or publish that map without schema validation and arithmetic validation on your server.

POST /api/worksheets/generate
Authorization: Bearer <existing user access token>
JSON: WorksheetSettings.toJson() plus curriculumId and classroomId.
Success: {"schemaVersion":1,"draftId":"server-generated-id","status":"teacher_review",...validated worksheet content...}

Required server behavior:
1. Verify the user, school tenancy, teacher permissions, classroom assignment and access to the curriculum. Resolve the actual class from classroomId; reject client grade mismatches.
2. Retrieve the uploaded curriculum by class and subject. Return a curriculum-not-found response when absent. Do not fabricate an alignment claim.
3. Generate original questions using the requested topic and 2–3 worked examples. Ask the AI for structured visual descriptions, never arbitrary executable SVG/HTML or external image URLs.
4. Validate count, class/topic eligibility, safe visual types and text lengths. Prefer the deterministic engine for arithmetic and verified answers. Reject inconsistent or ambiguous AI items.
5. Save the draft and require a teacher to review before publication. Store answer keys separately behind teacher permissions.
6. Deduct any AI charge atomically and idempotently server-side. Apply request limits and bounded response sizes. Use the provider-independent Ndovera AI gateway.
7. Publish an answer-free student version for the assigned classroom. For exams, enforce timing and submission rules server-side and reveal results only according to teacher policy.

Suggested AI instruction:
"Create ORIGINAL quantitative reasoning tasks for the verified classroom and retrieved curriculum. Use age-appropriate language and only the allowed visual primitives. Provide exactly the configured number of worked examples and exercise questions. Return structured JSON with separate examples and questions. Explain each solution and state integer answers. Do not copy published worksheets. Include the exact source curriculum record IDs for teacher review."

The app's mode and minutes are worksheet metadata, not a timed online examination system. There is no submission, auto-marking, cloud saving, teacher editing or backend payment implementation in this package. Those belong to the existing Ndovera integration.

## Verification status

Flutter and Dart are unavailable in the authoring environment. Compilation, flutter analyze, flutter test and visual/device testing have not been run. The included tests must be run with Flutter before merging. Package documentation consulted: https://pub.dev/packages/pdf and https://pub.dev/packages/printing.
