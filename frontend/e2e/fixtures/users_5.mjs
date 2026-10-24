export const templates = [
 [{filename:'individual-default.tex',path:'/usr/share/sophomorix/individual.tex',lang:'de',numberPerPage:1},{filename:'individual-school.tex',path:'/etc/linuxmuster/individual.tex',lang:'en',numberPerPage:1}],
 [{filename:'multiple-default.tex',path:'/usr/share/sophomorix/multiple.tex',lang:'de',numberPerPage:8},{filename:'multiple-school.tex',path:'/etc/linuxmuster/multiple.tex',lang:'en',numberPerPage:4}]
];
export const custom = {passwordTemplates:{individual:templates[0][1].path,multiple:templates[1][1].path}};
