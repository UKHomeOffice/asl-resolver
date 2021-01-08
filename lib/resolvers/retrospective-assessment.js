const sha = require('sha.js');
const resolver = require('./base-resolver');
const jsondiff = require('jsondiffpatch').create({
  objectHash: obj => {
    return obj.id || sha('sha256').update(obj).digest('hex');
  }
});

module.exports = ({ models }) => ({ action, data, id }, transaction) => {
  const { RetrospectiveAssessment } = models;

  if (action === 'patch') {
    return Promise.resolve()
      .then(() => RetrospectiveAssessment.query(transaction).findById(id))
      .then(ra => {
        if (ra.status !== 'draft') {
          throw new Error('Can only patch draft RA versions');
        }

        ra.data = ra.data || {};
        try {
          const newData = jsondiff.patch(ra.data, data.patch);

          return ra.$query(transaction).patchAndFetch({ data: newData });
        } catch (e) {
          e.patch = JSON.stringify(data.patch);
          throw e;
        }
      });
  }
  return resolver({ Model: RetrospectiveAssessment, action, data, id }, transaction);
};
