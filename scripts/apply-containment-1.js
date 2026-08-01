const fs = require('fs');

const filesToUpdate = [
  'src/app/actions/getReturnsByCity.ts',
  'src/app/actions/getOrderFunnel.ts',
  'src/app/actions/getDashboardInsights.ts',
  'src/app/actions/getAnalyticsVelocity.ts',
  'src/app/actions/getAdvancedReturnMetrics.ts'
];

for (const f of filesToUpdate) {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/const dateFilter = startDate && endDate \? \{\n\s*date: \{\n\s*gte: startDate,\n\s*lte: endDate,\n\s*\}\n\s*\} : \{\};/g, 
`  const dateFilter = startDate && endDate ? {
    date: {
      gte: startDate,
      lte: endDate,
    },
    OR: [
      { dateConfidence: "CONFIRMED" },
      { 
        dateConfidence: "ESTIMATED",
        estimatedRangeStart: { gte: startDate },
        estimatedRangeEnd: { lte: endDate },
      }
    ]
  } : {};`);
  fs.writeFileSync(f, c, 'utf8');
  console.log('Updated', f);
}
