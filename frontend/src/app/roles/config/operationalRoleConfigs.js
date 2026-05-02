const operationalRoleConfigs = {
  librarian: {
    roleTitle: 'Librarian Dashboard',
    watermark: 'LIBRARY',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage books, borrowing, returns, and reading activity.',
        cards: [
          { label: 'Books Borrowed', value: '146', accent: 'accent-indigo' },
          { label: 'Overdue', value: '11', accent: 'accent-amber' },
          { label: 'Returns Today', value: '23', accent: 'accent-emerald' },
          { label: 'New Requests', value: '9', accent: 'accent-rose' },
        ],
        panels: [
          {
            title: 'Today Tasks',
            items: [
              { text: 'Approve student borrowing queue.', tag: 'Queue', accent: 'accent-indigo' },
              { text: 'Send overdue reminders.', tag: 'Urgent', accent: 'accent-amber' },
              { text: 'Update new arrivals shelf.', tag: 'Update', accent: 'accent-emerald' },
            ],
          },
          {
            title: 'Library Rules',
            items: [
              { text: 'Only librarian can issue and clear fines.' },
              { text: 'Reading records are not editable after archive.' },
              { text: 'Lost book reports require approval.' },
            ],
          },
        ],
      },
      catalogue: { title: 'Book Catalogue', subtitle: 'Add, edit, and track all library items.', panels: [{ title: 'Catalogue', items: [{ text: 'Search by title, subject, class, and author.' }, { text: 'Set copies available and shelf location.' }, { text: 'Mark damaged, lost, or archived books.' }] }] },
      borrowing: { title: 'Borrowing', subtitle: 'Issue books to students and staff safely.', panels: [{ title: 'Borrowing Flow', items: [{ text: 'Verify borrower role and limit.' }, { text: 'Set due date and reminder window.' }, { text: 'Issue digital receipt.' }] }] },
      returns: { title: 'Returns', subtitle: 'Receive returns and process fines.', panels: [{ title: 'Returns', items: [{ text: 'Check condition of returned books.' }, { text: 'Apply late fine policy if overdue.' }, { text: 'Close borrowing ticket.' }] }] },
      'digital-library': { title: 'Digital Library', subtitle: 'Manage e-books and learning media access.', panels: [{ title: 'Digital Access', items: [{ text: 'Upload approved digital books.' }, { text: 'Control role access by class/subject.' }, { text: 'Track views and downloads.' }] }] },
      reports: { title: 'Reports', subtitle: 'View borrowing trends and reading activity.', panels: [{ title: 'Library Reports', items: [{ text: 'Weekly borrowing summary.' }, { text: 'Top-read books by class.' }, { text: 'Overdue and fine status report.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage profile and security.', panels: [{ title: 'Security', items: [{ text: 'Change password and enable 2FA.' }, { text: 'View active login sessions.' }, { text: 'Set alert preferences.' }] }] },
    },
  },

  sanitation: {
    roleTitle: 'Sanitation Officer Dashboard',
    watermark: 'SANITATION',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Track hygiene checks and cleaning operations.',
        cards: [
          { label: 'Zones Checked', value: '18', accent: 'accent-indigo' },
          { label: 'Open Issues', value: '6', accent: 'accent-amber' },
          { label: 'Resolved', value: '13', accent: 'accent-emerald' },
          { label: 'Escalated', value: '2', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Priority', items: [{ text: 'Inspect restrooms before break time.', tag: 'Now', accent: 'accent-rose' }, { text: 'Refill soap and cleaning supplies.', tag: 'Supply', accent: 'accent-amber' }, { text: 'Close hygiene checklist for morning.', tag: 'Checklist', accent: 'accent-indigo' }] },
          { title: 'Compliance', items: [{ text: 'Log every sanitation check with time.' }, { text: 'Submit weekly hygiene report.' }, { text: 'Escalate blocked drainage immediately.' }] },
        ],
      },
      inspections: { title: 'Inspections', subtitle: 'Record hygiene inspection by zone.', panels: [{ title: 'Inspection Log', items: [{ text: 'Classrooms, toilets, cafeteria, and hostels.' }, { text: 'Add photos for issue proof.' }, { text: 'Mark issue severity and timeline.' }] }] },
      schedule: { title: 'Cleaning Schedule', subtitle: 'Plan and monitor cleaning shifts.', panels: [{ title: 'Schedule', items: [{ text: 'Assign tasks by location and team.' }, { text: 'Track completed and pending shifts.' }, { text: 'Reassign urgent work quickly.' }] }] },
      incidents: { title: 'Incidents', subtitle: 'Handle urgent sanitation incidents.', panels: [{ title: 'Incident Desk', items: [{ text: 'Raise incident ticket with location.' }, { text: 'Set urgency and response target.' }, { text: 'Close with final verification.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate sanitation compliance reports.', panels: [{ title: 'Reports', items: [{ text: 'Daily and weekly hygiene status.' }, { text: 'Issue frequency by zone.' }, { text: 'Resolution time trends.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage security and alerts.', panels: [{ title: 'Security', items: [{ text: 'Change login details.' }, { text: 'Manage notification channels.' }, { text: 'Review account sessions.' }] }] },
    },
  },

  tuckshopmanager: {
    roleTitle: 'Tuck Shop Manager Dashboard',
    watermark: 'TUCK SHOP',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage sales, stock, and student purchase history.',
        cards: [
          { label: 'Sales Today', value: '₦82,400', accent: 'accent-emerald' },
          { label: 'Orders', value: '137', accent: 'accent-indigo' },
          { label: 'Low Stock', value: '8', accent: 'accent-amber' },
          { label: 'Refund Requests', value: '3', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Today Focus', items: [{ text: 'Confirm top-up wallet settlements.', tag: 'Finance', accent: 'accent-emerald' }, { text: 'Restock most purchased items.', tag: 'Stock', accent: 'accent-amber' }, { text: 'Review refund queue.', tag: 'Queue', accent: 'accent-rose' }] },
          { title: 'Controls', items: [{ text: 'All sales are linked to student records.' }, { text: 'No manual deletion of settled sales.' }, { text: 'Price changes require manager access.' }] },
        ],
      },
      orders: { title: 'Orders', subtitle: 'Track and process all tuck shop orders.', panels: [{ title: 'Order Workflow', items: [{ text: 'View pending and completed orders.' }, { text: 'Mark prepared and delivered status.' }, { text: 'Handle failed orders safely.' }] }] },
      inventory: { title: 'Inventory', subtitle: 'Manage available tuck shop items.', panels: [{ title: 'Stock Control', items: [{ text: 'Add new item with price and quantity.' }, { text: 'Set low-stock alerts.' }, { text: 'Archive unavailable items.' }] }] },
      pricing: { title: 'Pricing', subtitle: 'Maintain item prices and offers.', panels: [{ title: 'Pricing Rules', items: [{ text: 'Update price by item category.' }, { text: 'Set discount windows.' }, { text: 'Keep price history logs.' }] }] },
      sales: { title: 'Sales History', subtitle: 'Review sales by date and student.', panels: [{ title: 'Sales Log', items: [{ text: 'Search by student, class, or date.' }, { text: 'See order amount and item list.' }, { text: 'Export sales report.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate tuck shop finance and stock reports.', panels: [{ title: 'Reports', items: [{ text: 'Daily sales summary.' }, { text: 'Most purchased items.' }, { text: 'Stock movement report.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage account security.', panels: [{ title: 'Security', items: [{ text: 'Enable secure sign-in.' }, { text: 'Review session history.' }, { text: 'Set alert preferences.' }] }] },
    },
  },

  storekeeper: {
    roleTitle: 'Store Keeper Dashboard',
    watermark: 'STORE',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Control stock receiving, issuing, and movement.',
        cards: [
          { label: 'Stock Items', value: '412', accent: 'accent-indigo' },
          { label: 'Low Stock', value: '21', accent: 'accent-amber' },
          { label: 'Issued Today', value: '34', accent: 'accent-emerald' },
          { label: 'Pending Requests', value: '12', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Immediate Actions', items: [{ text: 'Receive pending supplier delivery.', tag: 'Receiving', accent: 'accent-indigo' }, { text: 'Approve urgent requisition.', tag: 'Urgent', accent: 'accent-rose' }, { text: 'Update low stock reorder list.', tag: 'Reorder', accent: 'accent-amber' }] },
          { title: 'Store Rules', items: [{ text: 'All stock issue entries are logged.' }, { text: 'Damaged stock must be documented.' }, { text: 'Monthly physical audit is required.' }] },
        ],
      },
      receiving: { title: 'Receiving', subtitle: 'Log incoming stock from suppliers.', panels: [{ title: 'Receiving Flow', items: [{ text: 'Verify quantity against invoice.' }, { text: 'Record batch and expiry where needed.' }, { text: 'Approve stock into main store.' }] }] },
      requisitions: { title: 'Requisitions', subtitle: 'Process stock requests from units.', panels: [{ title: 'Request Queue', items: [{ text: 'Review request by department.' }, { text: 'Approve and issue requested quantities.' }, { text: 'Reject with reason if unavailable.' }] }] },
      inventory: { title: 'Inventory', subtitle: 'View and update stock levels.', panels: [{ title: 'Inventory', items: [{ text: 'Track current balance by item.' }, { text: 'Set reorder level.' }, { text: 'Flag expired or damaged stock.' }] }] },
      audits: { title: 'Audits', subtitle: 'Run periodic store audits.', panels: [{ title: 'Audit Checks', items: [{ text: 'Compare physical count with system.' }, { text: 'Log variance with notes.' }, { text: 'Publish audit report.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate stock and movement reports.', panels: [{ title: 'Reports', items: [{ text: 'Stock valuation report.' }, { text: 'Issue and receiving trends.' }, { text: 'Low stock alerts by period.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage profile and access.', panels: [{ title: 'Security', items: [{ text: 'Update password.' }, { text: 'Review active sessions.' }, { text: 'Configure alerts.' }] }] },
    },
  },

  transport: {
    roleTitle: 'Transport Officer Dashboard',
    watermark: 'TRANSPORT',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage routes, buses, and student transport records.',
        cards: [
          { label: 'Active Routes', value: '14', accent: 'accent-indigo' },
          { label: 'Students Assigned', value: '526', accent: 'accent-emerald' },
          { label: 'Delays', value: '3', accent: 'accent-amber' },
          { label: 'Incidents', value: '1', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Route Watch', items: [{ text: 'Check morning route departures.', tag: 'Morning', accent: 'accent-indigo' }, { text: 'Resolve delayed route alerts.', tag: 'Delay', accent: 'accent-amber' }, { text: 'Log bus maintenance issue.', tag: 'Safety', accent: 'accent-rose' }] },
          { title: 'Safety Rules', items: [{ text: 'Attendance must be marked at pick-up.' }, { text: 'Driver and bus assignment is mandatory.' }, { text: 'Every incident must be logged.' }] },
        ],
      },
      routes: { title: 'Routes', subtitle: 'Create and manage transport routes.', panels: [{ title: 'Route Setup', items: [{ text: 'Define stops and pick-up times.' }, { text: 'Assign bus and driver.' }, { text: 'Set route status active/inactive.' }] }] },
      attendance: { title: 'Transport Attendance', subtitle: 'Track student bus attendance daily.', panels: [{ title: 'Attendance', items: [{ text: 'Mark boarded and dropped records.' }, { text: 'Track absences by route.' }, { text: 'Share updates with parents.' }] }] },
      fleet: { title: 'Fleet Management', subtitle: 'Manage buses and maintenance logs.', panels: [{ title: 'Fleet', items: [{ text: 'Record maintenance schedules.' }, { text: 'Track fuel and service history.' }, { text: 'Flag unavailable vehicles.' }] }] },
      incidents: { title: 'Incidents', subtitle: 'Handle transport safety incidents.', panels: [{ title: 'Incident Desk', items: [{ text: 'Open incident ticket quickly.' }, { text: 'Add witness and time details.' }, { text: 'Close after review.' }] }] },
      reports: { title: 'Reports', subtitle: 'View transport performance reports.', panels: [{ title: 'Reports', items: [{ text: 'Route timeliness report.' }, { text: 'Attendance by route.' }, { text: 'Fleet health summary.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage security and communication alerts.', panels: [{ title: 'Security', items: [{ text: 'Set account protection.' }, { text: 'Review access logs.' }, { text: 'Manage message preferences.' }] }] },
    },
  },

  hostel: {
    roleTitle: 'Hostel Officer Dashboard',
    watermark: 'HOSTEL',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage hostel rooms, occupancy, and welfare.',
        cards: [
          { label: 'Occupied Rooms', value: '86', accent: 'accent-indigo' },
          { label: 'Vacant Beds', value: '14', accent: 'accent-emerald' },
          { label: 'Open Requests', value: '9', accent: 'accent-amber' },
          { label: 'Discipline Cases', value: '2', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Hostel Priorities', items: [{ text: 'Confirm lights-out attendance.', tag: 'Night', accent: 'accent-indigo' }, { text: 'Handle room maintenance requests.', tag: 'Maintenance', accent: 'accent-amber' }, { text: 'Review welfare incident log.', tag: 'Welfare', accent: 'accent-rose' }] },
          { title: 'Hostel Policy', items: [{ text: 'Every bed assignment must be tracked.' }, { text: 'Room change requires approval.' }, { text: 'Incident follow-up must be documented.' }] },
        ],
      },
      rooms: { title: 'Rooms & Beds', subtitle: 'Assign and manage hostel rooms.', panels: [{ title: 'Room Management', items: [{ text: 'Assign students to rooms and beds.' }, { text: 'Track room capacity and vacancies.' }, { text: 'Log room condition status.' }] }] },
      attendance: { title: 'Hostel Attendance', subtitle: 'Track boarding attendance and checks.', panels: [{ title: 'Attendance', items: [{ text: 'Mark morning and night attendance.' }, { text: 'Flag missing students immediately.' }, { text: 'Share alerts with HoS/Parents.' }] }] },
      welfare: { title: 'Welfare', subtitle: 'Manage student welfare and support requests.', panels: [{ title: 'Welfare Desk', items: [{ text: 'Log welfare requests by student.' }, { text: 'Assign support staff.' }, { text: 'Monitor closure status.' }] }] },
      incidents: { title: 'Incidents', subtitle: 'Track discipline and emergency incidents.', panels: [{ title: 'Incident Records', items: [{ text: 'Capture incident details and actions.' }, { text: 'Escalate major incidents.' }, { text: 'Archive resolved cases.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate hostel occupancy and welfare reports.', panels: [{ title: 'Reports', items: [{ text: 'Occupancy status by hostel block.' }, { text: 'Welfare and incident trends.' }, { text: 'Attendance compliance report.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage access and security settings.', panels: [{ title: 'Security', items: [{ text: 'Enable secure login.' }, { text: 'Review sessions.' }, { text: 'Set alert channels.' }] }] },
    },
  },

  cafeteria: {
    roleTitle: 'Cafeteria Manager Dashboard',
    watermark: 'CAFETERIA',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage meals, stock, and feeding schedules.',
        cards: [
          { label: 'Meals Served', value: '1,024', accent: 'accent-emerald' },
          { label: 'Menu Items', value: '32', accent: 'accent-indigo' },
          { label: 'Low Ingredients', value: '7', accent: 'accent-amber' },
          { label: 'Complaints', value: '2', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Today Menu', items: [{ text: 'Confirm breakfast and lunch supply.', tag: 'Supply', accent: 'accent-amber' }, { text: 'Check allergy-safe menu line.', tag: 'Health', accent: 'accent-rose' }, { text: 'Close meal service logs.', tag: 'Log', accent: 'accent-indigo' }] },
          { title: 'Feeding Rules', items: [{ text: 'Menu changes require approval.' }, { text: 'Allergen labels must be visible.' }, { text: 'Meal count must match service logs.' }] },
        ],
      },
      menu: { title: 'Menu Management', subtitle: 'Create and manage meal menus.', panels: [{ title: 'Menu', items: [{ text: 'Set daily and weekly menus.' }, { text: 'Tag allergy-sensitive items.' }, { text: 'Publish menu to students/parents.' }] }] },
      service: { title: 'Meal Service', subtitle: 'Track meal service by session.', panels: [{ title: 'Service', items: [{ text: 'Record meals served by class level.' }, { text: 'Capture missed meal reasons.' }, { text: 'Monitor peak service hours.' }] }] },
      inventory: { title: 'Kitchen Inventory', subtitle: 'Manage ingredients and kitchen stock.', panels: [{ title: 'Inventory', items: [{ text: 'Receive and issue ingredients.' }, { text: 'Track expiry dates.' }, { text: 'Set low-stock reorder alerts.' }] }] },
      hygiene: { title: 'Hygiene Checks', subtitle: 'Track kitchen hygiene and safety checks.', panels: [{ title: 'Hygiene', items: [{ text: 'Daily kitchen cleanliness checklist.' }, { text: 'Record temperature controls.' }, { text: 'Escalate hygiene incidents.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate cafeteria operations reports.', panels: [{ title: 'Reports', items: [{ text: 'Meals served and menu usage.' }, { text: 'Ingredient consumption trends.' }, { text: 'Service and complaint summary.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage account security and alerts.', panels: [{ title: 'Security', items: [{ text: 'Update login credentials.' }, { text: 'Review access sessions.' }, { text: 'Set operational alerts.' }] }] },
    },
  },

  clinic: {
    roleTitle: 'Clinic Officer Dashboard',
    watermark: 'CLINIC',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage student health records and clinic visits.',
        cards: [
          { label: 'Visits Today', value: '28', accent: 'accent-indigo' },
          { label: 'Medications Issued', value: '15', accent: 'accent-emerald' },
          { label: 'Open Cases', value: '6', accent: 'accent-amber' },
          { label: 'Emergencies', value: '1', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Health Priorities', items: [{ text: 'Review students on follow-up list.', tag: 'Follow-up', accent: 'accent-amber' }, { text: 'Check emergency response readiness.', tag: 'Emergency', accent: 'accent-rose' }, { text: 'Update treatment notes for discharged visits.', tag: 'Records', accent: 'accent-indigo' }] },
          { title: 'Clinic Controls', items: [{ text: 'Health records are restricted by role.' }, { text: 'Medication issuance is logged.' }, { text: 'Critical cases auto-escalate.' }] },
        ],
      },
      patients: { title: 'Patient Records', subtitle: 'View and update student clinic records.', panels: [{ title: 'Patient Desk', items: [{ text: 'Search patient by name/class.' }, { text: 'View allergy and history records.' }, { text: 'Update visit summaries.' }] }] },
      visits: { title: 'Clinic Visits', subtitle: 'Track all clinic visits and outcomes.', panels: [{ title: 'Visit Log', items: [{ text: 'Capture symptoms and diagnosis.' }, { text: 'Record treatment and medication.' }, { text: 'Set follow-up date.' }] }] },
      medication: { title: 'Medication', subtitle: 'Manage clinic medicine inventory and dispensing.', panels: [{ title: 'Medication Flow', items: [{ text: 'Track available medicines.' }, { text: 'Issue medication with approval.' }, { text: 'Monitor low stock and expiry.' }] }] },
      emergencies: { title: 'Emergencies', subtitle: 'Handle urgent medical cases.', panels: [{ title: 'Emergency Desk', items: [{ text: 'Raise emergency alert.' }, { text: 'Contact guardian and leadership.' }, { text: 'Log incident and closure.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate clinic and health trend reports.', panels: [{ title: 'Health Reports', items: [{ text: 'Visit trends by class and term.' }, { text: 'Common symptoms report.' }, { text: 'Medication usage summary.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage secure access to health records.', panels: [{ title: 'Security', items: [{ text: 'Enable strong access control.' }, { text: 'Review session history.' }, { text: 'Set critical alert channels.' }] }] },
    },
  },

  ict: {
    roleTitle: 'ICT Officer Dashboard',
    watermark: 'ICT',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage systems, support tickets, and platform health.',
        cards: [
          { label: 'Open Tickets', value: '19', accent: 'accent-amber' },
          { label: 'Resolved Today', value: '31', accent: 'accent-emerald' },
          { label: 'System Uptime', value: '99.92%', accent: 'accent-indigo' },
          { label: 'Critical Alerts', value: '1', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Ops Focus', items: [{ text: 'Resolve login and access tickets first.', tag: 'Priority', accent: 'accent-amber' }, { text: 'Check live class service status.', tag: 'Live', accent: 'accent-indigo' }, { text: 'Review security alert queue.', tag: 'Critical', accent: 'accent-rose' }] },
          { title: 'ICT Policy', items: [{ text: 'All support actions are audit-logged.' }, { text: 'Role access changes need approval.' }, { text: 'Downtime incidents require reports.' }] },
        ],
      },
      support: { title: 'Support Tickets', subtitle: 'Manage user support requests.', panels: [{ title: 'Ticket Desk', items: [{ text: 'Filter tickets by severity and role.' }, { text: 'Assign engineer and due date.' }, { text: 'Close with resolution notes.' }] }] },
      systems: { title: 'System Health', subtitle: 'Monitor platform services and uptime.', panels: [{ title: 'Health Monitor', items: [{ text: 'Track API and app latency.' }, { text: 'Check service uptime by module.' }, { text: 'Escalate unhealthy services.' }] }] },
      access: { title: 'Access Control', subtitle: 'Manage role access and account issues.', panels: [{ title: 'Access', items: [{ text: 'Reset account access securely.' }, { text: 'Review role permissions.' }, { text: 'Audit suspicious sign-in events.' }] }] },
      assets: { title: 'ICT Assets', subtitle: 'Track devices and technical assets.', panels: [{ title: 'Assets', items: [{ text: 'Register and assign devices.' }, { text: 'Track maintenance history.' }, { text: 'Flag missing or damaged assets.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate ICT operations and incident reports.', panels: [{ title: 'Reports', items: [{ text: 'Ticket resolution metrics.' }, { text: 'System downtime summary.' }, { text: 'Security event report.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage profile and security settings.', panels: [{ title: 'Security', items: [{ text: 'Enable 2FA and strong password.' }, { text: 'Review active sessions.' }, { text: 'Set alert preferences.' }] }] },
    },
  },

  classteacher: {
    roleTitle: 'Class Teacher Dashboard',
    watermark: 'CLASS TEACHER',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage one class fully: attendance, behavior, and parent contact.',
        cards: [
          { label: 'Class Size', value: '41', accent: 'accent-indigo' },
          { label: 'Attendance Today', value: '95%', accent: 'accent-emerald' },
          { label: 'Open Issues', value: '5', accent: 'accent-amber' },
          { label: 'Parent Messages', value: '7', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Class Priorities', items: [{ text: 'Mark attendance before first period.', tag: 'Now', accent: 'accent-indigo' }, { text: 'Review behavior report queue.', tag: 'Urgent', accent: 'accent-amber' }, { text: 'Reply parents in class channel.', tag: 'Message', accent: 'accent-rose' }] },
          { title: 'Class Rules', items: [{ text: 'Only your class data is editable here.' }, { text: 'Escalate major incidents to HoS.' }, { text: 'Result approval remains with HoS.' }] },
        ],
      },
      attendance: { title: 'Attendance', subtitle: 'Track daily attendance for your class.', panels: [{ title: 'Attendance Tasks', items: [{ text: 'Mark present, late, absent records.' }, { text: 'Add absence reason notes.' }, { text: 'Send absentee summary to parents.' }] }] },
      behavior: { title: 'Behavior & Welfare', subtitle: 'Track behavior and welfare concerns.', panels: [{ title: 'Behavior Log', items: [{ text: 'Record incidents and actions taken.' }, { text: 'Reward positive behavior badges.' }, { text: 'Escalate critical cases.' }] }] },
      assignments: { title: 'Assignments Tracking', subtitle: 'Monitor assignment completion by your class.', panels: [{ title: 'Assignment View', items: [{ text: 'See students with missing submissions.' }, { text: 'Track reviewed and pending marks.' }, { text: 'Send reminder notices.' }] }] },
      messaging: { title: 'Messaging', subtitle: 'Communicate with parents and students safely.', panels: [{ title: 'Messages', items: [{ text: 'Send class notices quickly.' }, { text: 'Use templates for common updates.' }, { text: 'All messages are logged.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate class-level weekly and term reports.', panels: [{ title: 'Reports', items: [{ text: 'Attendance and behavior summary.' }, { text: 'Assignment completion report.' }, { text: 'Parent communication report.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage profile and account security.', panels: [{ title: 'Security', items: [{ text: 'Update password.' }, { text: 'Review active sessions.' }, { text: 'Manage alerts and reminders.' }] }] },
    },
  },

  hod: {
    roleTitle: 'HOD Dashboard',
    watermark: 'HOD',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Oversee one academic department end-to-end.',
        cards: [
          { label: 'Teachers', value: '12', accent: 'accent-indigo' },
          { label: 'Pending Reviews', value: '9', accent: 'accent-amber' },
          { label: 'Pass Rate', value: '84%', accent: 'accent-emerald' },
          { label: 'Escalations', value: '2', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Department Focus', items: [{ text: 'Review lesson plan submissions.', tag: 'Review', accent: 'accent-indigo' }, { text: 'Check weak-topic analytics.', tag: 'Insight', accent: 'accent-amber' }, { text: 'Escalate unresolved issues to HoS.', tag: 'Escalate', accent: 'accent-rose' }] },
          { title: 'HOD Rules', items: [{ text: 'Oversees department teachers only.' }, { text: 'Cannot sign final results.' }, { text: 'All approvals are logged.' }] },
        ],
      },
      lessons: { title: 'Lesson Plan Review', subtitle: 'Review and approve lesson plans for your department.', panels: [{ title: 'Lesson Plan Checks', items: [{ text: 'Approve or return with comments.' }, { text: 'Track overdue submissions.' }, { text: 'Publish approved plans.' }] }] },
      assessments: { title: 'Assessments Oversight', subtitle: 'Monitor CA, assignments, and exam quality.', panels: [{ title: 'Assessment Oversight', items: [{ text: 'Review question quality and coverage.' }, { text: 'Check marking completion status.' }, { text: 'Flag anomalies for HoS review.' }] }] },
      teachers: { title: 'Teacher Performance', subtitle: 'Track teacher output and support needs.', panels: [{ title: 'Performance View', items: [{ text: 'See completion and engagement metrics.' }, { text: 'Detect low-performing subjects.' }, { text: 'Recommend coaching actions.' }] }] },
      analytics: { title: 'Department Analytics', subtitle: 'View subject trends and risk signals.', panels: [{ title: 'Analytics', items: [{ text: 'Pass/fail trend by class level.' }, { text: 'Weak area breakdown by topic.' }, { text: 'At-risk class alerts.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate departmental reports for leadership.', panels: [{ title: 'Reports', items: [{ text: 'Weekly department status report.' }, { text: 'Teacher performance summary.' }, { text: 'Assessment quality report.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage profile and security.', panels: [{ title: 'Security', items: [{ text: 'Update credentials.' }, { text: 'Review sessions.' }, { text: 'Set message alerts.' }] }] },
    },
  },

  hodassistant: {
    roleTitle: 'HOD Assistant Dashboard',
    watermark: 'HOD ASSIST',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Support HOD workflow and department coordination.',
        cards: [
          { label: 'Tasks Assigned', value: '14', accent: 'accent-indigo' },
          { label: 'Completed', value: '10', accent: 'accent-emerald' },
          { label: 'Pending', value: '4', accent: 'accent-amber' },
          { label: 'Escalations', value: '1', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Assistant Tasks', items: [{ text: 'Follow up lesson plan submissions.', tag: 'Follow-up', accent: 'accent-indigo' }, { text: 'Prepare department reports draft.', tag: 'Report', accent: 'accent-amber' }, { text: 'Log unresolved issues for HOD.', tag: 'Escalate', accent: 'accent-rose' }] },
          { title: 'Permissions', items: [{ text: 'Can assist and review drafts only.' }, { text: 'Cannot issue final approvals.' }, { text: 'Cannot alter locked records.' }] },
        ],
      },
      coordination: { title: 'Coordination', subtitle: 'Coordinate teacher submissions and reviews.', panels: [{ title: 'Coordination Desk', items: [{ text: 'Track due dates for department tasks.' }, { text: 'Send reminders to teachers.' }, { text: 'Maintain review queue order.' }] }] },
      quality: { title: 'Quality Checks', subtitle: 'Run first-level checks before HOD approval.', panels: [{ title: 'Quality Checks', items: [{ text: 'Check document completeness.' }, { text: 'Highlight missing sections.' }, { text: 'Attach review notes.' }] }] },
      communication: { title: 'Communication', subtitle: 'Share updates across department members.', panels: [{ title: 'Communication', items: [{ text: 'Send approved templates and updates.' }, { text: 'Track message acknowledgement.' }, { text: 'Escalate delayed responses.' }] }] },
      reports: { title: 'Reports', subtitle: 'Prepare support reports for HOD.', panels: [{ title: 'Reports', items: [{ text: 'Pending review summary.' }, { text: 'Teacher submission status.' }, { text: 'Quality issue tracker.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage account security and alerts.', panels: [{ title: 'Security', items: [{ text: 'Update password.' }, { text: 'Review session log.' }, { text: 'Set reminder notifications.' }] }] },
    },
  },

  principal: {
    roleTitle: 'Principal Dashboard',
    watermark: 'PRINCIPAL',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Lead academics and discipline across the school.',
        cards: [
          { label: 'School Health', value: 'Good', accent: 'accent-emerald' },
          { label: 'Pending Approvals', value: '12', accent: 'accent-amber' },
          { label: 'Staff Alerts', value: '3', accent: 'accent-rose' },
          { label: 'Student Alerts', value: '6', accent: 'accent-indigo' },
        ],
        panels: [
          { title: 'Leadership Priority', items: [{ text: 'Review discipline and welfare flags.', tag: 'Discipline', accent: 'accent-rose' }, { text: 'Approve key academic recommendations.', tag: 'Academic', accent: 'accent-indigo' }, { text: 'Prepare term leadership report.', tag: 'Report', accent: 'accent-amber' }] },
          { title: 'Leadership Scope', items: [{ text: 'Focus on academics and discipline.' }, { text: 'Finance controls remain with finance roles.' }, { text: 'All high-level actions are audited.' }] },
        ],
      },
      academics: { title: 'Academic Oversight', subtitle: 'Track school learning quality and outcomes.', panels: [{ title: 'Academic Oversight', items: [{ text: 'Review class and section trends.' }, { text: 'Approve interventions for weak classes.' }, { text: 'Monitor curriculum coverage.' }] }] },
      discipline: { title: 'Discipline', subtitle: 'Manage discipline cases and resolutions.', panels: [{ title: 'Discipline Desk', items: [{ text: 'Track major discipline cases.' }, { text: 'Review sanctions and outcomes.' }, { text: 'Monitor repeat incidents.' }] }] },
      staff: { title: 'Staff Management', subtitle: 'Oversee staff deployment and performance.', panels: [{ title: 'Staff View', items: [{ text: 'Review staff punctuality and output.' }, { text: 'Approve key role recommendations.' }, { text: 'Escalate critical staff concerns.' }] }] },
      messaging: { title: 'Messaging', subtitle: 'Send principal announcements and updates.', panels: [{ title: 'Principal Messages', items: [{ text: 'Broadcast to staff, parents, and students.' }, { text: 'Use templates for formal notices.' }, { text: 'Keep communication logged.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate leadership and compliance reports.', panels: [{ title: 'Reports', items: [{ text: 'Term performance report.' }, { text: 'Discipline and welfare summary.' }, { text: 'Staff performance update.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage profile and access security.', panels: [{ title: 'Security', items: [{ text: 'Change password and enable 2FA.' }, { text: 'Review active sessions.' }, { text: 'Manage alert preferences.' }] }] },
    },
  },

  headteacher: {
    roleTitle: 'Head Teacher Dashboard',
    watermark: 'HEAD TEACHER',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage primary section operations and quality.',
        cards: [
          { label: 'Primary Classes', value: '18', accent: 'accent-indigo' },
          { label: 'Teacher Reviews', value: '8', accent: 'accent-amber' },
          { label: 'Attendance', value: '96%', accent: 'accent-emerald' },
          { label: 'Open Issues', value: '4', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Primary Focus', items: [{ text: 'Check attendance and welfare alerts.', tag: 'Welfare', accent: 'accent-rose' }, { text: 'Review primary lesson plans.', tag: 'Lesson', accent: 'accent-indigo' }, { text: 'Prepare weekly section report.', tag: 'Report', accent: 'accent-amber' }] },
          { title: 'Section Rules', items: [{ text: 'Covers primary section only.' }, { text: 'Coordinates with HoS and Principal.' }, { text: 'No finance management rights.' }] },
        ],
      },
      classes: { title: 'Primary Classes', subtitle: 'Monitor all primary class performance.', panels: [{ title: 'Class Oversight', items: [{ text: 'Track attendance and class activities.' }, { text: 'Identify weak classes quickly.' }, { text: 'Assign support actions.' }] }] },
      staff: { title: 'Primary Staff', subtitle: 'Track primary section teacher outputs.', panels: [{ title: 'Staff Oversight', items: [{ text: 'Review weekly teacher outputs.' }, { text: 'Flag delayed submissions.' }, { text: 'Recommend coaching support.' }] }] },
      welfare: { title: 'Student Welfare', subtitle: 'Handle student welfare and safety in primary section.', panels: [{ title: 'Welfare', items: [{ text: 'Track welfare cases and responses.' }, { text: 'Coordinate with clinic when needed.' }, { text: 'Escalate major concerns.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate primary section reports.', panels: [{ title: 'Reports', items: [{ text: 'Primary performance dashboard report.' }, { text: 'Attendance and welfare report.' }, { text: 'Teacher review summary.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage account and alerts.', panels: [{ title: 'Security', items: [{ text: 'Update credentials.' }, { text: 'Review sessions.' }, { text: 'Set notification channels.' }] }] },
    },
  },

  nurseryhead: {
    roleTitle: 'Nursery Head Dashboard',
    watermark: 'NURSERY',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage nursery classes, welfare, and parent updates.',
        cards: [
          { label: 'Nursery Classes', value: '9', accent: 'accent-indigo' },
          { label: 'Attendance', value: '97%', accent: 'accent-emerald' },
          { label: 'Welfare Alerts', value: '3', accent: 'accent-amber' },
          { label: 'Parent Updates', value: '11', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Nursery Priorities', items: [{ text: 'Check morning attendance quickly.', tag: 'Morning', accent: 'accent-indigo' }, { text: 'Review child welfare notes.', tag: 'Welfare', accent: 'accent-amber' }, { text: 'Send parent daily updates.', tag: 'Parents', accent: 'accent-rose' }] },
          { title: 'Nursery Rules', items: [{ text: 'Covers nursery section only.' }, { text: 'Welfare alerts need fast response.' }, { text: 'Escalate major incidents immediately.' }] },
        ],
      },
      classes: { title: 'Nursery Classes', subtitle: 'Track nursery class activity and progress.', panels: [{ title: 'Class Tracking', items: [{ text: 'Monitor class participation.' }, { text: 'Review daily learning records.' }, { text: 'Support teachers with resources.' }] }] },
      welfare: { title: 'Child Welfare', subtitle: 'Manage nursery welfare and safety concerns.', panels: [{ title: 'Welfare Care', items: [{ text: 'Track health and behavior notes.' }, { text: 'Coordinate with clinic as needed.' }, { text: 'Notify guardians quickly.' }] }] },
      communication: { title: 'Parent Communication', subtitle: 'Keep parents informed about nursery activities.', panels: [{ title: 'Communication', items: [{ text: 'Share daily care and learning updates.' }, { text: 'Send urgent alerts when needed.' }, { text: 'Maintain communication logs.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate nursery reports for leadership.', panels: [{ title: 'Reports', items: [{ text: 'Nursery attendance report.' }, { text: 'Welfare summary by class.' }, { text: 'Weekly parent communication report.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage account security.', panels: [{ title: 'Security', items: [{ text: 'Change password.' }, { text: 'Review active sessions.' }, { text: 'Set alert preferences.' }] }] },
    },
  },

  examofficer: {
    roleTitle: 'Exam Officer Dashboard',
    watermark: 'EXAMS',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage exam setup, schedules, and integrity checks.',
        cards: [
          { label: 'Exams Scheduled', value: '26', accent: 'accent-indigo' },
          { label: 'Pending Approval', value: '7', accent: 'accent-amber' },
          { label: 'Completed', value: '19', accent: 'accent-emerald' },
          { label: 'Incidents', value: '1', accent: 'accent-rose' },
        ],
        panels: [
          { title: 'Exam Priorities', items: [{ text: 'Validate next exam timetable.', tag: 'Timetable', accent: 'accent-indigo' }, { text: 'Run anti-cheat checks.', tag: 'Integrity', accent: 'accent-rose' }, { text: 'Prepare print and CBT bundles.', tag: 'Prep', accent: 'accent-amber' }] },
          { title: 'Exam Rules', items: [{ text: 'Question papers stay restricted.' }, { text: 'Every exam action is logged.' }, { text: 'Result release follows approval chain.' }] },
        ],
      },
      timetable: { title: 'Timetable', subtitle: 'Create and manage exam timetables.', panels: [{ title: 'Timetable', items: [{ text: 'Set dates, times, and venues.' }, { text: 'Check clash detection alerts.' }, { text: 'Publish final timetable.' }] }] },
      questionbank: { title: 'Question Bank', subtitle: 'Manage approved question pools.', panels: [{ title: 'Question Bank', items: [{ text: 'Store vetted questions by subject.' }, { text: 'Tag by difficulty and topic.' }, { text: 'Lock bank access by role.' }] }] },
      invigilation: { title: 'Invigilation', subtitle: 'Assign invigilators and track coverage.', panels: [{ title: 'Invigilation', items: [{ text: 'Assign invigilators per session.' }, { text: 'Track attendance of invigilators.' }, { text: 'Log exam room incidents.' }] }] },
      integrity: { title: 'Integrity', subtitle: 'Track anti-cheat and exam incidents.', panels: [{ title: 'Integrity Desk', items: [{ text: 'Review suspicious activity logs.' }, { text: 'Escalate confirmed incidents.' }, { text: 'Archive incident outcomes.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate exam operations reports.', panels: [{ title: 'Reports', items: [{ text: 'Exam schedule completion report.' }, { text: 'Incident and integrity report.' }, { text: 'Invigilation performance report.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage account security and controls.', panels: [{ title: 'Security', items: [{ text: 'Enable secure login and 2FA.' }, { text: 'Review access history.' }, { text: 'Set high-risk alerts.' }] }] },
    },
  },

  sportsmaster: {
    roleTitle: 'Sports Master Dashboard',
    watermark: 'SPORTS',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Manage sports training, events, and athlete welfare.',
        cards: [
          { label: 'Active Teams', value: '11', accent: 'accent-indigo' },
          { label: 'Trainings This Week', value: '23', accent: 'accent-emerald' },
          { label: 'Injury Alerts', value: '2', accent: 'accent-rose' },
          { label: 'Pending Approvals', value: '5', accent: 'accent-amber' },
        ],
        panels: [
          { title: 'Sports Focus', items: [{ text: 'Confirm team attendance daily.', tag: 'Attendance', accent: 'accent-indigo' }, { text: 'Review athlete wellness status.', tag: 'Welfare', accent: 'accent-rose' }, { text: 'Publish inter-house schedule.', tag: 'Events', accent: 'accent-amber' }] },
          { title: 'Sports Rules', items: [{ text: 'All sports records are auditable.' }, { text: 'Medical flags must be respected.' }, { text: 'Event approvals follow school policy.' }] },
        ],
      },
      teams: { title: 'Teams', subtitle: 'Manage team rosters and participation.', panels: [{ title: 'Team Management', items: [{ text: 'Create and manage sports teams.' }, { text: 'Assign students to teams.' }, { text: 'Track participation status.' }] }] },
      training: { title: 'Training', subtitle: 'Plan and track training sessions.', panels: [{ title: 'Training Planner', items: [{ text: 'Schedule sessions by sport.' }, { text: 'Record attendance and performance.' }, { text: 'Assign coaching focus areas.' }] }] },
      events: { title: 'Events', subtitle: 'Coordinate sports events and competitions.', panels: [{ title: 'Event Desk', items: [{ text: 'Create event fixtures and timelines.' }, { text: 'Manage venue and logistics.' }, { text: 'Publish results and awards.' }] }] },
      welfare: { title: 'Athlete Welfare', subtitle: 'Monitor athlete health and fitness risks.', panels: [{ title: 'Welfare', items: [{ text: 'Track injury and recovery logs.' }, { text: 'Coordinate with clinic officer.' }, { text: 'Flag high-risk athletes.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate sports performance and activity reports.', panels: [{ title: 'Reports', items: [{ text: 'Team performance report.' }, { text: 'Training attendance trends.' }, { text: 'Athlete welfare summary.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage profile and account security.', panels: [{ title: 'Security', items: [{ text: 'Update login credentials.' }, { text: 'Review sessions and devices.' }, { text: 'Set report alerts.' }] }] },
    },
  },

  ami: {
    roleTitle: 'Ami System Authority',
    watermark: 'AMI',
    sections: {
      overview: {
        title: 'Overview',
        subtitle: 'Hidden highest authority for platform governance.',
        cards: [
          { label: 'Tenants', value: '128', accent: 'accent-indigo' },
          { label: 'Critical Events', value: '2', accent: 'accent-rose' },
          { label: 'Policy Changes', value: '6', accent: 'accent-amber' },
          { label: 'Uptime', value: '99.99%', accent: 'accent-emerald' },
        ],
        panels: [
          { title: 'Authority Focus', items: [{ text: 'Review top-level platform health.', tag: 'Global', accent: 'accent-indigo' }, { text: 'Approve critical policy updates.', tag: 'Policy', accent: 'accent-amber' }, { text: 'Handle severe security incidents.', tag: 'Critical', accent: 'accent-rose' }] },
          { title: 'Ami Safeguards', items: [{ text: 'Access is restricted and heavily audited.' }, { text: 'All actions generate immutable logs.' }, { text: 'Role is hidden in normal school operations.' }] },
        ],
      },
      tenants: { title: 'Tenant Governance', subtitle: 'Manage tenant-level controls and states.', panels: [{ title: 'Tenant Controls', items: [{ text: 'View tenant health and usage.' }, { text: 'Suspend or restore tenant access.' }, { text: 'Apply global policy overrides.' }] }] },
      security: { title: 'Security Command', subtitle: 'Handle platform-wide security events.', panels: [{ title: 'Security Ops', items: [{ text: 'Review high-risk sign-in events.' }, { text: 'Trigger emergency containment.' }, { text: 'Audit privileged access actions.' }] }] },
      policies: { title: 'Policy Engine', subtitle: 'Create and roll out system policies.', panels: [{ title: 'Policy Management', items: [{ text: 'Draft and publish global policies.' }, { text: 'Set compliance checks per tenant.' }, { text: 'Track acceptance and violations.' }] }] },
      audits: { title: 'Audit Trail', subtitle: 'Monitor immutable logs for all critical actions.', panels: [{ title: 'Audit Reports', items: [{ text: 'Search by actor, action, and time.' }, { text: 'Export legal-grade audit logs.' }, { text: 'Flag suspicious activity patterns.' }] }] },
      reports: { title: 'Reports', subtitle: 'Generate executive system governance reports.', panels: [{ title: 'Governance Reports', items: [{ text: 'Platform health and risk report.' }, { text: 'Tenant compliance report.' }, { text: 'Security incident summary.' }] }] },
      settings: { title: 'Settings', subtitle: 'Manage highest-tier security configuration.', panels: [{ title: 'Security', items: [{ text: 'Rotate privileged credentials.' }, { text: 'Enforce multi-factor controls.' }, { text: 'Review trusted device list.' }] }] },
    },
  },
};

export default operationalRoleConfigs;
