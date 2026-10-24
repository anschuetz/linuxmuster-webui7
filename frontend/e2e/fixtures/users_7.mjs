export const row = (i=0) => ({class:'5a',last_name:'Synthetic',first_name:'Fixture '+i,birthday:'1.1.2010',id:'id'+i,login:'fixture'+i,custom:{scalar:'kept',multi:['a','b']}});
export const rows = () => [{...row(9),class:'#comment'},row(),row(1)];
