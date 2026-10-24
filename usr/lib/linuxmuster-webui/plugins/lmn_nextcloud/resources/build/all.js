'use strict';

// the module should depend on 'core' to use the stock services & components
angular.module('lmn.nextcloud', ['core']);


'use strict';

angular.module('lmn.nextcloud').config(function ($routeProvider) {
    $routeProvider.when('/view/lmn/nextcloud', {
        templateUrl: '/lmn_nextcloud:resources/partial/index.html'
    });
});


var LmnVue_lmn_nextcloud=(function(e,t){Object.defineProperty(e,Symbol.toStringTag,{value:`Module`});var n=new WeakMap;function r(e){if(e.shell)return e.shell;let r=window.angular.element(document.documentElement),i=r.scope(),a=n.get(i);if(!a){let e=(0,t.reactive)({sidebar:!!i.showSidebar,widescreen:!!i.isWidescreen,overlay:!!i.showOverlaySidebar});a={count:0,stops:[[`showSidebar`,`sidebar`],[`isWidescreen`,`widescreen`],[`showOverlaySidebar`,`overlay`]].map(([t,n])=>i.$watch(t,t=>{e[n]=!!t})),capability:{layout:(0,t.readonly)(e),customization:(0,t.readonly)(r.injector().get(`customization`)),...Object.fromEntries([`toggleNavigation`,`toggleWidescreen`,`toggleOverlayNavigation`].map(e=>[e,t=>i.$evalAsync(()=>i[e](t))]))}},n.set(i,a)}return a.count+=1,(0,t.onScopeDispose)(()=>{--a.count,a.count===0&&(a.stops.forEach(e=>e()),n.delete(i))}),a.capability}var i={class:`alert alert-info`,style:{"margin-top":`10px`}},a={style:{width:`auto`,height:`100vh`,"margin-left":`-15px`,"margin-right":`-15px`,"margin-top":`-60px`}},o={__name:`Nextcloud`,setup(e){let n=(0,t.inject)(`aj`),o=r(n),s=(0,t.ref)(1);return n.pageTitle.set(n.gettext(`Nextcloud`)),(0,t.watch)(()=>n.identity.user,async e=>{if(e==null)return;let t;try{({data:t}=await n.http.get(`/api/lmn/nextcloud`))}catch{return}if(s.value=t[0],s.value===200){t[2]&&(o.toggleNavigation(),o.toggleWidescreen());let e=t[1]+(t[3]?`/index.php/login?user=${n.identity.user}`:``);window.open(e,`iframe_nextcloud`)}},{immediate:!0}),(e,r)=>((0,t.openBlock)(),(0,t.createElementBlock)(t.Fragment,null,[(0,t.withDirectives)(((0,t.openBlock)(),(0,t.createBlock)((0,t.resolveDynamicComponent)(`progress-spinner`),{class:`nextcloud-spinner`,style:{"margin-top":`20px`}},{default:(0,t.withCtx)(()=>[...r[0]||=[(0,t.createElementVNode)(`div`,null,[(0,t.createElementVNode)(`div`,{class:`one`}),(0,t.createElementVNode)(`div`,{class:`two`})],-1)]]),_:1},512)),[[t.vShow,s.value===1]]),(0,t.withDirectives)((0,t.createElementVNode)(`div`,i,[r[1]||=(0,t.createElementVNode)(`i`,{class:`fa fa-info-circle`},null,-1),r[2]||=(0,t.createTextVNode)(),(0,t.createElementVNode)(`span`,null,(0,t.toDisplayString)((0,t.unref)(n).gettext(`URL not found or not valid! Please check config file.`)),1),r[3]||=(0,t.createElementVNode)(`span`,null,null,-1)],512),[[t.vShow,s.value!==200&&s.value!==1]]),(0,t.withDirectives)((0,t.createElementVNode)(`div`,a,[...r[4]||=[(0,t.createElementVNode)(`iframe`,{name:`iframe_nextcloud`,style:{width:`100%`,height:`100%`,border:`0`,"margin-top":`60px`}},null,-1)]],512),[[t.vShow,s.value===200]])],64))}};function s(e,n){let r=(0,t.createApp)(o);return r.provide(`aj`,n),r.mount(e),()=>r.unmount()}return e.mount=s,e})({},Vue);
