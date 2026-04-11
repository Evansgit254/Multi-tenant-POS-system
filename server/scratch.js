const fs = require('fs');
const path = require('path');

const files = [
  'procurement.test.ts',
  'kds.test.ts',
  'inventory.test.ts',
  'menu.test.ts',
  'shifts.test.ts',
  'rooms.test.ts',
  'reports.test.ts',
  'orders.test.ts'
];

for (const file of files) {
  const filePath = path.join('src/tests', file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(
    /token = jwt\.sign\({ id: user\.id, tenantId, role: user\.role }, process\.env\.JWT_SECRET \|\| 'test-secret'\);/,
    `const jti = 'test-jti-' + Date.now();\n  await prisma.session.create({ data: { token: jti, userId: user.id, tenantId, expiresAt: new Date(Date.now() + 86400000) } });\n  token = jwt.sign({ id: user.id, tenantId, role: user.role, jti }, process.env.JWT_SECRET || 'test-secret');`
  );
  fs.writeFileSync(filePath, content);
}
console.log('Fixed tests');
