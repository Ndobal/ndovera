const API_ENDPOINTS = {
  header: {
    stats: roleKey => `/api/header/${roleKey}`,
  },
  roles: {
    student: '/api/dashboards/student',
    parent: '/api/dashboards/parent',
    teacher: '/api/dashboards/teacher',
    hos: '/api/dashboards/hos',
    accountant: '/api/dashboards/accountant',
    owner: '/api/dashboards/owner',
    librarian: '/api/dashboards/librarian',
    sanitation: '/api/dashboards/sanitation',
    tuckshopmanager: '/api/dashboards/tuckshopmanager',
    storekeeper: '/api/dashboards/storekeeper',
    transport: '/api/dashboards/transport',
    hostel: '/api/dashboards/hostel',
    cafeteria: '/api/dashboards/cafeteria',
    clinic: '/api/dashboards/clinic',
    ict: '/api/dashboards/ict',
    classteacher: '/api/dashboards/classteacher',
    hod: '/api/dashboards/hod',
    hodassistant: '/api/dashboards/hodassistant',
    principal: '/api/dashboards/principal',
    headteacher: '/api/dashboards/headteacher',
    nurseryhead: '/api/dashboards/nurseryhead',
    examofficer: '/api/dashboards/examofficer',
    sportsmaster: '/api/dashboards/sportsmaster',
    ami: '/api/dashboards/ami',
  },
};

export default API_ENDPOINTS;
