const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

function makeSvgAvatar(gradientStart, gradientEnd, hairColor, skinColor) {
  const isDarkHair = hairColor === 'dark';
  const hairPath = isDarkHair
    ? 'M46 64 C46 36 60 26 80 26 C100 26 114 36 114 64 C114 50 102 38 80 38 C58 38 46 50 46 64 Z'
    : 'M44 68 C44 32 60 24 80 24 C100 24 116 32 116 68 C116 52 104 36 80 36 C56 36 44 52 44 68 Z';
  const hairFill = isDarkHair ? '#1e293b' : '#92400e';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradientStart}"/>
      <stop offset="100%" stop-color="${gradientEnd}"/>
    </linearGradient>
    <clipPath id="circleClip">
      <circle cx="80" cy="80" r="80"/>
    </clipPath>
  </defs>
  <g clip-path="url(#circleClip)">
    <rect width="160" height="160" fill="url(#grad)"/>
    <path d="M35 160 C35 125 55 110 80 110 C105 110 125 125 125 160 Z" fill="#ffffff" opacity="0.25"/>
    <circle cx="80" cy="70" r="34" fill="${skinColor}"/>
    <path d="${hairPath}" fill="${hairFill}"/>
    <circle cx="70" cy="68" r="3.5" fill="#1e293b"/>
    <circle cx="90" cy="68" r="3.5" fill="#1e293b"/>
    <path d="M73 80 Q80 87 87 80" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

async function updateAvatars() {
  const updates = [
    { id: 'usr_sarah', avatar: makeSvgAvatar('#ec4899', '#be185d', 'dark', '#fed7aa') },
    { id: 'usr_arjun', avatar: makeSvgAvatar('#06b6d4', '#0e7490', 'dark', '#fcd34d') },
    { id: 'usr_elena', avatar: makeSvgAvatar('#8b5cf6', '#6d28d9', 'amber', '#fde68a') },
    { id: 'usr_vikram', avatar: makeSvgAvatar('#f59e0b', '#b45309', 'dark', '#fed7aa') },
    { id: 'usr-dGVqYW1hbmNoZW0x', avatar: makeSvgAvatar('#6366f1', '#4338ca', 'dark', '#fed7aa') },
  ];

  for (const u of updates) {
    try {
      await prisma.user.update({
        where: { id: u.id },
        data: { avatar_url: u.avatar }
      });
      console.log('Successfully updated avatar for', u.id);
    } catch (e) {
      console.log('Could not update', u.id, e.message);
    }
  }
}

updateAvatars().finally(() => prisma.$disconnect());
