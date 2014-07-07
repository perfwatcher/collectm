module.exports = function (callback, realm) {
    if (!callback || typeof callback != 'function') {
        throw new Error('You must provide a function ' +
        'callback as the first parameter');
    }

    realm = realm ? realm : 'Authorization required.';

    function unauthorized(res, sendResponse) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="' + realm + '"');

        if (sendResponse) {
            res.end('Unauthorized');
        }
    }

    return function(req, res, next) {
        req.requireAuthorization = function(req, res, next) {
            var authorization = req.headers.authorization;

            if (req.remoteUser) return next();
            if (!authorization) return unauthorized(res, true);

            var parts = authorization.split(' ');
            var scheme = parts[0];
            if ('Basic' != scheme) {
                return next(new Error('Authorization header ' +
                'does not have the correct scheme. \'Basic\' ' +
                'scheme was expected.'));
            }

            var _credentials = new Buffer(parts[1], 'base64').toString().split(':');

            var credentials = { username: _credentials[0],
                                password: _credentials[1] };

            callback(credentials, req, res, function(err) {
                if (err) {
                    unauthorized(res);
                    next(err);
                    return;
                }

                req.remoteUser = credentials.username;
                next();
            });
        };
        next();
    };
};

