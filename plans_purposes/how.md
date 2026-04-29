[completed] how is subdomain assigned?
[completed] let the school's domain be set automatically as name(as choosen by the school.ndovera.com)
[completed] let the recruitment url be automatically set from line 2 above
[completed] template selection is not choosing
[completed] What does this (Initial staff invites) mean?
resolved by removing it from the onboarding setup flow.
[completed] this (Public vacancies) should have its own side bar item in school owner and HOS so they can create public vacancies from there. it should not be part of the initial set up
[completed] what is Campus Result Pulse (No school results yet.)? if it is repeatation, remove it even thsis (Student results (No results have been added yet.))

[completed] Owner Dashboard
[completed] Identity card

[completed] Your card and roles
[completed] See your school, your roles, and switch when you need to. (should be compact and fits to screen so that its four corners can be seen without scrolling)

[completed] tHIS (Sign-in domain

ndovera-e2e-20260409071051.ndovera.com

Owner email: owner+20260409071051@example.teST) ARE OVERFLOWING THE CARD

[completed] tHIS (Launch Checklist

What the launch team still needs from you
Confirm your school profile, student size, and contact identity.
Choose the template and rollout support preferences for launch.
Complete setup to unlock the full owner dashboard and keep the onboarding timeline auditable.) SHOULD BE SISPLAYED AS A POP UP THAT CAN BE CLOSED BY THE USER. IT SHOULD FIT TO SCREEN

[completed] Let the texts here (Owner Dashboard

School results
This page shows your school results for Current term.

Head of School approval: Pending) be colour black also, if there is no result, it should show no results prepared yet. when results are prepares, pending review, published (owner clicks can see all results school wide)

[completed] Let the texts for the figures here (Global Average

0%

Global Pass Rate

0%

Students in Broadsheet

0

Exam Incidents

0) be bold black

[completed] overview and academics display the same content. Overview in tenant school owner should display school wide analytics for the HOS and Owner
[completed] School owner still cant create classrooms for the school. His tab should have a card tab of all the classes in the school arranged in sections (nursery section, Primary Section, Secondary section) with with class analytics very simple cards like 300px(width) by 200px(height) designed to adjust perscreen. where no class exist, create a classbutton
[completed] Finance should have its standalone page (here at a glance, he sees the total standing of the school in terms of fee collections, expenditures, etc). show expected fee, collected fee, expended, balance as analytics

[completed] fees should have its standalone page (here fees are managed on thcustom headings in a tabular format (Header contains school name, address, session, term, student name (choosen from the list of students in the school once a studens fee for the term is set, the name no longer appears in the list it appears in the tab where fee payments are tracked). the collums include: description  (items the student is paying for e.g tuition, Lesson, Welfare, toiletories,pta/ptf, club,etc ), amount (under it there is a very bold total sum of all the amounts), where a family has up to 3 children, in the parents portal show a discount of 5% on the tuition as total. Some parents may be given special discounts apply it as well. but let the HOS/OWNER or ASSIGNEE be able to aplly/remove discounts)) 
[completed] PAyroll should have its standalone page (here build according to my specifications in NDOVERA.txt)
[completed] expenses should have its standalone page (where all expenditure is tracked. can be edited by OWNER/HOS/ASSIGNEE)
[completed] receipts should have its standalone page (when a students' fee is marked as paid (remember that fees can be paid in installments), receipts are automatically issued to the parents so they can download and print)
[completed] reconciliation should have its standalone page (build this correctly using english that a 13 year old will understand)


[completed] This (Students 0 Staff 0 Parents 0) analytics figures should be black
[completed] Adding a student, class assignemnet should be a selection from the created classes. so before adding studnets, classes should be created first.
[completed] Add Users reproduced this error (Something went wrong. Please try again.) main.61786ba0.js:2  POST https://ndovera-api.ndovera.workers.dev/admin/auth/bulk-accounts 400 (Bad Request) that is on individual typing However, we agreed that system will automatically assign students email and the default password to login by using student nameand surname@schoolname.com
[completed] PREPARE A SAMPLE FILE WITH (Upload am  excel file with columns: Name, Surname, Email, Role

Example: John, Smith, john.smith@myschool.com, teacher) CSV/EXCELL SO THAT USERS JUST DOWNLOAD AND FILL IN THEIR DETAILS. DO THIS IN FEES AS WELL
[completed] the People side is adding users but no email to login so confirm if they can actually be added and they can log in with
[completed] build the Compliance & Risk fully using english that even a 14 year old can understand
[completed] Approvals (shows school results)
[completed] Reports
[completed] Website (School name, School motto should be prefilled as it has been provided earlier)
[completed] Championship (Championship workspace paused
Competition routing is mounted, but the live championship engine is not deployed yet.
This route previously rendered client-only competitions, leaderboards, and spelling rounds. Those mock flows were removed from the mounted app. The page now reports the real production state instead of showing fake school events.

Status

Locked to honest empty state

No live competitions, question pools, or leaderboards are exposed from the backend yet.

Current role

OWNER

Access remains protected, but no live championship actions are enabled for any role.

When it reopens

Live only

The route should come back only after competition creation, registration, questions, scoring, and leaderboard APIs are all school-scoped.) if no competitions at the moment, display no actitve competitions. let it be activated so that those who should create competitions can create. I noticed that once you click on the competition side bar, the other side bar item are missing only a few are displayed. work on it so that RBAC are effectively configured. THese (Championship
Videos
Website Templates) are not following the roles access
[completed] Videos
[completed] Website Templates
[completed] Settings: build the owner's dashboard settings so he can handle the settings personally and school wide

[completed] Library: build the libray completely
[completed] Library Admin: should not appaer in any role as that is a role on its own

remeber that apart from appointing a new HOS, the current HOS can do everything the school owner can do


[completed] AMI DASHBOARD: remove unessary wordings use a 14 year old english, reduce spaces and make contents small so that the content space contains and displays  more
[completed] Turn all these into Schools sub tabs so that each category has its own tab. for easy management
Loading AMI workspace…

School Management

Review and approve school registrations
Approve, reject, or return onboarding requests. Approved schools get an auto-assigned subdomain and owner access link.

Action queue
Approved schools
Submitted
Status
0

Note
Fresh registrations waiting for payment or review

Payment pending
Status
0

Note
Checkout started but not verified yet

Under review
Status
0

Note
Ready for AMI action now

Returned or rejected
Status
0

Note
Needs owner correction or fresh submission

Action Queue

Pending registrations
Approving a school creates the tenant record, assigns a subdomain, provisions the owner account, and sends a setup link.

Provisioned owners
Status
0

Note
Owner setup links already issued

Missing owner email
Status
0

Note
Cannot approve until owner identity is complete


[completed] in the login page, add: Register your school link so that people can register their schools from there. also reduce the colour overlay on the video sohat the video can be more seen. Dont forget i want the login page to be unscrollable so every content fits to screen

commit and to github and deploy


create 5 schools with real-like credentials having 200 staff and 500 students across schools. use these run a QA Test of the entire platform roles and features ensureing that everyone is connected and everyone can see what is menat for them. Note the errors and gaps in this page, fix them and deploy it
