# Ndovera Verbal Reasoning Worksheet Studio

Flutter source for a Primary 1–6 teacher worksheet studio. Uses original authored vocabulary exercises and generated letter puzzles. It uses the general worked-example/exercise format; it does not reproduce Lantern pages or claim exact alignment to any edition.

## Run

Install stable Flutter with Dart 3.5 or later. In this folder:

```sh
flutter create --platforms=android,ios,web .
flutter pub get
flutter analyze
flutter test
flutter run
```

Preserve supplied lib/, test/ and pubspec.yaml files if platform generation prompts to overwrite them. Platform folders are generated with Flutter. Consult the pdf and printing package setup for your target platform. Add Android INTERNET permission if using the optional AI client.

## Files

- lib/main.dart: responsive teacher authoring screen and preview.
- lib/question_bank.dart: versioned 1,000-item class banks, canonical IDs, deterministic expansion.
- lib/history.dart: persisted device/classroom/class usage history.
- lib/engine.dart: validated settings, class/topic rules, reproducible generation, separate examples/questions.
- lib/word_bank.dart: 80 authored vocabulary items with distractors, answers and explanations.
- lib/visual.dart: accessible word and letter tiles.
- lib/export.dart: student PDF and teacher solution PDF.
- lib/ai_client.dart: authenticated HTTPS backend integration boundary.
- test/engine_test.dart: generation, vocabulary, alphabetical ordering, pattern rules, letter-code wrapping and seed tests.

## 1,000-item class banks and usage history

StandardQuestionBank.forGrade returns exactly 1,000 unique, cached items for each Primary 1–6 class. The banks share some foundational vocabulary and letter tasks across classes: 6,000 class entries are not 6,000 globally distinct questions. These are original exercises, not an externally certified examination bank.

| Class | Authored vocabulary | Alphabet patterns | Letter codes | Word ordering | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Primary 1–2, each | 40 | 110 | 0 | 850 | 1,000 |
| Primary 3 | 80 | 200 | 0 | 720 | 1,000 |
| Primary 4 | 80 | 200 | 48 | 672 | 1,000 |
| Primary 5–6, each | 80 | 270 | 144 | 506 | 1,000 |

Most new items are distinct alphabet/word-order/code puzzle instances built from verified rules, rather than new vocabulary facts. Different word sets constitute different ordering exercises; permutations of the same set do not. Vocabulary topics individually contain 20 items each, not 1,000 per topic. A 40-question single-topic vocabulary sheet therefore cannot be generated; select Mixed reasoning or a smaller size. The UI reports unused topic capacity, and generation throws BankExhausted before selecting anything if the remaining count cannot cover examples plus exercises.

Mixed sheets rotate through nonempty topic pools. Selection excludes all previously used IDs, reserves examples and questions together, then saves history before showing the sheet. Items remain used even if the teacher discards the preview. Revision reset is explicit and confirmed. This implementation assumes one active authoring screen per classroom on a device; concurrent screens, shared devices and multiple devices require transactional server history.

History uses shared_preferences and is device-local. Pass a stable school-qualified classroomId to WorksheetStudio; never use the default local-authoring value in a multi-school deployment. Reserve IDs in a server transaction for cross-device guarantees. The local metadata is not student performance data.

To export the complete banks as JSON for teacher-only backend ingestion:

```sh
dart run tool/export_bank.dart
```

Generated JSON includes answers. Keep it outside student assets and public endpoints.

## Features

Select Primary 1–6, assignment/practice/examination, duration, topic, 5–40 questions, and 2 or 3 worked examples. Generate another sheet with a new seed. Print/save a student worksheet or a separate teacher answer key. Each exercise carries one mark. Stable IDs and persisted classroom/class usage history prevent reusing both examples and exercises on this device until an explicit revision reset. Clearing app data also clears history. Examples are separate from assessed questions.

| Classes | Available topics | Progression |
| --- | --- | --- |
| Primary 1–2 | Alphabet patterns, alphabetical order, opposites, odd word out, mixed | Consecutive letters, short common words, explicit category clues |
| Primary 3 | Above plus synonyms and analogies | Letter steps of one or two; four-word ordering, including shared initial letters |
| Primary 4 | Above plus letter codes | Single-place encoding and alphabet wrapping |
| Primary 5–6 | All topics | Letter steps of up to three; encoding shifts of up to three |

Vocabulary items have class eligibility metadata; the shipped vocabulary bank deliberately includes foundational reinforcement through Primary 6. It is not six entirely separate book-length vocabulary banks. Class sensitivity also comes from topic gating, ordering word pools, pattern steps and code shifts. Before claiming official curriculum coverage, map and expand the bank against Ndovera's actual uploaded curriculum. Category clues make odd-one-out questions unambiguous. Analogies explicitly state the pair relationship in teacher explanations.

## Ndovera integration

Copy the source files into your Flutter application, add pubspec dependencies, and mount WorksheetStudio in your teacher materials/classroom route. Retain existing branding and authentication. The standalone application is a teacher authoring utility, not a full school account system.

```dart
Navigator.of(context).push(MaterialPageRoute(
  builder: (_) => const WorksheetStudio(classroomId: 'school-id/classroom-id'),
));
```

Do not expose this authoring screen to pupils. It contains locally computed answers and teacher PDF controls. Publish the student PDF, or store a server-created student payload containing only prompts, question IDs and visual tokens. Assessed question answers/explanations belong in teacher-only server storage. Worked examples can be included because they are distinct from assessed questions. Enforce role, school and classroom access on the server, not just in Flutter.

The purpose selector labels the worksheet; it does not implement live exam timing, secure submissions or online marking. The preview remains unchanged until Generate is clicked, even if settings have changed.

## Optional Ndovera AI contract

The offline generator needs no AI and makes no provider calls. ai_client.dart is an integration boundary, not a supplied backend or a UI-wired AI feature.

POST /api/worksheets/verbal/generate
Authorization: Bearer <existing user token>
Request: WorksheetSettings.toJson(), curriculumId, classroomId.
Success draft envelope: {"schemaVersion":1,"draftId":"server-generated-id","status":"teacher_review",...}

The client returns an untrusted draft map. Implement strict schema parsing and validation before rendering or publishing it. Required backend behavior:

1. Verify teacher identity, school tenancy, classroom permissions and curriculum access. Derive the actual class from classroomId and reject conflicting grade requests.
2. Retrieve the uploaded verbal reasoning/English curriculum for that class and subject. Return an explicit not-found response when unavailable; never fabricate alignment.
3. Request original structured tasks with exactly 2–3 worked examples and the requested exercise count. Allow safe visual primitives such as word tiles, letter sequences and teacher-approved stored illustrations.
4. Validate every answer: alphabet/cipher rules algorithmically; vocabulary, analogies and ambiguity through reviewed bank matches or teacher review. Reject multiple correct choices, duplicate choices, inappropriate vocabulary and unsupported visual instructions.
5. Atomically reserve canonical IDs in a school/classroom/class usage table; exclude used IDs during selection. Do not count shuffled choice order as new content. Fail explicitly on exhaustion or allow a teacher-selected revision policy. Save as a draft. Require teacher review before publication. Keep answers and explanations out of the student exercise payload.
6. Apply existing server-side fees, request limits and idempotent charging through the provider-independent Ndovera gateway.
7. For an online exam, implement server-authoritative timing, submission and result-release rules in the existing assessment module.

Suggested prompt:
"Generate ORIGINAL verbal reasoning exercises for the verified class using the retrieved curriculum records. Respect allowed topic, vocabulary level, question count and example count. Return structured JSON with separate examples and assessed questions, answer, explanation and safe word/letter visual tokens. Each assessed item must have exactly one defensible answer. Do not copy published books. Supply curriculum record IDs for teacher review."

Illustrations supplied here are word/letter tile diagrams, not object photographs or generated bitmap images. Picture-word matching, anagrams, comprehension passages, cloud saving, teacher editing and online student attempts are not included in this version. Expand the schema and reviewed content bank when adding those features.

## Verification

Flutter/Dart are unavailable in the authoring environment. Compilation, flutter analyze, flutter test and device/visual testing have not been run. The authored bank was checked for unique options and answer membership in the earlier version; class bank capacity formulas and ZIP integrity were checked with Python. Added tests cover 1,000 unique IDs per class, 20 consecutive generations without reuse, exhaustion, and persistent classroom history. These Flutter tests remain unexecuted. Run the supplied Flutter checks before integration.
