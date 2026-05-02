// Attendance calculations - analytics, metrics, and compliance scoring

export const calculateAttendanceMetrics = (records, staffList) => {
  const today = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter(r => r.date === today);

  const stats = {
    total: staffList.length,
    present: todayRecords.filter(r => r.status === 'Present').length,
    late: todayRecords.filter(r => r.status === 'Late').length,
    absent: staffList.length - todayRecords.length,
    excused: todayRecords.filter(r => r.status === 'Excused').length,
  };

  return {
    ...stats,
    presentPercentage: ((stats.present / stats.total) * 100).toFixed(2),
    pullRate: (((stats.present + stats.excused) / stats.total) * 100).toFixed(2),
  };
};

export const calculateDepartmentStats = (records, staffList) => {
  const departments = {};

  staffList.forEach(staff => {
    if (!departments[staff.department]) {
      departments[staff.department] = {
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        staff: [],
      };
    }
    departments[staff.department].total += 1;
    departments[staff.department].staff.push(staff);
  });

  const today = new Date().toISOString().split('T')[0];
  records.filter(r => r.date === today).forEach(record => {
    const staff = staffList.find(s => s.id === record.staffId);
    if (staff && departments[staff.department]) {
      const dept = departments[staff.department];
      switch (record.status) {
        case 'Present':
          dept.present += 1;
          break;
        case 'Late':
          dept.late += 1;
          break;
        case 'Excused':
          dept.excused += 1;
          break;
        default:
          break;
      }
    }
  });

  // Calculate absent for each department
  Object.keys(departments).forEach(dept => {
    const d = departments[dept];
    d.absent = d.total - d.present - d.late - d.excused;
    d.presentPercentage = ((d.present / d.total) * 100).toFixed(2);
  });

  return departments;
};

export const calculateStaffAttendanceScore = (staffId, records) => {
  if (records.length === 0) return 0;

  const score = records.reduce((acc, record) => {
    switch (record.status) {
      case 'Present':
        return acc + 1;
      case 'Late':
        return acc + 0.5;
      case 'Excused':
        return acc + 1;
      case 'Absent':
        return acc + 0;
      default:
        return acc;
    }
  }, 0);

  return ((score / records.length) * 100).toFixed(2);
};

export const calculateWeeklyTrend = (records, staffList) => {
  const trend = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayRecords = records.filter(r => r.date === dateStr);

    const present = dayRecords.filter(r => r.status === 'Present').length;
    const excused = dayRecords.filter(r => r.status === 'Excused').length;
    const percentage = ((present + excused) / staffList.length) * 100;

    trend.push({
      date: dateStr,
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      percentage: parseFloat(percentage.toFixed(2)),
      present,
      excused,
      absent: staffList.length - present - excused,
    });
  }

  return trend;
};

export const getLateArrivals = (records, limit = 10) => {
  return records
    .filter(r => r.status === 'Late')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit)
    .map(record => ({
      ...record,
      days: Math.floor((new Date() - new Date(record.date)) / (1000 * 60 * 60 * 24)),
    }));
};

export const getAbsentFrequency = (records, staffList, limit = 10) => {
  const absentMap = {};

  staffList.forEach(staff => {
    absentMap[staff.id] = {
      staffId: staff.id,
      name: staff.name,
      count: 0,
      lastDate: null,
      department: staff.department,
    };
  });

  records
    .filter(r => r.status === 'Absent')
    .forEach(record => {
      if (absentMap[record.staffId]) {
        absentMap[record.staffId].count += 1;
        absentMap[record.staffId].lastDate = record.date;
      }
    });

  return Object.values(absentMap)
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

export const identifyAtRiskStaff = (records, staffList, threshold = 60) => {
  const staffScores = staffList.map(staff => {
    const staffRecords = records.filter(r => r.staffId === staff.id);
    const score = calculateStaffAttendanceScore(staff.id, staffRecords);
    return {
      ...staff,
      attendanceScore: parseFloat(score),
      recordCount: staffRecords.length,
      isAtRisk: parseFloat(score) < threshold,
    };
  });

  return staffScores.filter(s => s.isAtRisk);
};

export const generateAttendanceReport = (records, staffList, format = 'summary') => {
  const metrics = calculateAttendanceMetrics(records, staffList);
  const deptStats = calculateDepartmentStats(records, staffList);
  const weeklyTrend = calculateWeeklyTrend(records, staffList);
  const lateArrivals = getLateArrivals(records, 20);
  const absentFreq = getAbsentFrequency(records, staffList, 20);
  const atRiskStaff = identifyAtRiskStaff(records, staffList);

  if (format === 'summary') {
    return {
      metrics,
      deptStats,
      weeklyTrend: weeklyTrend.slice(-7),
      alertCount: lateArrivals.length + atRiskStaff.length,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    metrics,
    deptStats,
    weeklyTrend,
    lateArrivals,
    absentFrequency: absentFreq,
    atRiskStaff,
    totalRecords: records.length,
  };
};

export const calculatePTAFlag = (staff, records) => {
  if (!staff.hasChildren) return false;
  const staffRecords = records.filter(r => r.staffId === staff.id);
  return staffRecords.some(r => r.date === new Date().toISOString().split('T')[0]);
};

export const getComplianceScore = (staffId, records) => {
  const staffRecords = records.filter(r => r.staffId === staffId);
  if (staffRecords.length === 0) return 0;

  const attendanceScore = calculateStaffAttendanceScore(staffId, staffRecords);
  const punctualityScore =
    ((staffRecords.filter(r => r.status === 'Present').length / staffRecords.length) * 100) -
    (staffRecords.filter(r => r.status === 'Late').length * 5);

  return {
    attendance: parseFloat(attendanceScore),
    punctuality: Math.max(0, parseFloat(punctualityScore.toFixed(2))),
    overall: parseFloat(((parseFloat(attendanceScore) + Math.max(0, punctualityScore)) / 2).toFixed(2)),
  };
};
