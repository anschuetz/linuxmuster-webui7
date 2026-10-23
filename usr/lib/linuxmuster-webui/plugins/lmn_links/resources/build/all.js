'use strict';

// the module should depend on 'core' to use the stock services & components
angular.module('lmn.links', ['core']);


'use strict';

angular.module('lmn.links').config(function ($routeProvider) {
    $routeProvider.when('/view/lmn/links', {
        templateUrl: '/lmn_links:resources/partial/index.html'
    });
});


var LmnVue_lmn_links=(function(e,t){Object.defineProperty(e,Symbol.toStringTag,{value:`Module`});var n={key:0,class:`alert alert-info`,style:{"margin-top":`15px`}},r={class:`panel panel-info`,style:{width:`100%`}},i={class:`panel-heading`,style:{padding:`10px`,height:`55px`}},a=[`src`],o={style:{"font-size":`18px`,"line-height":`32px`,"padding-left":`10px`}},s={style:{float:`right`}},c=[`href`],l={class:`btn btn-default`},u={class:`panel-body`},d={__name:`Links`,setup(e){let d=(0,t.inject)(`aj`),f=(0,t.ref)(),p=(0,t.computed)(()=>f.value?.filter(e=>Object.keys(e.permissions??{}).includes(d.identity.profile.sophomorixRole)));return d.pageTitle.set(d.gettext(`Links`)),(0,t.watch)(()=>d.identity.user,async e=>{if(e!=null){f.value=void 0;try{let{data:e}=await d.http.get(`/api/lmn/links`);f.value=e.status===`success`?Object.values(e.data):[]}catch{}}},{immediate:!0}),(e,f)=>((0,t.openBlock)(),(0,t.createElementBlock)(t.Fragment,null,[p.value?.length===0?((0,t.openBlock)(),(0,t.createElementBlock)(`div`,n,[f[0]||=(0,t.createElementVNode)(`i`,{class:`fa fa-info-circle`},null,-1),f[1]||=(0,t.createTextVNode)(),(0,t.createElementVNode)(`span`,null,(0,t.toDisplayString)((0,t.unref)(d).gettext(`Currently no links defined!`)),1)])):(0,t.createCommentVNode)(``,!0),((0,t.openBlock)(!0),(0,t.createElementBlock)(t.Fragment,null,(0,t.renderList)(p.value,(e,n)=>((0,t.openBlock)(),(0,t.createElementBlock)(`div`,{key:n,class:`flex-container info-cards`,style:{"margin-top":`10px`}},[(0,t.createElementVNode)(`div`,r,[(0,t.createElementVNode)(`div`,i,[(0,t.createElementVNode)(`img`,{src:e.icon,height:`30px`},null,8,a),(0,t.createElementVNode)(`span`,o,(0,t.toDisplayString)(e.title),1),(0,t.createElementVNode)(`div`,s,[(0,t.createElementVNode)(`a`,{href:e.link},[(0,t.createElementVNode)(`button`,l,[f[2]||=(0,t.createElementVNode)(`i`,{class:`fas fa-globe`},null,-1),f[3]||=(0,t.createTextVNode)(),(0,t.createElementVNode)(`span`,null,(0,t.toDisplayString)((0,t.unref)(d).gettext(`Open`)),1)])],8,c)])]),(0,t.createElementVNode)(`div`,u,(0,t.toDisplayString)(e.description),1)])]))),128))],64))}};function f(e,n){let r=(0,t.createApp)(d);return r.provide(`aj`,n),r.mount(e),()=>r.unmount()}return e.mount=f,e})({},Vue);
