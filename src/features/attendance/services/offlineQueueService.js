// Offline queue service - handles queueing and syncing of attendance records

class OfflineQueueService {
  constructor() {
    this.storageKey = 'ndovera_attendance_queue';
    this.init();
  }

  init() {
    if (!localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify([]));
    }
  }

  // Add attendance record to offline queue
  addToQueue(attendanceRecord) {
    const queue = this.getQueue();
    const record = {
      ...attendanceRecord,
      id: `QUEUE_${Date.now()}`,
      queuedAt: new Date().toISOString(),
      status: 'Pending',
      syncedAt: null,
      conflict: null,
    };
    queue.push(record);
    localStorage.setItem(this.storageKey, JSON.stringify(queue));
    return record;
  }

  // Get all queued records
  getQueue() {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  // Get pending records
  getPendingQueue() {
    return this.getQueue().filter(item => item.status === 'Pending');
  }

  // Get conflicted records
  getConflictedQueue() {
    return this.getQueue().filter(item => item.conflict !== null);
  }

  // Simulate offline sync (in real app, would call API)
  async syncQueue(onlineRecords = []) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const queue = this.getQueue();
        const syncedQueue = queue.map(item => {
          const existingRecord = onlineRecords.find(
            r => r.staffId === item.staffId && r.date === item.date
          );

          if (existingRecord) {
            return {
              ...item,
              status: 'Conflict',
              conflict: {
                existingRecord,
                newRecord: item,
                resolution: 'pending',
              },
            };
          }

          return {
            ...item,
            status: 'Synced',
            syncedAt: new Date().toISOString(),
          };
        });

        localStorage.setItem(this.storageKey, JSON.stringify(syncedQueue));
        resolve(syncedQueue);
      }, 1000);
    });
  }

  // Resolve conflict - choose which record to keep
  resolveConflict(queueId, resolution) {
    const queue = this.getQueue();
    const index = queue.findIndex(item => item.id === queueId);

    if (index !== -1) {
      queue[index].conflict.resolution = resolution;
      queue[index].status = 'Synced';
      queue[index].syncedAt = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(queue));
      return queue[index];
    }

    return null;
  }

  // Clear synced records
  clearSynced() {
    const queue = this.getQueue();
    const filtered = queue.filter(item => item.status !== 'Synced');
    localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    return filtered;
  }

  // Get queue statistics
  getQueueStats() {
    const queue = this.getQueue();
    return {
      total: queue.length,
      pending: queue.filter(item => item.status === 'Pending').length,
      synced: queue.filter(item => item.status === 'Synced').length,
      conflicted: queue.filter(item => item.status === 'Conflict').length,
      lastUpdate: new Date().toISOString(),
    };
  }

  // Clear entire queue
  clearQueue() {
    localStorage.setItem(this.storageKey, JSON.stringify([]));
  }
}

export default new OfflineQueueService();
