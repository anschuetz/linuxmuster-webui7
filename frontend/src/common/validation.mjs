/**
 * Pure JavaScript port of lmn_common validation.coffee (no Angular or DOM).
 * One instance per consumer; set(data, name) retains the original shared-data contract.
 * @param {Pick<import('../adapter/aj.mjs').Aj, 'gettext'>} aj
 */
export function createValidation(aj) {
    return {
        externVar: {},
        findval(attr, val) {
            return (dict) => dict[attr] === val;
        },
        set(data, name) {
            this.externVar = { ...this.externVar, [name]: data };
        },
        isStrongPwd(password) {
            const error = aj.gettext('Passwords must contain at least one lowercase, one uppercase, one special char or number, and at least 7 chars');
            return /(?=.*[a-z])(?=.*[A-Z])(?=.*[?!@#§+\.\-$%&*{}()]|(?=.*\d)).{7,}/.test(password) ? true : error;
        },
        validCharPwd(password) {
            const error = aj.gettext('Password is not valid. Password can only contains a-zA-Z0-9.?!@#§+\-$%&*{}()\]\[');
            return /^[a-zA-Z0-9\.?!@#§+\-$%&*{}()\]\[]+$/.test(password) ? true : error;
        },
        isValidProjectName(name) {
            const error = name + aj.gettext(' can only contain lowercase chars or numbers');
            return /^[a-zA-Z0-9_\-äëïöüÄËÏÖÜßéàèùçÀÉÈÇÙâêîôûÂÊÛÔÎ]*$/.test(name) ? true : error;
        },
        isValidSession(name) {
            const error = name + aj.gettext(' can only contain alphanumeric chars or _+-');
            return /^[a-z0-9\+\-_]*$/i.test(name) ? true : error;
        },
        isValidLinboConf(name) {
            const error = name + aj.gettext(' can only contain alphanumeric chars or _-');
            return /^[a-z0-9\-_]*$/i.test(name) ? true : error;
        },
        isValidLogin(name) {
            const error = name + aj.gettext(' can only contain alphanumeric chars or -');
            return /^[a-z0-9\-_]*$/i.test(name) ? true : error;
        },
        isValidComment(comment) {
            const error = comment + aj.gettext(' can only contain alphanumeric chars or -, space and _');
            return /^[a-z0-9\-_ ]*$/i.test(comment) ? true : error;
        },
        isValidAlphaNum(name) {
            const error = name + aj.gettext(' can only contain alphanumeric chars');
            return /^[a-z0-9]*$/i.test(name) ? true : error;
        },
        isValidCount(count) {
            const error = count + aj.gettext(' is not a valid number');
            return /^([0-9]*)$/.test(count) ? true : error;
        },
        isValidDate(date) {
            const error = date + aj.gettext(' is not a valid date');
            return /^([1-9]|0[1-9]|[12][0-9]|3[01])[.]([1-9]|0[1-9]|1[012])[.](19|20)\d\d$/.test(date) ? true : error;
        },
        isValidImage(name) {
            const error = name + aj.gettext(' does not contain valid chars or is duplicated');
            return /^[a-zA-Z0-9_\-]+$/.test(name) ? true : error;
        },
        isValidDomain(domain) {
            const error = domain + aj.gettext(' is not a valid domain');
            return /^[a-zA-Z0-9\-.]*$/.test(domain) ? true : error;
        },
        isValidPassword(password) {
            const valid = this.validCharPwd(password);
            const strong = this.isStrongPwd(password);
            return valid === true && strong === true ? true : strong !== true ? strong : valid;
        },
        isValidMac(mac, idx) {
            const error = mac + aj.gettext(' is not valid or duplicated');
            let valid = /^([0-9A-Fa-f]{2}[:]){5}([0-9A-Fa-f]{2})$/.test(mac);
            if (!valid && /^([0-9A-Fa-f]{2}[-]){5}([0-9A-Fa-f]{2})$/.test(mac)) {
                valid = true;
                mac = mac.replaceAll('-', ':');
                this.externVar.devices[idx].mac = mac;
            } else if (!valid && /^[0-9A-Fa-f]{12}$/.test(mac)) {
                valid = true;
                mac = mac.match(/.{1,2}/g).join(':');
                this.externVar.devices[idx].mac = mac;
            }
            return valid && this.externVar.devices.filter(this.findval('mac', mac)).length < 2 ? true : error;
        },
        isValidIP(ip) {
            const error = ip + aj.gettext(' is not valid or duplicated');
            const regex = /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[1-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[1-9])$/;
            return regex.test(ip) && this.externVar.devices.filter(this.findval('ip', ip)).length < 2 ? true : error;
        },
        isValidHost(hostname, test_length = true) {
            const error = hostname + aj.gettext(' does not contain valid chars, is duplicated or too long (>15 chars)');
            const valid = /^[a-zA-Z0-9\-]+$/.test(hostname)
                && this.externVar.devices.filter(this.findval('hostname', hostname)).length < 2;
            return valid && (!test_length || hostname.length < 16) ? true : error;
        },
        isValidRoom(room) {
            return this.isValidHost(room);
        },
        isValidRole(role) {
            const error = role + aj.gettext(' is not a valid role');
            const roles = [
                'switch', 'addc', 'wlan', 'staffcomputer', 'mobile', 'printer',
                'classroom-teachercomputer', 'server', 'iponly', 'faculty-teachercomputer',
                'voip', 'byod', 'classroom-studentcomputer', 'thinclient', 'router',
            ];
            return roles.includes(role) ? true : error;
        },
    };
}
