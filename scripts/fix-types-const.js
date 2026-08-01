const fs = require('fs');
const files = [
  'src/app/actions/getReturnsByCity.ts',
  'src/app/actions/getOrderFunnel.ts',
  'src/app/actions/getDashboardInsights.ts',
  'src/app/actions/getAnalyticsVelocity.ts',
  'src/app/actions/getAdvancedReturnMetrics.ts',
  'src/app/actions/getMonthMetrics.ts',
  'src/app/actions/getMarketingMetrics.ts',
  'src/actions/reports.actions.ts'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/dateConfidence: "CONFIRMED" as any/g, 'dateConfidence: "CONFIRMED" as const');
  c = c.replace(/dateConfidence: "ESTIMATED" as any/g, 'dateConfidence: "ESTIMATED" as const');
  fs.writeFileSync(f, c, 'utf8');
});
console.log('Fixed types to as const');
