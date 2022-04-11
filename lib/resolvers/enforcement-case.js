const resolver = require('./base-resolver');
const util = require('util');

module.exports = ({ models }) => async ({ action, id, data, meta }, transaction) => {
  const { EnforcementCase, EnforcementFlag } = models;
  console.log(util.inspect({ action, id, meta }, false, null, true));

  if (action === 'create') {
    return EnforcementCase.query(transaction).insert(data);
  }

  if (action === 'update-subject') {
    const subjectId = meta.subjectId;
    const requestedFlags = data.flags;
    const existingFlags = await EnforcementFlag.query(transaction).where({ caseId: id, profileId: subjectId });

    console.log('REQUESTED', requestedFlags);
    console.log('EXISTING', existingFlags);

    if (existingFlags.length === 0) {
      // no flags to update, just insert the new flags
      await EnforcementFlag.query(transaction).insert(requestedFlags);
    } else {
      // work out what flags need adding / updating / deleting
      for (let ef of existingFlags) {
        const keepFlag = requestedFlags.find(rf => rf.modelType === ef.modelType && rf.modelId === ef.modelId);
        if (keepFlag) {
          await ef.$query(transaction).patch({ status: keepFlag.status, remedialAction: keepFlag.remedialAction });
        } else {
          // existing flag wasn't in requested flags, soft-delete it
          await ef.$query(transaction).delete();
        }
      }

      const newFlags = requestedFlags.filter(rf =>
        !existingFlags.find(ef => rf.modelType === ef.modelType && rf.modelId === ef.modelId)
      );

      if (newFlags.length > 0) {
        await EnforcementFlag.query(transaction).insert(newFlags);
      }
    }

    return EnforcementCase.query(transaction).findById(id);
  }

  return resolver({ Model: EnforcementCase, action, data, id }, transaction);
};
