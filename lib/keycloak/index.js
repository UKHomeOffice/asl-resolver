const request = require('r2');
const URLSearchParams = require('url-search-params');

module.exports = (settings) => ({
  grantToken: () => {
    return Promise.resolve()
      .then(() => {
        const body = new URLSearchParams();
        body.set('grant_type', 'password');
        body.set('username', settings.adminUsername);
        body.set('password', settings.adminPassword);
        body.set('client_id', settings.client);
        body.set('client_secret', settings.secret);

        const opts = { method: 'POST', body };

        return request(`${settings.url}/realms/${settings.realm}/protocol/openid-connect/token`, opts).response;
      })
      .then(response => {
        return response.json()
          .then(json => {
            if (response.status > 399) {
              const error = new Error(response.statusText);
              error.status = response.status;
              Object.assign(error, json);
              throw error;
            }
            return json.access_token;
          });
      });
  },

  updateUser: ({ accessToken, user }) => {
    return Promise.resolve()
      .then(() => {
        const opts = {
          method: 'PUT',
          headers: {
            'Content-type': 'application/json',
            Authorization: `Bearer ${accessToken}`
          },
          json: {
            username: user.email, // user.email is the new email address being requested
            email: user.email
          }
        };

        return request(`${settings.url}/admin/realms/${settings.realm}/users/${user.id}`, opts).response;
      })
      .then(response => {
        if (response.status > 399) {
          const error = new Error(response.statusText);
          error.status = response.status;
          throw error;
        }
        return Promise.resolve('OK');
      });
  }
});
