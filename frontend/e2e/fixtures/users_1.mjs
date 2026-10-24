export const user = () => ({cn:'p117-user',sAMAccountName:'p117-user',givenName:'Synthetic',sn:'User',sophomorixRole:'student',sophomorixAdminClass:'p117-class',sophomorixBirthdate:'hidden',sophomorixStatus:{tag:'U',color:'success'},sophomorixSchoolname:'default-school',sophomorixAdminFile:'p117-students.csv',sophomorixCreationDate:'20260102120304.0Z',sophomorixDeactivationDate:'19700101000000.0Z',sophomorixTolerationDate:'19700101000000.0Z',memberOf:['CN=p117-class,OU=schoolclasses,DC=test'],parents:[],proxyAddresses:['SMTP:p117@test.invalid'],sophomorixCustom1:'old',sophomorixCustomMulti1:['old'],sophomorixCloudQuotaCalculated:50,sophomorixMailQuotaCalculated:10});
export const config = () => ({custom:{1:{show:true,title:'Single'}},customMulti:{1:{show:true,title:'Multi'}},proxyAddresses:{show:true,title:'Mail'},customDisplay:['','proxyAddresses','sophomorixCustom1','sophomorixCustomMulti1']});

// Never include these synthetic secrets in logs or assertion diagnostics.
export const syntheticPassword = '  Synt hetic7!  ';
export const firstPassword = 'synthetic-only';
