export const imageConfigs = () => [
    {file:'start.conf.one',images:['p86.qcow2'],settings:{}},
    {file:'start.conf.other',images:['p86.qcow2'],settings:{School:'other-school'}},
    {file:'start.conf.part.two',images:['p86.qcow2'],settings:{School:'default-school'}},
];
export const backupImage = () => ({name:'p86',backup:true,timestamp:123,size:512,desc:'Backup\ntext',info:'',reg:'backup reg',postsync:'backup post',prestart:'backup pre'});
export const imageList = () => [
    {name:'p86',size:1536,desc:'First\r\nsecond',info:'info',reg:'  main reg\n',postsync:'main post',prestart:'main pre',
        diff_image:{name:'p86',diff:true,size:1024,desc:'diff',info:'',reg:'diff reg',prestart:'diff pre'},
        backups:{'20261001':backupImage()}},
    {name:'source',size:0,desc:'Source',info:'',reg:'  source reg\n',postsync:'  source post\n',prestart:'  source pre\n',backups:{},diff_image:{}},
    {name:'broken',error:true,size:undefined,desc:'',backups:{},diff_image:{}},
];
export const scriptExample = key => `  ${key} template\nline 2\n`;
