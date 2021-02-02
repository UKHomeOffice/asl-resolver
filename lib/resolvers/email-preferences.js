
module.exports = ({ models }) => ({ data }, transaction) => {
  const { EmailPreferences } = models;
  const { profileId, preferences } = data;

  return EmailPreferences.query(transaction).findOne({ profileId })
    .then(existingPrefs => {
      if (existingPrefs) {
        return existingPrefs.$query(transaction).patchAndFetch({ preferences });
      }

      return EmailPreferences.query(transaction).insertAndFetch({ profileId, preferences });
    });
};
