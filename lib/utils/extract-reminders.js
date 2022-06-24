const { omit, pick } = require('lodash');

// condition.reminders looks like:
// {
//   nmbas: [
//     {
//       id: '8646d19e-9842-4f01-bd49-af987c8c6c0c',
//       deadline: '2023-01-01'
//     },
//     {
//       id: '99a5e7ae-d601-417c-a9ba-4487bfd47c79',
//       deadline: '2023-02-02'
//     }
//   ],
//   active: [ 'nmbas' ]
// },
// {
//   reporting: [
//     {
//       id: 'a1a563bf-47ae-4cb8-b048-22f0fb62f8ac',
//       deadline: '2022-11-11'
//     }
//   ],
//   active: [] <-- checkbox for reporting was unticked, so reminder should be deleted
// }
const extractReminders = (conditions, model) => {
  const reminders = conditions
    .filter(c => c.reminders)
    .reduce((reminders, condition) => {
      const active = condition.reminders.active || [];
      const conditionKey = Object.keys(condition.reminders).filter(k => k !== 'active')[0];

      condition.reminders[conditionKey].map(item => {
        reminders.push({
          ...pick(item, ['id', 'deadline']),
          ...pick(model, ['modelType', 'modelId', 'establishmentId']),
          conditionKey,
          deleted: active.includes(conditionKey) ? undefined : (new Date()).toISOString()
        });
      });
      return reminders;
    }, []);

  return { reminders, conditions: conditions.map(condition => omit(condition, 'reminders')) };
};

module.exports = extractReminders;
