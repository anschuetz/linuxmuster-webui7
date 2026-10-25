<script setup>
import { inject, ref } from 'vue';
import { createPasswords } from '../../common/users/passwords.mjs';
const props = defineProps({ user: Object });
const emit = defineEmits(['blur']);
const aj = inject('aj'), passwords = createPasswords(aj), menu = ref(false);
async function action(fn) { menu.value = false; try { await fn(); } catch { /* Shared dialogs and HTTP interceptors own failures and cancellation. */ } }
async function show() {
    emit('blur', true);
    try { await passwords.showFirstPassword(props.user.cn); }
    finally { emit('blur', false); }
}
function reset() {
    passwords.resetFirstPassword(props.user.cn);
    if (props.user.examMode) passwords.resetFirstPassword(props.user.examBaseCn);
}
function random() {
    if (props.user.cn.endsWith('-exam')) return aj.messagebox.show({ title: aj.gettext('User in exam'), text: aj.gettext('This user seems to be in exam. End exam mode before changing password!'), positive: 'OK' });
    return passwords.setRandomFirstPassword(props.user.cn);
}
function custom(type, both = false) {
    const user = props.user;
    const users = both ? [user, { sophomorixAdminClass: user.sophomorixAdminClass.slice(0, -5), sn: user.sn, givenName: user.givenName, sAMAccountName: user.sAMAccountName.slice(0, -5) }] : [user];
    return passwords.setCustomPassword(users, type);
}
// Translate before substituting usernames; render all account values as text.
const labels = {
    show: "Show <b>{{participant.cn}}</b>'s default password",
    reset: "Restore <b>{{participant.cn}}</b>'s default password",
    resetBoth: "Restore <b>{{participant.cn}}</b>'s and <b>{{participant.examBaseCn}}</b>'s default password",
    random: 'Set random default password for <b>{{participant.cn}}</b>',
    first: 'Set default password for <b>{{participant.cn}}</b>',
    current: 'Set actual password for <b>{{participant.cn}}</b>',
    both: 'Set actual password for <b>{{participant.cn}}</b> and <b>{{participant.examBaseCn}}</b>',
};
function label(key) {
    return aj.gettext(labels[key]).split(/(<b>.*?<\/b>)/g).map(part => ({
        bold: part.startsWith('<b>'),
        text: part.replaceAll(/<\/?b>/g, '').replaceAll('{{participant.cn}}', props.user.cn).replaceAll('{{participant.examBaseCn}}', props.user.examBaseCn),
    }));
}
</script>
<template>
    <span v-if="!(user.examMode && user.examTeacher !== aj.identity.user)" data-password-menu class="dropup" @focusout="event => { if (!event.currentTarget.contains(event.relatedTarget)) menu = false; }">
        <button class="btn btn-light c6-button" :aria-label="aj.gettext('Change Password')" :aria-expanded="menu" @click="menu = !menu"><i class="fa fa-cog"></i></button>
        <ul v-show="menu" :class="{ show: menu }" class="dropdown-menu c6-menu dropdown-menu-end" style="margin-bottom:-30px;margin-right:40px;z-index:4000">
            <li><a class="dropdown-item" href="" data-password-show @click.prevent="action(show)"><component :is="part.bold ? 'b' : 'span'" v-for="(part, i) in label('show')" :key="i">{{ part.text }}</component></a></li>
            <li><a class="dropdown-item" href="" data-password-reset @click.prevent="action(reset)"><component :is="part.bold ? 'b' : 'span'" v-for="(part, i) in label(user.examMode ? 'resetBoth' : 'reset')" :key="i">{{ part.text }}</component></a></li>
            <li v-if="!user.examMode"><a class="dropdown-item" href="" data-password-random @click.prevent="action(random)"><component :is="part.bold ? 'b' : 'span'" v-for="(part, i) in label('random')" :key="i">{{ part.text }}</component></a></li>
            <li v-if="!user.examMode"><a class="dropdown-item" href="" data-password-first @click.prevent="action(() => custom('first'))"><component :is="part.bold ? 'b' : 'span'" v-for="(part, i) in label('first')" :key="i">{{ part.text }}</component></a></li>
            <li><a class="dropdown-item" href="" data-password-current @click.prevent="action(() => custom('current'))"><component :is="part.bold ? 'b' : 'span'" v-for="(part, i) in label('current')" :key="i">{{ part.text }}</component></a></li>
            <li v-if="user.examMode"><a class="dropdown-item" href="" data-password-both @click.prevent="action(() => custom('current', true))"><component :is="part.bold ? 'b' : 'span'" v-for="(part, i) in label('both')" :key="i">{{ part.text }}</component></a></li>
        </ul>
    </span>
</template>
