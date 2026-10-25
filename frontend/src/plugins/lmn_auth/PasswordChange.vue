<script setup>
import { inject, ref } from 'vue';

const aj = inject('aj');
aj.pageTitle.set(aj.gettext('Change Password'));
const password = ref('');
const newPassword = ref('');
const newPassword2 = ref('');
const showNewPassword = ref(false);
async function change() {
    if (!newPassword.value) {
        aj.notify.error(aj.gettext('You have to enter a password'));
        return;
    }
    try {
        await aj.http.post('/api/lmn/change-password', { password: password.value || undefined, new_password: newPassword.value });
        aj.notify.success(aj.gettext('Password changed'));
        aj.navigate('landingpage', { replace: true });
    } catch (error) {
        aj.notify.error(aj.gettext('Password change failed: ') + error.data.message, undefined, { sticky: true });
    }
}
</script>

<template>
    <br />
    <div class="alert alert-info">
        <i class="fa fa-info-circle fa-3x float-start"></i>
        <span>{{ aj.gettext('Minimal length is 7 characters. Use upper, lower and special characters or numbers. (e.g. Muster!)') }}</span>
        <br />
        <span>{{ aj.gettext('Valid characters are: a-z A-Z 0-9 ?!§+-@#$%&amp;*( )[ ]{ }').replaceAll('&amp;', '&') }}</span>
        <br />
        <strong>{{ aj.gettext('All fields are required') }}</strong>
    </div>
    <div class="row">
        <div class="col-lg-3 auth-change-quarter"></div>
        <div class="col-lg-6 auth-change-half">
            <div class="auth-field mb-3">
                <label>{{ aj.gettext('Current password') }}</label>
                <!-- Angular never trims password inputs; only the visible text copy trims. -->
                <input v-model="password" type="password" required class="form-control" />
            </div>
            <div v-show="!showNewPassword" class="auth-field mb-3 auth-password-field position-relative">
                <label>{{ aj.gettext('New password') }}</label>
                <input v-model="newPassword" type="password" required class="form-control" />
                <span class="fas fa-eye auth-password-feedback" style="cursor: pointer; pointer-events: all; line-height:34px;" @click="showNewPassword = true"></span>
            </div>
            <div v-show="showNewPassword" class="auth-field mb-3 auth-password-field position-relative">
                <label>{{ aj.gettext('New password') }}</label>
                <input v-model.trim="newPassword" type="text" required class="form-control" />
                <span class="fas fa-eye-slash auth-password-feedback" style="cursor: pointer; pointer-events: all; line-height:34px;" @click="showNewPassword = false"></span>
            </div>
            <div class="auth-field mb-3">
                <label>{{ aj.gettext('Repeat password') }}</label>
                <input v-model="newPassword2" type="password" required class="form-control" />
            </div>
            <div class="auth-field mb-3">
                <div v-show="newPassword && newPassword !== newPassword2" style="color:red;">
                    <small>{{ aj.gettext('The two entered passwords differ') }}</small>
                </div>
                <button class="btn btn-primary" :disabled="!password || !newPassword || !newPassword2 || newPassword !== newPassword2" @click="change">
                    <i class="fa fa-check"></i> <span>{{ aj.gettext('Change password') }}</span>
                </button>
            </div>
        </div>
        <div class="col-lg-3 auth-change-quarter"></div>
    </div>
</template>
