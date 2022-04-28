const resolver = require('./base-resolver');
const { pick, isEmpty } = require('lodash');

module.exports = ({ models }) => async ({ action, id, data }, transaction) => {
  const { EnforcementCase, EnforcementSubject, EnforcementFlag } = models;

  const touchEnforcementCase = async id => {
    return EnforcementCase.query(transaction).patchAndFetchById(id, { updatedAt: new Date().toISOString() });
  };

  const touchEnforcementSubject = async id => {
    return EnforcementSubject.query(transaction).patchAndFetchById(id, { updatedAt: new Date().toISOString() });
  };

  if (action === 'create') {
    return EnforcementCase.query(transaction).insert(data).returning('*');
  }

  if (action === 'update-subject') {
    let subject = data.subject;

    const existingSubject = await EnforcementSubject.query(transaction).findById(subject.id);

    if (!existingSubject && !isEmpty(subject.flags)) {
      // new subject so no existing flags, just insert subject and all flags
      await EnforcementSubject.query(transaction).insertGraph(subject);
      return touchEnforcementCase(id);
    }

    const existingFlags = await EnforcementFlag.query(transaction).where({ subjectId: subject.id });
    const requestedFlags = subject.flags || [];

    if (existingFlags.length === 0) {
      // no flags to update, just insert the new flags
      await EnforcementFlag.query(transaction).insert(requestedFlags);
      return touchEnforcementCase(id);
    }

    // work out what flags need adding / updating / deleting
    for (let ef of existingFlags) {
      const keepFlag = ef.modelType === 'establishment'
        ? requestedFlags.find(rf => rf.modelType === 'establishment' && rf.establishmentId === ef.establishmentId)
        : requestedFlags.find(rf => rf.modelType === ef.modelType && rf.modelId === ef.modelId);
      if (keepFlag) {
        // update the existing flag with any changes
        await ef.$query(transaction).patch(pick(keepFlag, ['status', 'modelOptions', 'remedialAction']));
      } else {
        // existing flag wasn't in requested flags, soft-delete it
        await ef.$query(transaction).delete();
      }
    }

    const newFlags = requestedFlags.filter(rf =>
      !existingFlags.find(ef =>
        (rf.modelType === 'establishment' && rf.establishmentId === ef.establishmentId) ||
        (rf.modelType === ef.modelType && rf.modelId === ef.modelId)
      )
    );

    if (newFlags.length > 0) {
      await EnforcementFlag.query(transaction).insert(newFlags);
    }

    if (requestedFlags.length === 0) {
      // all flags removed, delete the subject
      await EnforcementSubject.query(transaction).deleteById(subject.id);
    }

    await touchEnforcementSubject(subject.id);
    return touchEnforcementCase(id);
  }

  return resolver({ Model: EnforcementCase, action, data, id }, transaction);
};
