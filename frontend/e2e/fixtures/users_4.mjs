export const student=(i=0)=>({class:'5a',last_name:'Synthetic',first_name:'Extra '+String(i).padStart(3,'0'),birthday:'1.1.2010',login:'extra'+i});
export const course=(i=0)=>({course:'Extra '+String(i).padStart(3,'0'),base_name:'extra'+i,count:'2',birthday:'1.1.2010',gecos:'Synthetic GECOS',password:'',removal_date:'1.1.2030'});
export const rows=kind=>[...Array.from({length:101},(_,i)=>kind==='students'?student(i):course(i)),kind==='students'?{...student(102),class:'#comment'}:{...course(102),course:'#comment'}];
