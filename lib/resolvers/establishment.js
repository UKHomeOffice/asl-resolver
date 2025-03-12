const resolver = require('./base-resolver');
const { get, pick, omit } = require('lodash');
const { generateLicenceNumber } = require('../utils');

async function renameProtocolLocation(ProjectVersion, transaction, establishmentId, renameFrom, renameTo) {
  // Find projects with availability at the renamed establishment (primary or additional), which contain the
  // establishment in at least one protocol location.
  const versionData = transaction.raw(
    // language=PostgreSQL
    `
          SELECT pv.id, any_value(pv.data) as data
          FROM projects p
               LEFT JOIN project_versions pv ON p.id = pv.project_id
               LEFT JOIN project_establishments pe ON p.id = pe.project_id
               CROSS JOIN JSONB_ARRAY_ELEMENTS(pv.data -> 'protocols') WITH ORDINALITY AS proto(value, idx)
               CROSS JOIN JSONB_ARRAY_ELEMENTS_TEXT(proto.value -> 'locations') WITH ORDINALITY AS location(value, idx)
          WHERE (p.establishment_id = :establishmentId OR pe.establishment_id = :establishmentId)
            AND location.value = :renameFrom
          GROUP BY pv.id;
    `,
    {establishmentId, renameFrom}
  ).stream();

  const updates = [];

  for await (const {id: versionId, data} of versionData) {
    // Remove old and add new only where new establishment is a location, avoiding duplicates.
    data.protocols.forEach(protocol => {
      if (protocol.locations?.includes(renameFrom)) {
        protocol.locations = [
          ...new Set([
            ...protocol.locations.filter(location => location !== renameFrom),
            renameTo
          ])
        ];
      }
    });

    updates.push(ProjectVersion.query(transaction).where({ id: versionId }).update({ data }));
  }

  await Promise.all(updates);
}

module.exports = ({ models }) => async ({ action, data, id }, transaction) => {
  const { Establishment, Authorisation, Reminder, Role, ProjectVersion } = models;

  if (action === 'update') {
    const existing = await Establishment.query(transaction).findById(id);

    let reminder;
    if (get(data, 'reminder')) {
      reminder = JSON.parse(get(data, 'reminder'));
    }
    delete data.reminder;

    if (data.conditions === '') {
      data.conditions = null;
    }

    const isCorporate = data.corporateStatus === 'corporate';
    const newProfileRole = isCorporate ? data.nprc : data.pelh;
    delete data.pelh;
    delete data.nprc;
    if (!isCorporate) {
      // Unset legal responsible person details
      data.legalName = null;
      data.legalEmail = null;
      data.legalPhone = null;
    }

    const establishment = await Establishment.query(transaction).patchAndFetchById(id, data);

    if (data.authorisations) {
      await Authorisation.query(transaction).delete().where('establishmentId', id);
      if (data.authorisations.length) {
        // strip the ids, these will be inserted as new authorisations
        const authorisations = data.authorisations.map(a => omit(a, 'id'));
        await Authorisation.query(transaction).insert(authorisations);
      }
    }

    // If corporate status is set, check NPRC/PELH depending on status
    if (data.corporateStatus) {
      const typeOfRole = isCorporate ? 'nprc' : 'pelh';
      const typeOfRoleToRemove = isCorporate ? 'pelh' : 'nprc';

      await Role.upsert({
        establishmentId: establishment.id,
        profileId: newProfileRole,
        type: typeOfRole,
        deleted: null
      }, {
        establishmentId: establishment.id,
        profileId: newProfileRole,
        type: typeOfRole
      }, transaction);

      await Role.query(transaction).where({ establishmentId: establishment.id, type: typeOfRole }).whereNot({profileId: newProfileRole}).delete();
      await Role.query(transaction).where({ establishmentId: establishment.id, type: typeOfRoleToRemove }).delete();
    }

    if (existing.name !== establishment.name) {
      await renameProtocolLocation(ProjectVersion, transaction, id, existing.name, establishment.name);
    }

    if (reminder) {
      await Reminder.upsert({
        ...reminder,
        modelType: 'establishment',
        establishmentId: id,
        status: 'active',
        deleted: reminder.deleted ? new Date().toISOString() : undefined
      }, undefined, transaction);
    }

    return establishment;
  }

  if (action === 'update-conditions') {
    const reminder = get(data, 'reminder');

    if (reminder) {
      await Reminder.upsert({
        ...reminder,
        modelType: 'establishment',
        establishmentId: id,
        status: 'active',
        deleted: reminder.deleted ? new Date().toISOString() : undefined
      }, undefined, transaction);
    }

    return resolver(
      {
        Model: models.Establishment,
        action: 'update',
        data: pick(data, 'conditions'),
        id
      },
      transaction
    );
  }

  if (action === 'update-billing') {
    const patch = { billing: { ...data, updatedAt: new Date().toISOString() } };
    return Establishment.query(transaction).context({ preserveUpdatedAt: true }).patchAndFetchById(id, patch);
  }

  if (action === 'grant') {
    return Promise.resolve()
      .then(() => generateLicenceNumber({ model: Establishment, transaction, type: 'pel' }))
      .then(licenceNumber => {
        return Establishment.query(transaction).findById(id)
          .then(establishment => establishment.$query(transaction).patchAndFetch({
            status: 'active',
            issueDate: new Date().toISOString(),
            licenceNumber: establishment.licenceNumber || licenceNumber
          }));
      });
  }

  if (action === 'suspend') {
    return Establishment.query(transaction).patchAndFetchById(id, {
      suspendedDate: new Date().toISOString()
    });
  }

  if (action === 'reinstate') {
    return Establishment.query(transaction).patchAndFetchById(id, {
      suspendedDate: null
    });
  }

  if (action === 'revoke') {
    return Establishment.query(transaction).patchAndFetchById(id, {
      status: 'revoked',
      revocationDate: new Date().toISOString()
    });
  }

  return resolver({ Model: models.Establishment, action, data, id }, transaction);
};
