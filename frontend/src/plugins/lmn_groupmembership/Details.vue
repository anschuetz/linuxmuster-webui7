<script setup>
import { computed, inject, onMounted, ref } from 'vue';
import { createDetails } from './details.mjs';
import { formatDate } from './model.mjs';
import Search from './Search.vue';
const props = defineProps({ groupType: String, groupName: String });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj'), identity = aj.identity;
const root = ref();
// The original opens with size lg; use the existing Bootstrap frame class.
onMounted(() => root.value.closest('.modal-dialog')?.classList.add('modal-lg'));
const detail = createDetails(aj, props, emit);
const { state, busy: changeState, searchVisible: UserSearchVisible, selection, removeMember, removeAdmin, removeMemberGroup, removeAdminGroup, demoteGroup, demoteMember, elevateGroup, elevateMember, removeTeacherClass, addEntities } = detail;
const fields = Object.fromEntries(['groupDetails', 'members', 'admins', 'groupmemberlist', 'groupadminlist', 'type', 'editGroup', 'editMembers', 'joinable', 'hidden', 'maillist'].map((field) => [field, computed({ get: () => state.value?.[field], set: (value) => { state.value = { ...state.value, [field]: value }; } })]));
const { groupDetails, members, admins, groupmemberlist, groupadminlist, type, editGroup, editMembers, joinable, hidden, maillist } = fields;
const showAdminDetails = ref(true), showMemberDetails = ref(true), noResults = ref(false), resetUsers = ref(0);
const hidetext = computed(() => aj.gettext('Hide')), showtext = computed(() => aj.gettext('Show'));
const text = computed(() => ({ addAsAdmin: aj.gettext('Move to admin group'), removeFromAdmin: aj.gettext('Remove from admin group'), remove: aj.gettext('Remove') }));
const sort = (list) => [...(list ?? [])].sort((a, b) => {
    for (const key of ['sophomorixAdminClass', 'sn']) {
        const x = a[key]?.toLowerCase(), y = b[key]?.toLowerCase();
        if (x !== y) return x === undefined ? 1 : y === undefined ? -1 : x < y ? -1 : 1;
    }
    return 0;
});
const sortedAdmins = computed(() => sort(admins.value)), sortedMembers = computed(() => sort(members.value));
const addasadmin = computed({ get: () => selection.value.addasadmin, set: (value) => { selection.value = { ...selection.value, addasadmin: value }; } });
function chooseUser(user) { selection.value = { ...selection.value, newUser: [...selection.value.newUser, user] }; resetUsers.value += 1; }
function chooseGroup(group) { selection.value = { ...selection.value, newGroup: [...selection.value.newGroup, group] }; }
const changeJoin = () => detail.changeOption('sophomorixJoinable', joinable.value);
const changeHide = () => detail.changeOption('sophomorixHidden', hidden.value);
const changeMaillist = () => detail.changeOption('sophomorixMailList', maillist.value);
const killProject = (name) => detail.kill('project', name), killSchoolclass = (name) => detail.kill('class', name);
const close = () => emit('cancel');
detail.load();
</script>
<template><div ref="root" class="group-details">
<div class="modal-header">
    <h3>
        <span>{{ aj.gettext('Group Details') }}</span>
        <span v-show="type === 'class'">{{ aj.gettext('schoolclass') }}</span>
        <span v-show="type === 'project'">{{ aj.gettext('project') }}</span>
        <span v-show="type === 'group'">{{ aj.gettext('printer') }}</span>
        <span>{{groupDetails?.cn}}</span>
        <span v-show="groupDetails == null"> ...</span>
        <span v-show="groupDetails != null"> : {{groupDetails?.description}}</span>
    </h3>
</div>

<div v-show="groupDetails == null || changeState === true" class="spinner" role="status"><i class="fa fa-circle-o-notch fa-spin"></i></div>

<div v-if="groupDetails" style="padding: 0 20px;">
    <div class="alert alert-warning" v-show="identity.profile.isAdmin && type === 'class' && members.length === 0">
        <a class="btn btn-danger pull-right" @click.prevent="killSchoolclass(groupDetails['description'])">
            <i class="fa fa-trash"></i>
        </a>
        This class seems to be empty, do you want to delete it ?
    </div>
    <br />
    <h4>{{ aj.gettext('Properties') }}</h4>
    <table class="table"><tbody>
        <tr>
            <td><b>{{ aj.gettext('Creationdate:') }}</b></td>
            <td>{{ formatDate(groupDetails['sophomorixCreationDate']) }}</td>
        </tr>
        <tr>
            <td><b>{{ aj.gettext('Type:') }}</b></td>
            <td>{{groupDetails['sophomorixType']}}</td>
        </tr>
        <tr>
            <td><b>{{ aj.gettext('Schoolname:') }}</b></td>
            <td>{{groupDetails['sophomorixSchoolname']}}</td>
        </tr>
        <tr>
            <td><b>{{ aj.gettext('Sophomorix Status:') }}</b></td>
            <td>{{groupDetails['sophomorixStatus']}}</td>
        </tr>
        <tr>
            <td><b>{{ aj.gettext('Joinable:') }}</b></td>
            <td>
                <input type="checkbox" v-model="joinable" :disabled="!editGroup" @change="changeJoin">
            </td>
        </tr>
        <tr>
            <td><b>{{ aj.gettext('Hidden:') }}</b></td>
            <td>
                <input type="checkbox" v-model="hidden" :disabled="!editGroup" @change="changeHide">
            </td>
        </tr>
        <tr v-show="type !== 'group'">
            <td><b>{{ aj.gettext('Maillist:') }}</b></td>
            <td>
                <input type="checkbox" v-model="maillist" :disabled="!editGroup" @change="changeMaillist">
            </td>
        </tr>
    </tbody></table>
    <div class="panel panel-danger" v-show="type === 'project'">
        <div class="panel-heading">
            <a href="#" class="btn btn-default btn-flat pull-right" @click.prevent="showAdminDetails = ! showAdminDetails">{{showMemberDetails ? hidetext : showtext}}</a>
            <h4>
                <span>{{ aj.gettext('Group Admins:') }}</span>
                {{admins.length}} <span>{{ aj.gettext('user(s) and') }}</span>
                {{groupadminlist.length}} <span>{{ aj.gettext('group(s).') }}</span>
            </h4>
        </div>
        <div v-show="showAdminDetails" class="panel-body">
            <h4>{{ aj.gettext('Admins') }}</h4>
            <ul v-if="admins.length > 0" class="list-unstyled" style="column-width:300px;padding:0;">
                <li v-for="admin in sortedAdmins" class="cardlist">
                    {{admin.sn}} {{admin.givenName}}
                    <span class="cardbtn">
                        {{admin.sophomorixAdminClass}}
                        <button class="cardbtn" v-show="editMembers" :title="text.removeFromAdmin">
                            <i class="fas fa-level-down-alt" @click.prevent="demoteMember(admin)"></i>
                        </button>
                        <button class="cardbtn" v-show="editMembers" :title="text.remove">
                            <i class="fas fa-trash" @click.prevent="removeAdmin(admin)"></i>
                        </button>
                    </span>
                </li>
            </ul>
            <span v-if="admins.length === 0" class="cardlist">{{ aj.gettext('No admin') }}</span>
            <h4>{{ aj.gettext('Groups') }}</h4>
            <ul v-if="groupadminlist.length > 0" class="list-unstyled" style="column-width:300px;padding:0;">
                <li v-for="group in groupadminlist" class="cardlist">
                    {{group}}
                   <span class="cardbtn" v-show="editMembers">
                        <button class="cardbtn" :title="text.removeFromAdmin">
                            <i class="fas fa-level-down-alt" @click.prevent="demoteGroup(group)"></i>
                        </button>
                        <button class="cardbtn" :title="text.remove">
                            <i class="fas fa-trash" @click.prevent="removeAdminGroup(group)"></i>
                        </button>
                   </span>
                </li>
            </ul>
            <span v-if="groupadminlist.length === 0" class="cardlist">{{ aj.gettext('No group') }}</span>
        </div>
    </div>
    <div class="panel panel-danger" v-show="type === 'class'">
        <div class="panel-heading">
            <a href="#" class="btn btn-default btn-flat pull-right" @click.prevent="showAdminDetails = ! showAdminDetails">{{showMemberDetails ? hidetext : showtext}}</a>
            <h4>
                <span>{{ aj.gettext('Schoolclass teacher(s):') }}</span>
                {{admins.length}} <span>{{ aj.gettext('teacher(s)') }}</span>
            </h4>
        </div>
        <div v-show="showAdminDetails" class="panel-body">
            <div v-show="type === 'class'">
                <h4>{{ aj.gettext('Teachers') }}</h4>
                <ul v-if="admins.length > 0" class="list-unstyled" style="column-width:300px;padding:0;">
                    <li v-for="admin in admins" class="cardlist">
                        {{admin.sn}} {{admin.givenName}}
                    </li>
                </ul>
                <span v-if="admins.length === 0" class="cardlist">{{ aj.gettext('No teacher') }}</span>
            </div>
        </div>
    </div>

    <div class="panel panel-info">
        <div class="panel-heading">
            <a href="#" class="btn btn-default btn-flat pull-right" @click.prevent="showMemberDetails = ! showMemberDetails">{{showMemberDetails ? hidetext : showtext}}</a>
            <h4 v-show="type !== 'class'">
                <span>{{ aj.gettext('Group Members:') }}</span>
                {{members.length}} <span>{{ aj.gettext('user(s) and') }}</span>
                {{groupmemberlist.length}} <span>{{ aj.gettext('group(s).') }}</span>
            </h4>
            <h4 v-show="type === 'class'">
                <span>{{ aj.gettext('Schoolclass Members:') }}</span>
                {{members.length}} <span>{{ aj.gettext('student(s)') }}</span>
            </h4>
        </div>
        <div v-show="showMemberDetails" class="panel-body">
            <h4>{{ aj.gettext('Members') }}</h4>
            <ul v-if="members.length > 0" class="list-unstyled" style="column-width:300px;padding:0;">
                <li v-for="member in sortedMembers" class="cardlist">
                    {{member.sn}} {{member.givenName}}
                    <div class="cardbtn">
                        {{member.sophomorixAdminClass}}
                        <span v-show="editMembers">
                            <button class="cardbtn" v-show="type === 'project'" :title="text.addAsAdmin">
                                <i class="fas fa-level-up-alt" @click.prevent="elevateMember(member)"></i>
                            </button>
                            <button class="cardbtn" v-show="type === 'project' || type === 'group'" :title="text.remove">
                                <i class="fas fa-trash" @click.prevent="removeMember(member)"></i>
                            </button>
                            <button class="cardbtn" v-show="type === 'class' && member.sophomorixRole === 'teacher'" :title="text.remove">
                                <i class="fas fa-trash" @click.prevent="removeTeacherClass(member)"></i>
                            </button>
                        </span>
                    </div>
                </li>
            </ul>
            <span v-if="members.length === 0" class="cardlist">{{ aj.gettext('No member') }}</span>
            <div v-show="type !== 'class'">
                <h4>{{ aj.gettext('Groups') }}</h4>
                <ul v-if="groupmemberlist.length > 0" class="list-unstyled" style="column-width:300px;padding:0;">
                    <li v-for="group in groupmemberlist" class="cardlist">
                        {{group}}
                        <span class="cardbtn" v-show="editMembers">
                            <button class="cardbtn" v-show="type === 'project'" :title="text.addAsAdmin">
                                <i class="fas fa-level-up-alt " @click.prevent="elevateGroup(group)"></i>
                            </button>
                            <button class="cardbtn" :title="text.remove">
                                <i class="fas fa-trash" @click.prevent="removeMemberGroup(group)"></i>
                            </button>
                        </span>
                    </li>
                </ul>
                <span v-if="groupmemberlist.length === 0" class="cardlist">{{ aj.gettext('No group') }}</span>
            </div>
        </div>
    </div>

    <div v-if="UserSearchVisible" class="modal fade in" style="display:block" tabindex="-1">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h3>{{ aj.gettext('Add members and/or groups') }}</h3></div>
        <div class="modal-body">
          <div v-if="noResults" class="alert alert-warning">{{ aj.gettext('No results found ...') }}</div>
          <h4>{{ aj.gettext(type === 'class' ? 'Search for a teacher' : 'Search for an user') }}</h4>
          <Search :reset-key="resetUsers" :kind="type === 'class' ? 'teacher' : 'user'" :group-name="groupName" @select="chooseUser" @no-results="noResults = $event" />
          <template v-if="type !== 'class'">
            <hr><h4>{{ aj.gettext('Select a student in a class') }}</h4>
            <Search :reset-key="resetUsers" kind="usergroup" :group-name="groupName" @select="chooseUser" @no-results="noResults = $event" />
            <hr><h4>{{ aj.gettext('Add a whole group') }}</h4>
            <Search kind="group" :group-name="groupName" @select="chooseGroup" @no-results="noResults = $event" />
          </template>
          <div v-if="selection.newGroup.length + selection.newUser.length > 0"><h3>{{ aj.gettext('To add') }}</h3>
            <ul v-if="type !== 'class'"><li v-for="(group, i) in selection.newGroup" :key="i">{{ aj.gettext('Group') }} {{ group }}</li></ul>
            <ul><li v-for="(user, i) in selection.newUser" :key="i">{{ aj.gettext('User') }} {{ user.sn }} {{ user.givenName }} {{ user.sophomorixAdminClass }}</li></ul>
          </div>
        </div>
        <div class="modal-footer"><span v-if="type === 'project'"><input v-model="addasadmin" type="checkbox"> Add as admin</span>
          <a class="btn btn-default btn-flat" :disabled="selection.newGroup.length + selection.newUser.length === 0" @click="addEntities">{{ aj.gettext('Apply') }}</a>
          <a class="btn btn-default btn-flat" @click="UserSearchVisible = false">{{ aj.gettext('Cancel') }}</a>
        </div>
      </div></div>
    </div>

    <br />

    <div class="modal-footer">
        <a class="btn btn-danger pull-left" v-show="editGroup && type === 'project'" @click.prevent="killProject(groupName)">
            <i class="fa fa-trash"></i>
            Delete Project
        </a>
        <a class="btn btn-default btn-lmn pull-right" @click.prevent="close()">{{ aj.gettext('Close') }}</a>
        <a class="btn btn-default btn-lmn pull-right" v-show="editMembers" @click.prevent="UserSearchVisible = true">{{ aj.gettext('Add user or group') }}</a>
    </div>
</div>

</div></template>
