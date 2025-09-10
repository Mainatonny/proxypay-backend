// Additional admin controller functions can be added here

const getSystemStats = async () => {
  // This function could be expanded to provide more detailed system statistics
  return {
    total_users: 150,
    active_sessions: 23,
    system_uptime: '5 days, 12 hours',
    server_load: '25%'
  };
};

module.exports = {
  getSystemStats
};