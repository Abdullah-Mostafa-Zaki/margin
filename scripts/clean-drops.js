const fs = require('fs');

const files = [
  'src/app/actions/getReturnsByCity.ts',
  'src/app/actions/getOrderFunnel.ts',
  'src/app/actions/getDashboardInsights.ts',
  'src/app/actions/getAnalyticsVelocity.ts',
  'src/app/actions/getAdvancedReturnMetrics.ts',
  'src/app/actions/getMarketingMetrics.ts'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/OR: \[\n\s*\{ dropId: tagId \},\n\s*\{ drops: \{ some: \{ dropId: tagId \} \} \}\n\s*\]/g, 'drops: { some: { dropId: tagId } }');
  fs.writeFileSync(f, c, 'utf8');
});
console.log('Cleaned drop scalar filters');
