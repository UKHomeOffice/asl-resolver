const { pick } = require('lodash');
const moment = require('moment');
const resolver = require('./base-resolver');
const { generateLicenceNumber } = require('../utils');

module.exports = ({ models }) => async ({ action, data, id }, transaction) => {
  const { TrainingPil, Profile, Permission } = models;

  if (action === 'create') {
    let profile = await Profile.query(transaction).select('id', 'dob').findOne({ email: data.email });

    if (profile) {
      if (!profile.dob && data.dob) {
        await profile.$query(transaction).patch({ dob: data.dob });
      }
      const trainingPil = await TrainingPil.query(transaction).findOne({ trainingCourseId: data.trainingCourseId, profileId: profile.id });
      if (trainingPil) {
        return trainingPil;
      }
    }

    if (!profile) {
      profile = await Profile.query(transaction).insert(pick(data, 'firstName', 'lastName', 'dob', 'email')).returning('id');
    }

    return TrainingPil.query(transaction).insert({ profileId: profile.id, trainingCourseId: data.trainingCourseId, trainingNeed: data.trainingNeed }).returning('*');
  }

  if (action === 'grant') {
    const trainingPil = await TrainingPil.query(transaction).findById(id).withGraphFetched('trainingCourse');
    const profile = await Profile.query(transaction).findById(trainingPil.profileId);

    if (!profile.pilLicenceNumber) {
      const pilLicenceNumber = await generateLicenceNumber({ model: Profile, transaction, type: 'pil', key: 'pilLicenceNumber' });
      await profile.$query(transaction).patch({ pilLicenceNumber });
    }

    const permission = await Permission.query(transaction).findOne({ profileId: profile.id, establishmentId: trainingPil.trainingCourse.establishmentId });

    if (!permission) {
      await Permission.query(transaction).insert({ profileId: profile.id, establishmentId: trainingPil.trainingCourse.establishmentId, role: 'basic' }).returning('*');
    }

    return TrainingPil.query(transaction).patchAndFetchById(id, {
      status: 'active',
      issueDate: moment().toISOString(),
      expiryDate: moment().add(3, 'months').toISOString()
    });
  }

  if (action === 'revoke') {
    return TrainingPil.query(transaction).patchAndFetchById(id, {
      status: 'revoked',
      revocationDate: new Date().toISOString()
    });
  }

  return resolver({ Model: models.TrainingPil, action, data, id }, transaction);
};
