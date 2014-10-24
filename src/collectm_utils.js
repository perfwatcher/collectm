
exports.collectd_sanitize = function (name) {
    return name.replace(/[ -\/\(\)]/g, '_');
};


// vim: set filetype=javascript fdm=marker sw=4 ts=4 et:
