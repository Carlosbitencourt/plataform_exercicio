
const users = [
    { id: '6G69zd715eTcnOxnyLIQ', name: 'Vinicius damasceno trindade', status: 'ativo', createdAt: '2026-02-19T14:56:35.493Z' },
    { id: 'AqkajUq09u0nFdGtIH1R', name: 'Luiz Antônio Costa Neves ', status: 'ativo', createdAt: '2026-02-20T09:17:18.682Z' },
    { id: 'KK2gZj4OOUYvKrf74x9A', name: 'Cintia ', status: 'ativo', createdAt: '2026-03-01T20:56:00.566Z' },
    { id: 'l7AKmMYmMnmGsKzIdkNn', name: 'Gustavo de carvalho Luciano ', status: 'ativo', createdAt: '2026-02-18T14:17:17.022Z' },
    { id: 'oNcUUFt9SxUb1Cok9XmY', name: 'Jutai Xavier Luciano ', status: 'ativo', createdAt: '2026-02-26T14:48:56.763Z' },
    { id: 'pNXIpvSjrrCj6p5unzjf', name: 'Jully Santos', status: 'ativo', createdAt: '2026-03-04T19:16:05.185Z' },
    { id: 'vMz5zZ8h7UCsCasrhf0J', name: 'carlos bitencourt', status: 'ativo', createdAt: '2026-02-20T20:33:35.275Z' }
];

const checkIns = [
    { userId: 'pNXIpvSjrrCj6p5unzjf', date: '2026-03-02' },
    { userId: 'vMz5zZ8h7UCsCasrhf0J', date: '2026-03-02' },
    { userId: 'l7AKmMYmMnmGsKzIdkNn', date: '2026-03-02' },
    { userId: 'oNcUUFt9SxUb1Cok9XmY', date: '2026-03-02' },
    { userId: 'AqkajUq09u0nFdGtIH1R', date: '2026-03-02' },
    { userId: '6G69zd715eTcnOxnyLIQ', date: '2026-03-02' },
    { userId: 'AqkajUq09u0nFdGtIH1R', date: '2026-03-03' },
    { userId: '6G69zd715eTcnOxnyLIQ', date: '2026-03-03' },
    { userId: 'l7AKmMYmMnmGsKzIdkNn', date: '2026-03-03' },
    { userId: 'oNcUUFt9SxUb1Cok9XmY', date: '2026-03-03' },
    { userId: 'KK2gZj4OOUYvKrf74x9A', date: '2026-03-04' },
    { userId: 'pNXIpvSjrrCj6p5unzjf', date: '2026-03-04' },
    { userId: '6G69zd715eTcnOxnyLIQ', date: '2026-03-04' },
    { userId: 'AqkajUq09u0nFdGtIH1R', date: '2026-03-04' },
    { userId: 'l7AKmMYmMnmGsKzIdkNn', date: '2026-03-04' },
    { userId: 'vMz5zZ8h7UCsCasrhf0J', date: '2026-03-04' },
    { userId: 'oNcUUFt9SxUb1Cok9XmY', date: '2026-03-04' },
    { userId: 'oNcUUFt9SxUb1Cok9XmY', date: '2026-03-05' },
    { userId: 'l7AKmMYmMnmGsKzIdkNn', date: '2026-03-05' },
    { userId: 'pNXIpvSjrrCj6p5unzjf', date: '2026-03-05' },
    { userId: 'KK2gZj4OOUYvKrf74x9A', date: '2026-03-05' },
    { userId: 'oNcUUFt9SxUb1Cok9XmY', date: '2026-03-06' },
    { userId: 'KK2gZj4OOUYvKrf74x9A', date: '2026-03-06' },
    { userId: 'l7AKmMYmMnmGsKzIdkNn', date: '2026-03-06' },
    { userId: 'AqkajUq09u0nFdGtIH1R', date: '2026-03-06' }
];

const startDate = new Date('2026-03-02T00:00:00');
const limit = new Date('2026-03-07T00:00:00'); // Saturday

const weekdaysInRange = [];
const current = new Date(startDate);
while (current <= limit) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        weekdaysInRange.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
}

console.log("Weekdays in range:", weekdaysInRange);

const activeUsersList = users;
let totalMisses = 0;
const details = [];

activeUsersList.forEach(user => {
    const userCheckInDates = new Set(checkIns.filter(c => c.userId === user.id).map(c => c.date));
    const registrationDate = user.createdAt ? new Date(user.createdAt) : null;
    if (registrationDate) {
        registrationDate.setHours(0, 0, 0, 0);
    }

    weekdaysInRange.forEach(date => {
        if (registrationDate) {
            const regDateISO = registrationDate.toISOString().split('T')[0];
            if (date < regDateISO) return;
        }

        if (!userCheckInDates.has(date)) {
            totalMisses++;
            details.push({ user: user.name, date });
        }
    });
});

console.log("Total Misses:", totalMisses);
console.log("Details:", JSON.stringify(details, null, 2));
